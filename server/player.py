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

def noop(socket, params):
    return JsonResponse(socket, params, {}, OK, 'No operation')

@required_params('uuid', 'uuid_type', 'player_name')
def register(socket, params):
    player, created = Player.objects.get_or_create(player_uuid=params['uuid'], uuid_type=params['uuid_type'])
    if created:
        msg = "New user registered"
    else:
        msg = "User renamed"
    player.player_name = params['player_name']
    ip = socket.ip
    player.ip_address = ip
    # tokens = urllib2.urlopen(geoprefix + ip).readline().split(';')
    # if tokens[0] == 'OK' :
    #     player.country = tokens[4]
    #     player.state = tokens[5]
    #     player.city = tokens[6]
    #     player.zipcode = tokens[7]
    #     player.long = float(tokens[8])
    #     player.lat = float(tokens[9])
    player.save()
    socket.player = player
    result = player.info()
    return JsonResponse(socket, params, result, OK, msg)

@required_params('player_id')
def login(socket, params):
    try:
        socket.player = Player.objects.get(id=params['player_id'])
        return JsonResponse(socket, params, {}, OK, '')
    except:
        pass
    return JsonResponse(socket, params, {}, ERROR, "Login failed, player_id invalid")



@login_required
@required_params('game_name')
def get_my_stats(socket, params):
    stats = PlayerStats
    stats = socket.player.get_stats(params['game_name'])
    return JsonResponse(socket, params, stats.details(), OK, '')


@required_params('player_id','game_name')
def get_player_stats(socket, params):
    try:
        print 'get_player_stats:', params
        player = Player.objects.get(id=int(params['player_id']))
    except:
        return JsonResponse(socket, params, {}, ERROR, 'player_id:' + params['player_id'] + ' not found')
    stats = player.get_stats(params['game_name'])
    if stats:
        return JsonResponse(socket, params, stats.details(), OK, '')
    return JsonResponse(socket, params, {}, ERROR, 'game_name:' + params['game_name'] + ' not found')

@required_params('player_id','game_name')
@login_required
def update_stats(socket, params):
    try:
        player = Player.objects.get(id=int(params['player_id']))
    except:
        return JsonResponse(socket, params, {}, ERROR, 'player_id:' + params['player_id'] + ' not found')

    stats = player.get_stats(params['game_name'])
    if not stats:
        return JsonResponse(socket, params, {}, ERROR, 'game_name:' + params['game_name'] + ' not found')

    stats.score += params['score'] if 'score' in params else 0
    stats.level += params['level'] if 'level' in params else 0
    stats.xp += params['xp'] if 'xp' in params else 0
    stats.gem += params['gem'] if 'gem' in params else 0
#    result = {'player_id': player.id, 'player_name': player.player_name,
#              'score': player.score, 'xp': player.xp, 'level': player.level}
    stats.save()
    return JsonResponse(socket, params, stats.details(), OK, '')



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

