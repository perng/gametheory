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
    def __init__(self, data_store, game_room):
        self.game_room = game_room
        self.players = []
        self.waiting_player = Queue.Queue() # TODO implement queuing
        # self.kibitzers = {}  # TODO implement kibitzing
        self.lock = threading.Lock()
        self.status = WAITING
        for i in range(1, len(data_store.gametables)+2):
            if i not in data_store.gametables:
                self.id = i
                break
        #self.allow_kibitzing = game_room.gamespec.allow_kibitz
    def num_players(self):
        return len(self.players)

    def player_index(self, player):
        if type(player) == int:  # it's player_id
            for i in range(len(self.players)):
                if self.players[i].id == player:
                    return i
            else:
                return -1
        else:
            for i in range(len(self.players)):
                if self.players[i] == player:
                    return i
            else:
                return -1
    def delete_player(self, player):
        del self.players[self.player_index(player)]

    def waiting(self):
        return self.status == WAITING
    def full(self):
        return len(self.players)>= self.game_room.gamespec.num_players_max
    def empty(self):
        return len(self.players) == 0

    def leaders(self):
        num = min(2, self.num_players())
        return [p.id for p in self.players[:num]]

    def broadcast(self, sender_id, msg):
        BroadCast(sender_id, [p.socket for p in self.players], msg)

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
            self.players.append(player)
            result = JOIN_SUCCEED
            msg = {'cmd':'player_joined', 'player_id': player.id }
            BroadCast(player.id, [p.socket for p in self.players], msg)
        self.lock.release()

        # Game start if enough players, TODO: time-based game-start
        if self.num_players()>= self.game_room.gamespec.num_players_min:
            game = self.game_room.gamespec
            msg = {'table_id': self.id, 'cmd': 'game_start',
                   'players': [p.id for p in self.players]}
            self.status = PLAYING
            BroadCast(player.id, [p.socket for p in self.players], msg)
        player.gametables[self.id] = self
        return result

    def leave(self, player):
        if player.id not in self.players:
            return NOT_IN_TABLE
        self.delete_player(player)
        del player.gametables[self.id]
        msg = {'cmd':'player_left', 'player_id': player.id }
        BroadCast(player.id, [p.socket for p in self.players], msg)
        if self.num_players() < self.game_room.gamespec.num_players_min:
            self.status = WAITING

        return LEAVE_SUCCEED

    def stand(self, player):
        pass # TODO

    def num_players(self):
        return len(self.players)

    def get_players(self):
        return self.players


class RunTimeDataStore:
    ''' All runtime data, attached to factory
    '''
    def __init__(self, factory):
        self.factory = factory
        self.players = {}
        self.gamerooms = {} #room.id --> room
        self.gameroom_tables = {}  # room.id --> table.id --> table
        self.gametables = {}  # table.id --> table
        gamerooms = GameRoom.objects.all()
        for gameroom in gamerooms:
            self.gamerooms[gameroom.id] = gameroom
            self.gameroom_tables[gameroom.id] = {}


    def add_table(self, gameroom_id):
        gameroom = self.gamerooms[int(gameroom_id)]
        table = GameTable(self, gameroom)
        self.gameroom_tables[gameroom.id][table.id] = table
        self.gametables[table.id] = table
        return table

    def get_tables(self, gameroom_id):
        found_the_first = False
        gameroom_id = int(gameroom_id)
        keys = self.gameroom_tables[gameroom_id]
        keys.sort()
        to_be_deleted = []
        for table_id in keys:
            table = self.gamerooms[gameroom_id][table_id]
            if table.empty():
                if found_the_first:
                    to_be_deleted.append(table_id)
                else:
                    found_the_first = True
        for table_id in to_be_deleted:
            del self.gameroom_tables[gameroom_id][table_id]
            del self.gametables[table_id]
        if len(self.gameroom_tables[gameroom_id]) == 0:
            self.add_table(gameroom_id)
        return self.gameroom_tables[gameroom_id]



    def sit_to_play_auto_match(self, player, gameroom):
        # find or create a table
        gametables = self.gameroom_tables[gameroom.id]
        for table in gametables.values():
            print 'table', table.id, ' waiting:', table.waiting(), ' full:', table.full()
            if table.waiting() and not table.full():
                table.sit(player)
                return table
        else:
            table = self.add_table(gameroom.id)
            table.sit(player)
            print 'created new table', table.id
        # either way, table
        return table
