import time, json, sys
from server.game import OK, WAITING, ERROR
from autobahn.twisted.websocket import WebSocketClientProtocol, \
    WebSocketClientFactory
import argparse
from twisted.python import log
from twisted.internet import reactor
from test_engine import *


STATUS_OK = {'status': 'ok'}
cmd_response = [
    ({'cmd': 'noop'}, STATUS_OK ),
    ({'cmd': 'register', 'uuid': 'bcde', 'uuid_type': 'fb', 'player_name': 'Charles Perng'}, STATUS_OK),
]


class MyClientProtocol(WebSocketClientProtocol):
    def onConnect(self, response):
        self.current_test = 0
        self.peer_msg_count = 0
        self.datum = {}
        print('Server connected: {0}'.format(response.peer))

    def onOpen(self):
        print('WebSocket connection open.')
        self.test({})

    def onMessage(self, payload, isBinary):
        print('Text message received: {0}'.format(payload.decode('utf8')))
        self.test(payload)

    def onClose(self, wasClean, code, reason):
        print('WebSocket connection closed: {0}'.format(reason))

    def sendMsg(self, msg):
        msg = json.dumps(msg)
        print 'to send:', msg
        self.sendMessage(msg.encode('utf8'), False)

    def test(self, response):
        actions = self.factory.actions
        if not response:
            return self.sendMsg(actions.first.emit(self.datum))
        response = json.loads(response)
        for wait in actions.waits:
            if wait.satisfy(response):
                print 'satisfy', wait.conditions
                msg = wait.receive(response, self.datum)
                if msg:
                    return self.sendMsg(msg)
                return None

        if '_tracker' in response:
            action = actions.get(response['_tracker'])
            msg = action.receive(response, self.datum)
            if msg:
                self.sendMsg(msg)
            else:
                print 'ALL TESTS DONE!'

    def xxx(self):
        rjson = response = None
        if 'cmd' in rjson:  # server initiated msg
            sys_msg = rjson['cmd']
            if sys_msg == 'game_start':
                self.opponents = [p for p in rjson['players'] if p!= self.player_id]
                self.table_id = rjson['table_id']
                return self.sendMsg({'cmd': 'get_leaders', 'table_id': self.table_id }, 9)
            if sys_msg == 'peer_message':
                print 'Peer Message:', rjson['message']
                self.peer_msg_count += 1
                print "# peer messages", self.peer_msg_count
                if self.peer_msg_count>=2:
                    return  self.sendMsg({'cmd': 'leave_table', 'table_id': self.table_id }, 11)
            return


        try:
            tracker = rjson['_tracker']
        except:
            return
        if tracker == 0:
            assert rjson['status'] == OK
            print 'NOOP Test OK'
            return self.sendMsg({'cmd': 'get_games'}, 1)
        if tracker == 1:
            assert len(rjson['games']) >0
            print 'Games:', rjson['games']
            print 'get_game_names test OK'
            game = rjson['games'][0]['game_name']
            return self.sendMsg({'cmd': 'get_game_rooms', 'game_name': game}, 2)
        if tracker == 2:
            print rjson
            assert len(rjson['game_rooms']) >= 2
            print 'Game room:', rjson['game_rooms']
            print 'get_game_rooms test OK'
            self.gamerooms = rjson['game_rooms']

            uuid = self.factory.args.uuid if self.factory.args.uuid else 'bcde'
            username = self.factory.args.username if self.factory.args.username else 'Charles Perng'
            return self.sendMsg({'cmd': 'register', 'uuid': uuid, 'uuid_type': 'FB',
                                     'player_name': username}, 3)
        if tracker == 3:
            assert rjson['status'] == OK
            print 'Register Test OK'
            self.player_id = rjson['player_id']
            print 'player_id:', self.player_id
            return self.sendMsg({'cmd': 'login', 'player_id': self.player_id}, 4)
        if tracker == 4:
            assert rjson['status'] == OK
            print 'Login Test OK'
            return self.sendMsg({'cmd':'get_my_stats', 'game_name':'Game Theory'}, 5)
        if tracker == 5:
            assert rjson['status'] == OK
            print 'stats =', response
            print 'get_my_stats Test OK'
            return self.sendMsg({'cmd':'get_player_stats', 'player_id':self.player_id, 'game_name':'Game Theory'}, 6)
        if tracker == 6:
            assert rjson['status'] == OK
            print 'get_player_stats Test OK'
            print 'current player stats is', response
            return self.sendMsg({'cmd': 'update_stats', 'score': +123,
                                 'level': +1, 'gem': -1, 'game_name': 'Game Theory', 'player_id': self.player_id},
                                7)
        if tracker == 7:
            assert rjson['status'] == OK
            print 'update_stats Test OK'
            print 'current player stats is', response
            print 'gamerooms', self.gamerooms
            return self.sendMsg({'cmd': 'sit_for_auto_match_game', 'room_id': self.gamerooms[0]['room_id']}, 8)

        if tracker == 8:
            assert rjson['status'] == OK
            return
            #print 'Get Game room Test OK!  game rooms:', rjson['game_rooms']
        if tracker == 9:  # get_leaders
            assert rjson['status'] == OK
            print 'leaders=', rjson['leaders']
            msg = "Message from player %d: messages  can be any format encoded as string." % self.player_id
            return self.sendMsg({'cmd': 'broadcast_in_table', 'table_id': self.table_id, 'message': msg}, 10)
        if tracker == 11:  # get_leaders
            assert rjson['status'] == OK
            return
        else:
            print 'received', rjson
            return
        self.sendClose()


