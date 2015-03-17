__author__ = 'perng'
from gametheory.core.models import *
from utils import *
import threading
import Queue

# Table status
PLAYING = 'PLAYING'
WAITING = 'WAITING'

# join table result
JOIN_SUCCEED = 0
LEAVE_SUCCEED = 0
ALREADY_JOINED = 1
TABLE_FULL = 2
NOT_IN_TABLE = 3


class GameTable:
    def __init__(self, game_room):
        self.game_room = game_room
        self.players = {}
        self.waiting_player = Queue.Queue() # TODO implement queuing
        # self.kibitzers = {}  # TODO implement kibitzing
        self.lock = threading.Lock()
        self.status = WAITING
        #self.allow_kibitzing = game_room.gamespec.allow_kibitz

    def waiting(self):
        return self.status == WAITING
    def full(self):
        return len(self.players)>= self.game_room.gamespec.num_players_max

    def sit(self, player):
        '''
        :param player: the player (full object) to sit and play
        :return: join result
        '''
        # check if seat available
        if len(self.players)>= self.game_room.gamespec.num_players_max:
            return TABLE_FULL
        # TODO: check if table allow siting while marked PLAYING
        # TODO: if playing is kibitzing, remove from it

        self.lock.acquire(True)
        if player.id in self.players:
            result = ALREADY_JOINED
        else:
            self.players[player.id] = player
            result = JOIN_SUCCEED
            msg = {'msg_type':'player_joined', 'player_id': player.id }
            BroadCast(self.players.values(), msg)
        self.lock.release()

        # Game start if enough players, TODO: time-based game-start
        if self.num_players()>= self.game_room.gamespec.num_players_min:
            game = self.game_room.gamespec
            msg = {'msg_type': 'game_start',
                   'players': []}
        return result

    def leave(self, player):
        if player.id not in self.players:
            return NOT_IN_TABLE
        self.lock.acquire(True)
        del self.players[player.id]
        self.lock.release()
        msg = {'msg_type':'player_left', 'player_id': player.id }
        for player in self.players.values():
            SendMessage(player.socket, msg)
        return LEAVE_SUCCEED

    def stand(self, player):
        pass # TODO

    def num_players(self):
        return len(self.players)

    def get_players(self):
        return self.players.values()


class RunTimeDataStore:
    ''' All runtime data, attached to factory
    '''
    def __init__(self, factory):
        self.factory = factory
        self.gamerooms = {}
        self.gametables = {}
        gamerooms = GameRoom.objects.all()
        for gameroom in gamerooms:
            self.gamerooms[gameroom.id] = gameroom
            self.gametables[gameroom.id] = {}

    def sit_to_play(self, player, gameroom):
        # find or create a table
        gametables = self.gametables[gameroom.id]
        for table in gametables:
            if table.waiting() and not table.full():
                table.sit(player)
                break
        else:
            table = GameTable(gameroom)
            table.sit(player)


