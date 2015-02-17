from django.shortcuts import render
from django.http import HttpResponse
from models import Player,  Game
from datetime import datetime
from datetime import timedelta
from django.core.cache import caches
from django.db import transaction
from django.db.models import Q
from gametheory.settings import WAITING_TIMEOUT, payout, TIMEOUT_PENALTY
# Create your views here.

def clean_up():
	''' removed timed-out Queue and Game'''
	t = datetime.now()-timedelta(seconds=WAITING_TIMEOUT)
	queues = Queue.objects.filter(last_pool_time__lt = t)[:]
	for q in queues:
		q.delete()
	games = Game.objects.filter(start_time__lt = t, finish_time =None)[:]
	for g in games:
		g.delete

def register(register, player_name, player_uuid):
	player, created = Player.objects.get_or_create(player_uuid=player_uuid)
	player.player_name = player_name
	player.save()
 	return HttpResponse('{status:"ok", player_id:%d, score:%d}' % (player.id, player.score), content_type='application/json')

def get_player_stats_by_id(request, player_id):
	clean_up()
	player = Player.objects.get(id = int(player_id))
	player.save() # update last_play_time 
 	return HttpResponse('{status:"ok", player_id:%d, player_name:"%s", score:%d}' % (player.id, player.player_name, player.score), content_type='application/json')

def get_player_stats_by_uuid(request, player_uuid):
	clean_up()
	player = Player.objects.get(player_uuid = player_uuid)
	player.save() # update last_play_time 
 	return HttpResponse('{status:"ok", player_id:%d, player_name:"%s", score:%d}' % (player.id, player.player_name, player.score), content_type='application/json')


def start_game(request, player_id):
	clean_up()
	player_id=int(player_id)
	player=Player.objects.get(id=player_id)
	cache = caches['default']

	#check if already assigned in a game
	game_id = cache.get(player_id)
	if game_id:
		game_id = int(game_id)
		game = Game.objects.get(id = game_id)
		opponent = game.opponent(player_id)
		print "already in game", game_id
		return HttpResponse('{status:"ok", game_id:%d, oppenent_id:%d, oppenent_name:"%s", opponent_score:%d}' % (game.id, opponent.id, opponent.player_name, opponent.score),
			content_type='application/json')

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
		return HttpResponse('{status:"ok", game_id:%d, oppenent_id:%d, oppenent_name:"%s", opponent_score:%d}' % (game.id, opponent.id, opponent.player_name, opponent.score),
			content_type='application/json')
	
	# queue the player
	cache.set('q', player_id)
	return HttpResponse('{status:"queued"}', content_type='application/json')

def player_cheat(request, player_id, game_id, cheat=True):
	cache = caches['default']

	game = Game.objects.get(id=int(game_id))
	player_id = int(player_id)
	player = Player.objects.get(id=player_id)
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
		return HttpResponse('{status:"ok", opponent_cheat:"%s", gain:%d, new_score:%d}' % (hecheat, pay, player.score), content_type='application/json')
	elif game.finish_time != None:  # opponent timed out
		return HttpResponse('{status:"opponent_timed_out"}', content_type='application/json')
	else:
		return HttpResponse('{status:"waiting"}', content_type='application/json')


def player_split(request, player_id, game_id):
	return player_cheat(request, player_id, game_id, False)

def player_timed_out(request, player_id, game_id):
	game = Game.objects.get(id=int(game_id))
	player = Player.objects.get(id=int(player_id))
	player.score -= TIMEOUT_PENALTY
	player.save()
	game.finish_time = datetime.now()
	game.save()
	return HttpResponse('{status:"timed_out", gain:%d, new_score:%d}' % (-TIMEOUT_PENALTY, player.score), content_type='application/json')


