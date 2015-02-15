from django.db import models

# Create your models here.


class Player(models.Model):
	player_name = models.CharField(max_length=100)
	score = models.IntegerField(default = 1200)

class Queue(models.Model):
	player = models.ForeignKey(Player)
	enter_time = models.DateTimeField(auto_now_add=True)
	last_pool_time = models.DateTimeField(auto_now_add=True, auto_now=True)


class Game(models.Model):
	player1 = models.ForeignKey(Player,related_name='gplayer1', null=True)
	player2 = models.ForeignKey(Player,related_name='gplayer2', null=True)
	player1cheat = models.NullBooleanField()
	player2cheat = models.NullBooleanField()
	start_time = models.DateTimeField(auto_now_add=True, null=True)
	finish_time = models.DateTimeField(auto_now=True, null=True)

