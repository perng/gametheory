from django.shortcuts import render
from django.http import HttpResponse
from gametheory.core.models import *
from decorators import *
from datetime import datetime
from datetime import timedelta
from django.core.cache import caches
from django.db import transaction
from django.db.models import Q
from gametheory.settings import WAITING_TIMEOUT, payout, TIMEOUT_PENALTY, geoprefix
import json, urllib2, logging
from Queue import Empty
from utils import *

class Game:
    def __init__(self, player_sockets=[]):
        self.sockets = player_sockets
        self.start_time = datetime.now()

    def add_player(self, socket):
        self.sockets.append(socket)


def clean_up():
    ''' removed timed-out Queue and Game'''
    t = datetime.now() - timedelta(seconds=WAITING_TIMEOUT)
    games = Game.objects.filter(start_time__lt=t, finish_time=None)[:]
    for g in games:
        g.delete()



def get_game_names(socket, params):
    game_names = [g.name for g in GameSpec.objects.all()]
    return JsonResponse(socket, params, {'game_names': game_names}, OK, '')


@required_params('game_name')
def create_game(socket, params):
    attrs = ['num_players_min', 'num_players_max', 'matching_time_min', 'matching_time_max',
             'starting_score', 'starting_xp', 'starting_level', 'starting_gem']
    gamespec, created = GameSpec.objects.get_or_create(name = params['game_name'])
    for attr in attrs:
        if attr in params:
            gamespec.__dict__[attr] = params[attr]
    gamespec.save()

@required_params('game_name')
def get_game_rooms(socket, params):
    try:
        game = GameSpec.objects.get(name=params['game_name'])
    except:
        return JsonResponse(socket, params, {}, ERROR, "game or room doesn't exist")

    game_rooms = [r.name for r in GameRoom.objects.filter(gamespec = game)]
    return JsonResponse(socket, params, {'game_rooms': game_rooms}, OK, '')

@login_required
@required_params('game_name', 'room')
def sit_for_game(socket, params):
    ''' This only applies to auto-matching game.
    Sit in the game room to be auto-matched. If not enough players, get a reply of 'waiting'.
    Once game starts, the player get a message for game starting
    :return:
    '''
    try:
        game_name, room = params['game_name'], params['room']
        room = socket.factory.gamerooms[game_name][room]
        spec = socket.factory.gamespecs[game_name]
    except:
        return JsonResponse(socket, params, {}, ERROR, "game or room doesn't exist")

    socket.datastore.sit_to_play(socket.player, room)


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
@required_params('outcome')
def record_game(socket, params):
    game = GameRecord()
    outcome = params['outcome']  # a list of players
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
