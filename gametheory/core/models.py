from django.db import models
from django.contrib import admin

class Player(models.Model):
    player_name = models.CharField(max_length=100)
    player_uuid = models.CharField(max_length=40)
    uuid_type = models.CharField(max_length=40)
    score = models.IntegerField(default = 1200)
    level = models.IntegerField(default = 1)
    xp = models.IntegerField(default = 0)
    gem = models.IntegerField(default = 0)

    join_time = models.DateTimeField(auto_now_add=True, null=True)
    last_play_time = models.DateTimeField(auto_now=True, null=True)

    ip_address = models.CharField(max_length=20, null=True)
    country = models.CharField(max_length=50, null=True)
    state = models.CharField(max_length=30, null=True)
    city =  models.CharField(max_length=30, null=True)
    zipcode =  models.CharField(max_length=10, null=True)
    long = models.FloatField(null=True)
    lat = models.FloatField(null=True)
    def stats(self):
        return {'player_id': self.id, 'player_name': self.player_name,
              'score': self.score, 'xp': self.xp, 'level': self.level, 'gem': self.gem}
    def __str__(self):
        return self.player_name+':'+self.player_uuid
class PlayerAdmin(admin.ModelAdmin):
    fields = ['player_name', 'player_uuid', 'score', 'ip_address',
              'country','state', 'city']
admin.site.register(Player, PlayerAdmin)


class GameResult(models.Model):
    game_record = models.ForeignKey('GameRecord')
    player = models.ForeignKey(Player)
    is_winner = models.BooleanField(default=False)
    score = models.IntegerField(null=True)
    rank = models.IntegerField(null=True)

class GameRecord(models.Model):
    players = models.ManyToManyField(Player, through=GameResult)
    start_time = models.DateTimeField(auto_now_add=True, null=True)
    finish_time = models.DateTimeField(auto_now_add=True, null=True)

    def __str__(self):
        player_names = '-'.join(p.player_name for p in self.players.all())
        return '%d:%s %s' % (self.id, player_names, str(self.start_time))
    def opponents(self, my_id):
        return [p for p in self.players.all() if p.id != my_id]

class GameRecordAdmin(admin.ModelAdmin):
    fields = [
              'start_time', 'finish_time']
admin.site.register(GameRecord, GameRecordAdmin)
