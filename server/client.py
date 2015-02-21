
from autobahn.twisted.websocket import WebSocketClientProtocol, \
    WebSocketClientFactory


class MyClientProtocol(WebSocketClientProtocol):


    def onConnect(self, response):
        self.counter = 0
        print("Server connected: {0}".format(response.peer))

    def onOpen(self):
        print("WebSocket connection open.")

        self.sendMessage(u'{"cwd":"get_player_id_by_id", "player_id":1}'.encode('utf8'), False)

    def onMessage(self, payload, isBinary):
        print "onMessage called"
        print payload
        if isBinary:
            print("Binary message received: {0} bytes".format(len(payload)))
        else:
            self.counter+=1
            print payload
            print("Text message received: {0}".format(payload.decode('utf8')))
            #self.sendMessage(u'{"cmd":"get_player_id_by_id", "player_id":1}'.encode('utf8'), False)

    def onClose(self, wasClean, code, reason):
        print("WebSocket connection closed: {0}".format(reason))


if __name__ == '__main__':

    import sys

    from twisted.python import log
    from twisted.internet import reactor

    log.startLogging(sys.stdout)

    factory = WebSocketClientFactory("ws://localhost:9000", debug=False)
    factory.protocol = MyClientProtocol

    reactor.connectTCP("127.0.0.1", 9000, factory)
    reactor.run()
