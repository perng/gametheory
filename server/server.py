from autobahn.twisted.websocket import WebSocketServerProtocol, \
    WebSocketServerFactory
from twisted.python import log
from twisted.internet import reactor
import django, json, sys, logging
from gametheory.core.models import *
import views


serial =1
class MyServerProtocol(WebSocketServerProtocol):

    def onConnect(self, request):
        print("Client connecting : {0}".format(request.peer))
        print 'request=',request
        try:
            self.ip=request.peer.split(':')[1]
            self.port=int(request.peer.split(':')[2])
        except:
            print 'something wrong with incoming request'
        self.player_id = -1

    def onOpen(self):
        print("WebSocket connection open.")

    def onMessage(self, payload, isBinary):
        print 'from port', self.port, 'received:', payload
        params=json.loads(payload)
        getattr(views, params['cmd'])(self, params)

    def onClose(self, wasClean, code, reason):
        print("WebSocket connection closed: {0}".format(reason))


if __name__ == '__main__':
    django.setup()
    logging.basicConfig(filename='example.log',level=logging.INFO)
    log.startLogging(sys.stdout)

    factory = WebSocketServerFactory("ws://localhost:9000", debug=False)
    factory.protocol = MyServerProtocol

    reactor.listenTCP(9000, factory)
    reactor.run()
