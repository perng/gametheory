from django.shortcuts import render
from django.http import HttpResponse
from gametheory.core.models import Player,  Game
from datetime import datetime
from datetime import timedelta
from django.core.cache import caches
from django.db import transaction
from django.db.models import Q
from gametheory.settings import WAITING_TIMEOUT, payout, TIMEOUT_PENALTY, geoprefix
import json, urllib2, logging

OK = 'ok'
ERROR = 'error'

def JsonResponse(socket, params,  result, status=OK, msg=''):
    print 'obj=', result
    result["status"]=status
    result["msg"]=msg
    socket.sendMessage(json.dumps(result).encode('utf8'), False)

def clean_up():
    ''' removed timed-out Queue and Game'''
    t = datetime.now()-timedelta(seconds=WAITING_TIMEOUT)
    games = Game.objects.filter(start_time__lt = t, finish_time =None)[:]
    for g in games:
        g.delete()

def noop(socket, params):
    return JsonResponse(socket, params,  {},  OK, 'No operation')

def register(socket, params):
    if 'uuid' not in params:
        return JsonResponse(socket, {}, ERROR, 'uuid not sent in '+params)
    if 'player_name' not in params:
        return JsonResponse(socket, {}, ERROR, 'player_name not sent in '+params)
    player, created = Player.objects.get_or_create(player_uuid=params['uuid'])
    player.player_name = params['player_name']
    ip = socket.ip
    tokens = urllib2.urlopen(geoprefix+ip).readline().split(';')
    if tokens[0]=='OK':
        player.ip_address = ip
        player.country = tokens[4]
        player.state = tokens[5]
        player.city = tokens[6]
        player.zipcode = tokens[7]
        player.long = float(tokens[8])
        player.lat = float(tokens[9])
    player.save()
    result = {'status':OK, 'player_id':player.id, 'player.score':player.score}
    return JsonResponse(socket, result)

def get_player_stats_by_id(socket, player_id):
    clean_up()
    try:
        player = Player.objects.get(id = int(player_id))
    except:
        return JsonResponse(FAIL)
    player.save() # update last_play_time
    result = {'status':OK, 'player_id':player.id, 'player_name':player.player_name, 'score':player.score}
    return JsonResponse(result)

def get_player_stats_by_uuid(socket, player_uuid):
    clean_up()
    try:
        player = Player.objects.get(player_uuid = player_uuid)
    except:
        return JsonResponse(FAIL)

    player.save() # update last_play_time
    result = {'status':OK, 'player_id':player.id, 'player_name':player.player_namee, 'score':player.score}
    return JsonResponse(result)


def start_game(socket, player_id):
    clean_up()
    try:
        player = Player.objects.get(id=int(player_id))
    except:
        return JsonResponse(FAIL)

    player=Player.objects.get(id=player_id)
    cache = caches['default']

    #check if already assigned in a game
    game_id = cache.get(player_id)
    if game_id:
        game_id = int(game_id)
        game = Game.objects.get(id = game_id)
        opponent = game.opponent(player_id)
        print "already in game", game_id
        result = {'status':OK, 'game_id':game.id, 'oppenent_id':opponent.id, 'oppenent_name':opponent.player_name, 'opponent_score':opponent.score}
        return JsonResponse(result)

    # check if there are any oppenent in queue, if so, create game table
    with transaction.atomic():
        print 'cached player=', cache.get('q')
        opp_id = cache.get('q')
        if opp_id and int(opp_id) != player_id:
            opp_id = int(opp_id)
            cache.delete('q')
        else:
            opp_id = None
    if opp_id:
        opponent = Player.objects.get(id=opp_id)
        game = Game(player1=player, player2=opponent)
        game.save()
        cache.set(opp_id, game.id)
        cache.set(player_id, game.id)
        print 'found opponent, new game_id=', game.id
        result = {'status':OK, 'game_id':game.id, 'oppenent_id':opponent.id, 'oppenent_name':opponent.player_name, 'opponent_score':opponent.score}
        return JsonResponse(result)

    # queue the player
    cache.set('q', player_id)
    return JsonResponse({'status':OK})

def player_cheat(socket, player_id, game_id, cheat=True):
    cache = caches['default']

    game = Game.objects.get(id=int(game_id))
    player_id = int(player_id)
    try:
        player = Player.objects.get(id = player_id)
    except:
        return JsonResponse(FAIL)
    opponent = game.opponent(player_id)
    cache.set(player_id, None)

    if game.player1.id == player_id:
        print "I am player1"
        game.player1cheat = cheat
        hecheat = game.player2cheat
    else:
        print "I am player2"
        game.player2cheat = cheat
        hecheat = game.player1cheat
    game.save()

    print "player1", game.player1cheat, "player2", game.player2cheat
    if game.player1cheat!=None and game.player2cheat!=None:
        game.finish_time=datetime.now()
        game.save()
        pay = payout(cheat, hecheat)
        player.score+= pay
        player.save()
        result = {'status':OK, 'opponent_cheat':hecheat, 'gain':pay, 'new_score':player.score}
        return JsonResponse({'status':OK})
    elif game.finish_time != None:  # opponent timed out
        return JsonResponse({'status':'opponent_timed_out'})
    else:
        return JsonResponse({'status':'waiting'})


def player_split(socket, player_id, game_id):
    return player_cheat(socket, player_id, game_id, False)

def player_timed_out(socket, player_id, game_id):
    game = Game.objects.get(id=int(game_id))
    try:
        player = Player.objects.get(id=int(player_id))
    except:
        return JsonResponse(FAIL)
    player.score -= TIMEOUT_PENALTY
    player.save()
    game.finish_time = datetime.now()
    game.save()
    return JsonResponse({'status':'timed_out', 'gain':-TIMEOUT_PENALTY, 'new_score':player.score})

def leaders_overall(socket):
    players = Player.objects.order_by('-score')[:20]
    player_list = [{'player_name':p.player_name, 'score':p.score} for p in players]
    return JsonResponse({'status':OK, 'players': player_list})

def rank_overall(socket, player_id):
    try:
        player = Player.objects.get(id=int(player_id))
    except:
        return JsonResponse(FAIL)
    rank = Player.objects.filter(score__gt=player.score).count()+1
    return JsonResponse({'status':OK, 'rank':rank})

def leaders_country(socket, player_id):
    try:
        player = Player.objects.get(id=int(player_id))
    except:
        return JsonResponse(FAIL)
    players = Player.objects.filter(country=player.country).order_by('-score')
    player_list = [{'player_name':p.player_name, 'score':p.score} for p in players]
    return JsonResponse({'status':OK, 'players': player_list})
def rank_country(socket, player_id):
    try:
        player = Player.objects.get(id=int(player_id))
    except:
        return JsonResponse(FAIL)
    rank = Player.objects.filter(score__gt=player.score, country=player.country).count()+1
    return JsonResponse({'status':OK, 'rank':rank})

def leaders_city(socket, player_id):
    try:
        player = Player.objects.get(id=int(player_id))
    except:
        return JsonResponse(FAIL)
    players = Player.objects.filter(country=player.country, city=player.city).order_by('-score')
    player_list = [{'player_name':p.player_name, 'score':p.score} for p in players]
    return JsonResponse({'status':OK, 'players': player_list})

def rank_city(socket, player_id):
    try:
        player = Player.objects.get(id=int(player_id))
    except:
        return JsonResponse(FAIL)
    rank = Player.objects.filter(score__gt=player.score, country=player.country, city=player.city).count()+1
    return JsonResponse({'status':OK, 'rank':rank})

