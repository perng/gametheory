from django.db import models
from django.contrib import admin

class GameSpec(models.Model):
    name =  models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=100, null=True)
    # whether a player is automatically matched with opponents or
    auto_match = models.BooleanField(default=True)
    # whether player join a table after the table is marked 'playing'
    accept_player_while_playing = models.BooleanField(default=False)
    # allow people observe a table without participate
    allow_kibitz = models.BooleanField(default=True)

    num_players_min = models.IntegerField(default=2)
    num_players_max = models.IntegerField(default=2)
    matching_time_min = models.IntegerField(default=0) # second
    matching_time_max = models.IntegerField(default=15) # second
    starting_score = models.IntegerField(default=1200)
    starting_xp = models.IntegerField(default=0)
    starting_level = models.IntegerField(default=1)
    starting_gem = models.IntegerField(default=10)
    def __str__(self):
        return self.name
admin.site.register(GameSpec)

class GameRoom(models.Model):
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=100, null=True)
    gamespec = models.ForeignKey(GameSpec)
    order = models.IntegerField()
admin.site.register(GameRoom)


class PlayerStats(models.Model):
    player = models.ForeignKey('Player')
    game = models.ForeignKey(GameSpec)
    score = models.IntegerField(default = 0)
    level = models.IntegerField(default = 1)
    xp = models.IntegerField(default = 0)
    gem = models.IntegerField(default = 0)
    def details(self):
        return {'player_id': self.player.id, 'score': self.score, 'level': self.level,
                'xp': self.xp, 'gem': self.gem}
admin.site.register(PlayerStats)

class Player(models.Model):
    player_name = models.CharField(max_length=100)
    uuid = models.CharField(max_length=40)
    password = models.CharField(max_length=40)
    uuid_type = models.CharField(max_length=40)
    join_time = models.DateTimeField(auto_now_add=True, null=True)
    last_play_time = models.DateTimeField(auto_now=True, null=True)

    games = models.ManyToManyField(GameSpec, through=PlayerStats)

    ip_address = models.CharField(max_length=20, default='')
    country = models.CharField(max_length=50, default='')
    state = models.CharField(max_length=30, default='')
    city =  models.CharField(max_length=30, default='')
    zipcode =  models.CharField(max_length=10, default='')
    long = models.FloatField(default=-1)
    lat = models.FloatField(default=-1)
    friends = models.ManyToManyField('Player')
    def info(self):
        return {'player_id': self.id, 'player_name': self.player_name,
                'ip_address': self.ip_address,
                #'country': self.country,
                #'state': self.state, 'city': self.city, 'zipcode': self.zipcode,
                #'long': self.long, 'lat': self.lat
        }

    def get_states_by_gamespec(self, game):
        stats, created =PlayerStats.objects.get_or_create(player = self, game = game)
        if created:
            stats.score = game.starting_score
            stats.xp = game.starting_xp
            stats.level = game.starting_level
            stats.gem = game.starting_gem
            stats.save()

        try:
            self.game_stats[game.name] = stats
        except:
            self.game_stats = {game.name : stats}

        return stats


    def get_stats_by_name(self, game_name):
        try:
            return self.game_stats[game_name]
        except:
            pass
        try:
            game = GameSpec.objects.get(name=game_name)
        except:
            return None
        return self.get_states_by_gamespec(game)



    def __str__(self):
        return self.player_name+':'+self.player_uuid

admin.site.register(Player)


class GameResult(models.Model):
    game_record = models.ForeignKey('GameRecord')
    player = models.ForeignKey(Player)
    is_winner = models.BooleanField(default=False)
    score = models.IntegerField(null=True)
    rank = models.IntegerField(null=True)
admin.site.register(GameResult)

class GameRecord(models.Model):
    players = models.ManyToManyField(Player, through=GameResult)
    start_time = models.DateTimeField(auto_now_add=True, null=True)
    finish_time = models.DateTimeField(auto_now_add=True, null=True)

    def __str__(self):
        player_names = '-'.join(p.player_name for p in self.players.all())
        return '%d:%s %s' % (self.id, player_names, str(self.start_time))
    def opponents(self, my_id):
        return [p for p in self.players.all() if p.id != my_id]

admin.site.register(GameRecord)
