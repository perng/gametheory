from django.shortcuts import render
from django.http import HttpResponse
from gametheory.core.models import Player, GameRecord
from datetime import datetime
from datetime import timedelta
from django.core.cache import caches
from django.db import transaction
from django.db.models import Q
from gametheory.settings import WAITING_TIMEOUT, payout, TIMEOUT_PENALTY, geoprefix
import json, urllib2, logging
from Queue import Empty

OK = 'ok'
ERROR = 'error'
WAITING = 'waiting'


class Game:
    def __init__(self, player_sockets=[]):
        self.sockets = player_sockets
        self.start_time = datetime.now()

    def add_player(self, socket):
        self.sockets.append(socket)


def JsonResponse(socket, params, result, status=OK, msg=''):
    print 'result=', result
    result["status"] = status
    result["msg"] = msg
    result["reply_cmd"] = params['cmd']
    if '_tracker' in params:
        result['_tracker'] = params['_tracker']
    socket.sendMessage(json.dumps(result).encode('utf8'), False)


def clean_up():
    ''' removed timed-out Queue and Game'''
    t = datetime.now() - timedelta(seconds=WAITING_TIMEOUT)
    games = Game.objects.filter(start_time__lt=t, finish_time=None)[:]
    for g in games:
        g.delete()


class required_params(object):
    def __init__(self, *args):
        self.required = args

    def __call__(self, f):
        def wrapped_f(socket, params):
            missing = [p for p in self.required if p not in params]
            if missing:
                msg = 'parameters ' + ','.join(missing) + ' are missing.'
                return JsonResponse(socket, params, {}, ERROR, msg)
            return f(socket, params)

        return wrapped_f


def login_required(func):
    def wrapped_f(socket, params):
        if socket.player:
            return func(socket, params)
        msg = 'login required'
        return JsonResponse(socket, params, {}, ERROR, msg)

    return wrapped_f


def noop(socket, params):
    return JsonResponse(socket, params, {}, OK, 'No operation')

@required_params('game_name')
def get_gamerooms(socket, params):
    gname = params['game_name']
    if gname in socket.factory.gamerooms:
        return JsonResponse(socket, params, {'game_rooms': socket.factory.gamerooms[gname].keys()}, OK, '')
    print 'get_gamerooms error'

@required_params('uuid', 'uuid_type', 'player_name')
def register(socket, params):
    player, created = Player.objects.get_or_create(player_uuid=params['uuid'], uuid_type=params['uuid_type'])
    if created:
        msg = "New user registered"
    else:
        msg = "User renamed"
    player.player_name = params['player_name']
    ip = socket.ip
    tokens = urllib2.urlopen(geoprefix + ip).readline().split(';')
    if tokens[0] == 'OK':
        player.ip_address = ip
        player.country = tokens[4]
        player.state = tokens[5]
        player.city = tokens[6]
        player.zipcode = tokens[7]
        player.long = float(tokens[8])
        player.lat = float(tokens[9])
    player.save()
    socket.player = player
    result = player.stats()

    return JsonResponse(socket, params, result, OK, msg)


@required_params('player_id')
def login(socket, params):
    try:
        socket.player = Player.objects.get(id=params['player_id'])
        return get_my_stats(socket, params)
    except:
        pass
    return JsonResponse(socket, params, {}, ERROR, "Login failed, player_id invalid")


@login_required
def get_my_stats(socket, params):
    return JsonResponse(socket, params, socket.player.stats(), OK, '')


def get_player_stats(socket, params):
    if 'player_id' in params:
        try:
            player = Player.objects.get(id=int(params['player_id']))
        except:
            return JsonResponse(socket, params, {}, ERROR, 'player_id:' + params['player_id'] + ' not found')
    elif 'uuid' in params and 'uuid_type' in params:
        try:
            player = Player.objects.get(uuid=params['uuid'], uuid_type=params['uuid_type'])
        except:
            return JsonResponse(socket, params, {}, ERROR, 'uuid:' + params['uuid'] + ' not found')
    else:
        return JsonResponse(socket, params, {}, ERROR, 'no id info')
    player.save()  # update last_play_time
    return JsonResponse(socket, params, player.stats(), OK, '')


