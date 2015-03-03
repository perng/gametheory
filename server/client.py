import time, json
from views import OK, WAITING, ERROR
from autobahn.twisted.websocket import WebSocketClientProtocol, \
    WebSocketClientFactory

STATUS_OK = {"status": "ok"}
cmd_response = [
    ({"cmd": "noop"}, STATUS_OK ),
    ({"cmd": "register", "uuid": "bcde", "uuid_type": "fb", "player_name": "Charles Perng"}, STATUS_OK),
]


class MyClientProtocol(WebSocketClientProtocol):
    def onConnect(self, response):
        self.current_test = 0
        print("Server connected: {0}".format(response.peer))

    def onOpen(self):
        print("WebSocket connection open.")
        self.test({})

    def onMessage(self, payload, isBinary):
        print "onMessage called"
        print("Text message received: {0}".format(payload.decode('utf8')))
        self.test(payload)
        # self.sendMessage(u'{"cmd":"get_player_id_by_id", "player_id":1}'.encode('utf8'), False)

    def onClose(self, wasClean, code, reason):
        print("WebSocket connection closed: {0}".format(reason))

    def sendMsg(self, msg, tracker):
        msg['_tracker'] = tracker
        msg = json.dumps(msg)
        self.sendMessage(msg.encode('utf8'), False)

    def test(self, response):
        if not response:
            return self.sendMsg({"cmd": "noop"}, 0)
        rjson = json.loads(response)
        tracker = rjson['_tracker']
        if tracker == 0:
            assert rjson['status'] == OK
            print 'NOOP Test OK'
            return self.sendMsg({"cmd": "get_game_names"}, 1)
        if tracker == 1:
            assert len(rjson['game_names']) >0
            print 'Game names:', rjson['game_names']
            print 'get_game_names test OK'
            game = rjson['game_names'][0]
            return self.sendMsg({"cmd": "get_game_rooms", 'game_name': game}, 2)
        if tracker == 2:
            print rjson
            assert len(rjson['game_rooms']) >= 2
            print 'Game room:', rjson['game_rooms']
            print 'get_game_rooms test OK'
            return self.sendMsg({"cmd": "register", "uuid": "bcde", "uuid_type": "FB",
                                     "player_name": "Charles Perng"}, 3)
        if tracker == 3:
            assert rjson['status'] == OK
            print 'Register Test OK'
            self.player_id = rjson['player_id']
            print 'player_id:', self.player_id
            return self.sendMsg({"cmd": "login", "player_id": self.player_id}, 4)
        if tracker == 4:
            assert rjson['status'] == OK
            print 'Login Test OK'
            return self.sendMsg({"cmd":"get_my_stats", 'game_name':"gametheory"}, 5)
        if tracker == 5:
            assert rjson['status'] == OK

            print 'Get Game room Test OK!  game rooms:', rjson['game_rooms']
        self.sendClose()



if __name__ == '__main__':

    import sys

    from twisted.python import log
    from twisted.internet import reactor

    log.startLogging(sys.stdout)

    if len(sys.argv) >= 2 and sys.argv[1] == 'remote':
        print 'connect to gametheory.olidu.com:9000'
        factory = WebSocketClientFactory("ws://gametheory.olidu.com:9000", debug=False)
    else:
        factory = WebSocketClientFactory("ws://localhost:9000", debug=False)
    factory.protocol = MyClientProtocol

    reactor.connectTCP("127.0.0.1", 9000, factory)
    reactor.run()
