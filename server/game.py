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



def get_games(socket, params):
    games = [{'game_name': g.name, 'game_id' : g.id} for g in GameSpec.objects.all()]
    return JsonResponse(socket, params, {'games': games}, OK, '')


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

    game_rooms = [{'room_name': r.name, 'room_id': r.id}  for r in GameRoom.objects.filter(gamespec = game)]
    return JsonResponse(socket, params, {'game_rooms': game_rooms}, OK, '')

@login_required
@required_params('room_id')
def sit_for_auto_match_game(socket, params):
    ''' This only applies to auto-matching game.
    Sit in the game room to be auto-matched. If not enough players, get a reply of 'waiting'.
    Once game starts, the player get a message for game starting
    :return:
    '''
    try:
        room = GameRoom.objects.get(id=int(params['room_id']))
    except:
        return JsonResponse(socket, params, {}, ERROR, "game room doesn't exist")

    table = socket.factory.datastore.sit_to_play_auto_match(socket.player, room)
    return JsonResponse(socket, params, {'table_id': table.id, 'game_status': table.status}, OK, '')

@login_required
@required_params('table_id')
def leave_table(socket, params):
    try:
        table = socket.factory.datastore.gametables[int(params['table_id'])]
        assert socket.player.id in table.players
        table.leave(socket.player)
        return JsonResponse(socket, params, {}, OK, '')
    except Exception as inst:
        print inst
        return JsonResponse(socket, params, {}, ERROR, "table doesn't exist.")


@login_required
@required_params('message', 'table_id')
def broadcast_in_table(socket, params):
    try:
        table = socket.factory.datastore.gametables[int(params['table_id'])]
        table.broadcast(socket.player.id, {'message': params['message'], 'sys_cmd': 'peer_message'})
        return JsonResponse(socket, params, {}, OK, '')
    except Exception as inst:
        print inst
        return JsonResponse(socket, params, {}, ERROR, "table doesn't exist.")

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

@login_required
@required_params('table_id')
def get_leaders(socket, params):
    print 'existing tables:', socket.factory.datastore.gametables
    try:
        table = socket.factory.datastore.gametables[int(params['table_id'])]

        leaders = socket.factory.datastore.gametables[int(params['table_id'])].leaders()
        return JsonResponse(socket, params, {'leaders':leaders}, OK, '')
    except:
        return JsonResponse(socket, params, {}, ERROR, "table doesn't exist or no player")