@login_required
@required_params('game_name', 'room')
def start_game(socket, params):
    try:
        game_name, room = params['game_name'], params['room']
        room = socket.factory.gamerooms[game_name][room]
        lock = socket.factory.locks[game_name][room]
        spec = socket.factory.gamespecs[game_name]
    except:
        return JsonResponse(socket, params, {}, ERROR, "game or room doesn't exist")
    lock.acquire(True)
    if len(room) + 1 >= spec['num_player']:  # game can start
        game = Game([socket])
        socket.game = game
        game.add_player(socket)
        lock.acquire()
        for i in range(spec['num_player'] - 1):
            opp_socket = room.get()
            game.add_player(opp_socket)
            opp_socket.game = game
        lock.release()
        players_info = [s.player.stats() for s in game.sockets]
        msg = 'Game start!'
        JsonResponse(socket, params, {'players': players_info}, OK, msg)
        return
    else:
        room.put(socket)
        JsonResponse(socket, params, {}, WAITING, 'waiting for opponent to join')

@login_required
@required_params('message')
def message(socket, params):
    result = {'message': params['message']}
    JsonResponse(socket.opponent, params, result, OK, '')
    JsonResponse(socket, params, {}, OK, '')


@login_required
def change_stats(socket, params):
    try:
        player = Player.objects.get(id=int(params['player_id']))
        player.score += params['score'] if 'score' in params else 0
        player.score += params['level'] if 'level' in params else 0
        player.score += params['xp'] if 'xp' in params else 0
        player.score += params['gem'] if 'gem' in params else 0
        result = {'player_id': player.id, 'player_name': player.player_name,
                  'score': player.score, 'xp': player.xp, 'level': player.level}
        player.save()
        return JsonResponse(socket, params, result, OK, '')
    except:
        return JsonResponse(socket, params, {}, ERROR, 'player_id:' + params['player_id'] + ' not found')

@login_required
@required_params('outcome')
def record_game(socket, params):
    game = GameRecord()
    outcome = params['outcome'] # a list of players
    players = {}
    players_attrs = {}
    ranks = {}
    for o in outcome:
        pid = int(o['player_id'])
        player = Player.objects.get(pid)
        players_attrs[pid] = o

    player_ids = [int(p['player_id']) for p in outcome]
    for pid in player_ids:
        game.players.add(Player.objects.get(id=pid))



def leaders_overall(socket, params):
    players = Player.objects.order_by('-score')[:20]
    player_list = [{'player_name': p.player_name, 'score': p.score, 'level': p.level, 'xp:': p.xp} for p in players]
    return JsonResponse(socket, params, {'status': OK, 'players': player_list}, OK, '')


def rank_overall(socket, player_id):
    try:
        player = Player.objects.get(id=int(player_id))
    except:
        return JsonResponse(FAIL)
    rank = Player.objects.filter(score__gt=player.score).count() + 1
    return JsonResponse(socket, params, {'rank': rank}, OK, '')


def leaders_country(socket, player_id):
    try:
        player = Player.objects.get(id=int(player_id))
    except:
        return JsonResponse(FAIL)
    players = Player.objects.filter(country=player.country).order_by('-score')
    player_list = [{'player_name': p.player_name, 'score': p.score} for p in players]
    return JsonResponse({'status': OK, 'players': player_list})


def rank_country(socket, player_id):
    try:
        player = Player.objects.get(id=int(player_id))
    except:
        return JsonResponse(FAIL)
    rank = Player.objects.filter(score__gt=player.score, country=player.country).count() + 1
    return JsonResponse({'status': OK, 'rank': rank})


def leaders_city(socket, player_id):
    try:
        player = Player.objects.get(id=int(player_id))
    except:
        return JsonResponse(FAIL)
    players = Player.objects.filter(country=player.country, city=player.city).order_by('-score')
    player_list = [{'player_name': p.player_name, 'score': p.score} for p in players]
    return JsonResponse({'status': OK, 'players': player_list})


def rank_city(socket, player_id):
    try:
        player = Player.objects.get(id=int(player_id))
    except:
        return JsonResponse(FAIL)
    rank = Player.objects.filter(score__gt=player.score, country=player.country, city=player.city).count() + 1
    return JsonResponse({'status': OK, 'rank': rank})

