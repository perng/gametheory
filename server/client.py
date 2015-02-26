import time, json

from autobahn.twisted.websocket import WebSocketClientProtocol, \
    WebSocketClientFactory

STATUS_OK = {"status":"ok"}
cmd_response =[
#                ({"cmd":"noop"}, STATUS_OK ),
                ({"cmd":"register", "uuid":"bcde", "uuid_type":"fb", "player_name":"Charles Perng"}, STATUS_OK), 
            ]

class MyClientProtocol(WebSocketClientProtocol):

    def onConnect(self, response):
        self.current_test = 0
        print("Server connected: {0}".format(response.peer))

    def onOpen(self):
        print("WebSocket connection open.")
        self.test()

    def onMessage(self, payload, isBinary):
        print "onMessage called"
        print("Text message received: {0}".format(payload.decode('utf8')))
        self.test(payload)
            #self.sendMessage(u'{"cmd":"get_player_id_by_id", "player_id":1}'.encode('utf8'), False)

    def onClose(self, wasClean, code, reason):
        print("WebSocket connection closed: {0}".format(reason))

    def sendMsg(self, msg):
        msg=json.dumps(msg)
        self.sendMessage(msg.encode('utf8'), False)

    def test(self, response=None):
        print 'current_test', self.current_test
        print 'test called, response=', response
        if response:
            print 'response type', type(response)
            responsejson = json.loads(response)
            print cmd_response[self.current_test][1]
            if 'msg' in responsejson:
                print 'msg=',responsejson['msg']
            for k in cmd_response[self.current_test][1]:
                assert responsejson[k] == cmd_response[self.current_test][1][k]
            print "Test OK!"
            self.current_test += 1
            #if self.current_test >= len(cmd_response):
            #    self.sendClose()

        print 'current_test', self.current_test
        if self.current_test < len(cmd_response):
            time.sleep(5)
            print 'send:',cmd_response[self.current_test][0]
            self.sendMsg(cmd_response[self.current_test][0])
            time.sleep(5)


if __name__ == '__main__':

    import sys

    from twisted.python import log
    from twisted.internet import reactor

    log.startLogging(sys.stdout)

    if len(sys.argv) >= 2 and sys.argv[1]=='remote':
        print 'connect to gametheory.olidu.com:9000'
        factory = WebSocketClientFactory("ws://gametheory.olidu.com:9000", debug=False)
    else:
        factory = WebSocketClientFactory("ws://localhost:9000", debug=False)
    factory.protocol = MyClientProtocol

    reactor.connectTCP("127.0.0.1", 9000, factory)
    reactor.run()
