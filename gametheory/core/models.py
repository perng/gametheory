from django.db import models
from django.contrib import admin

class Player(models.Model):
	player_name = models.CharField(max_length=100)
	player_uuid = models.CharField(max_length=40)
	score = models.IntegerField(default = 1200)
	join_time = models.DateTimeField(auto_now_add=True, null=True)
	last_play_time = models.DateTimeField(auto_now=True, null=True)
	def __str__(self):
		return self.player_name+':'+self.player_uuid
class PlayerAdmin(admin.ModelAdmin):
	fields = ['player_name', 'player_uuid', 'score', 
			'join_time', 'last_play_time']
admin.site.register(Player, PlayerAdmin)


class Game(models.Model):
	player1 = models.ForeignKey(Player,related_name='gplayer1', null=True)
	player2 = models.ForeignKey(Player,related_name='gplayer2', null=True)
	player1cheat = models.NullBooleanField()
	player2cheat = models.NullBooleanField()
	start_time = models.DateTimeField(auto_now_add=True, null=True)
	finish_time = models.DateTimeField(auto_now=True, null=True)
	def __str__(self):
		return '%d:%s-%s %s-%s' % (self.id,self.player1, 
			self.player2, self.player1cheat, self.player2cheat)

	def opponent(self, my_id):
		if self.player1.id == my_id:
			return self.player2
		return self.player1
class GameAdmin(admin.ModelAdmin):
	fields = ['player_1', 'player2', 'player1cheat', 'player2cheat',
				'start_time', 'finish_time']
admin.site.register(Game, GameAdmin)
