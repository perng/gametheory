from autobahn.twisted.websocket import WebSocketServerProtocol, \
    WebSocketServerFactory
from twisted.python import log
from twisted.internet import reactor
import django, json, sys, logging
from gametheory.core.models import *
import views
import Queue
import threading


serial =1
class MyServerProtocol(WebSocketServerProtocol):

    def onConnect(self, request):
        print("Client connecting : {0}".format(request.peer))
        print 'request=',request
        try:
            self.ip=request.peer.split(':')[1]
            print 'connection from ', self.ip
            print 'port', request.peer.split(':')
            self.port=int(request.peer.split(':')[2])
        except:
            print 'something wrong with incoming request'
        self.player = None

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

    port = int(sys.argv[1]) 

    factory = WebSocketServerFactory("ws://localhost:%d" % (port,), debug=True)
    factory.gamerooms = {}  # dict of dict of queue,  game-->room-->queue
    # the following should be read from somewhere
    factory.game_specs = {}  # dict of dict game-->attrs
    factory.game_specs['gametheory']={}
    factory.game_specs['gametheory']['num_player'] = 2

    factory.gamerooms['gamethoery'] = {}
    factory.gamerooms['gamethoery']['room1']=Queue.Queue()
    factory.gamerooms['gamethoery']['room2']=Queue.Queue()

    factory.locks = {}
    for g in factory.gamerooms:
        factory.locks[g] = {}
        for r in factory.gamerooms[g]:
            factory.locks[g][r] = threading.Lock()


    factory.protocol = MyServerProtocol

    reactor.listenTCP(port, factory)
    reactor.run()