def setup_actions(factory):
    actions = Actions()
    actions.add(Action('noop'))
    actions.add(Action('get_games', extract_attrs={'game_name': (lambda state, message: message['games'][0]['game_name'])}))
    actions.add(Action('get_game_rooms',extract_attrs={'room_id':(lambda s,m:m['game_rooms'][0]['room_id'])},
                       out_attrs=['game_name']))

    # register_by_password
    username = factory.args.username if factory.args.username else 'Charles Perng'

    action = Action('register_by_password', settings={'password': 'bababa', 'player_name': username })
    actions.add(action)
    action = Action('login_by_password', settings={'password': 'bababa', 'player_name': username })
    actions.add(action)

    # register_by_uuid
    uuid = factory.args.uuid if factory.args.uuid else 'bcde'
    username = factory.args.username if factory.args.username else 'George Washington'
    action = Action('login_by_uuid', settings={'uuid': uuid, 'uuid_type': 'FB', 'player_name': username })
    actions.add(action)


    actions.add(Action('get_my_stats', settings={'game_name':'Game Theory'}))
    actions.add(Action('get_player_stats', settings={'player_id': 2, 'game_name':'Game Theory'}))
    actions.add(Action('sit_for_auto_match_game', out_attrs=['room_id']))

    wait_game_start1 = Wait('', {'game_status': 'PLAYING'}, keep_attrs=['table_id'])
    wait_game_start2 = Wait('game_start', {}, keep_attrs=['table_id'])
    actions.add_wait(wait_game_start1)
    actions.add_wait(wait_game_start2)
    get_leader = Action('get_leader', out_attrs=['table_id'])
    wait_game_start1.next=get_leader
    wait_game_start2.next=get_leader
    actions.add(get_leader, start_over=True)
    msg = 'This is a broadcast message'
    actions.add(Action('broadcast_in_table', settings={'message':msg}, out_attrs=['table_id']))

    return actions


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Client emaulation with unit tests.')
    parser.add_argument('--username', dest='username', help='user name', )
    parser.add_argument('--uuid', dest='uuid', help='uuid')
    parser.add_argument('--remote', dest='remote', help='Server is remote')

    log.startLogging(sys.stdout)
    args = parser.parse_args()

    host = 'gametheory.olidu.com' if args.remote else '127.0.0.1'  #'localhost'
    port = 80 if args.remote else 9000
    url = 'ws://{0}:{1}'.format(host, port)
    print 'use url:', url
    factory = WebSocketClientFactory(url, debug=True)
    factory.protocol = MyClientProtocol
    factory.args = args


    factory.actions = setup_actions(factory)

    reactor.connectTCP(host, port, factory)

    reactor.run()
