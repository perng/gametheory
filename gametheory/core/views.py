from django.shortcuts import render
from django.http import HttpResponse
from models import Player, Queue, Game
from datetime import datetime
from datetime import timedelta
from gametheory.settings import WAITING_TIMEOUT, payout
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

def index(request):
    return HttpResponse("Hello, world. ")

def get_player_stats(request, player_name):
	clean_up()
	player, created = Player.objects.get_or_create(player_name=player_name)
	if created:
		player.save()
 	return HttpResponse('{status:"ok", player_id:%d, score:%d}' % (player.id, player.score))

def start_game(request, player_id):
	player_id=int(player_id)
	player=Player.objects.get(id=player_id)

	#check if already assigned in a game
	games = Game.objects.filter(player2=player_id, player2cheat=None)[:]
	if len(games)==1:
		game=games[0]
		opponent = game.player2 if game.player1.id==player_id else game.player1
		return HttpResponse('{status:"ok", game_id:%d, oppenent_id:%d, oppenent_name:"%s", opponent_score:%d}' % (game.id, opponent.id, opponent.player_name, opponent.score))

	# check if there are any oppenent in queue, if so, create game table
	try:		
		queue = Queue.objects.filter(last_pool_time__gte = datetime.now()-timedelta(seconds=WAITING_TIMEOUT)).exclude(id = player_id).order_by('enter_time')[0]
		opponent = queue.player
		queue.delete()
		game = Game(player1=player, player2=opponent)
		game.save()
		return HttpResponse('{status:"ok", game_id:%d, oppenent_id:%d, oppenent_name:"%s", opponent_score:%d}' % (game.id, opponent.id, opponent.player_name, opponent.score))
	except IndexError:
		pass

	# queue the player
	queue, created = Queue.objects.get_or_create(player = player)
	queue.save()  # refresh last_pool_time if not first created
	return HttpResponse('{status:"queued"}')

def player_cheat(request, player_id, game_id, cheat=True):
	game = Game.objects.get(id=int(game_id))
	player_id = int(player_id)
	player = Player.objects.get(id=player_id)

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
		return HttpResponse('{status:"ok", opponent_cheat:"%s", gain:%d, new_score:%d}' % (hecheat, pay, player.score))
	else:
		return HttpResponse('{status:"waiting"}')


def player_split(request, player_id, game_id):
	return player_cheat(request, player_id, game_id, False)

