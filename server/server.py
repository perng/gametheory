from autobahn.twisted.websocket import WebSocketServerProtocol, \
    WebSocketServerFactory
from twisted.python import log
from twisted.internet import reactor
import django, json, sys, logging
from gametheory.core.models import *
import game, player
from Queue import Queue
import threading

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
        #getattr(game, params['cmd'])(self, params)
        self.factory.methods[params['cmd']](self, params)
    def onClose(self, wasClean, code, reason):
        print("WebSocket connection closed: {0}".format(reason))

def create_gamerooms(factory):
    factory.gamerooms = {}
    factory.locks = {}
    gamerooms = GameRoom.objects.all()
    for gameroom in gamerooms:
        if gameroom.gamespec.name not in factory.gamerooms:
            factory.gamerooms[gameroom.gamespec.name] = {}
            factory.locks[gameroom.gamespec.name] = {}
        factory.gamerooms[gameroom.gamespec.name][gameroom.name] = Queue()
        factory.locks[gameroom.gamespec.name][gameroom.name] = threading.Lock()

def add_test_gamerooms():
    game, created = GameSpec.objects.get_or_create(name="Game Theory")
    game.save()
    gr, created = GameRoom.objects.get_or_create(gamespec = game, name = "Room 1", order = 0)
    gr.save()
    gr, created = GameRoom.objects.get_or_create(gamespec = game, name = "Room 2", order = 1)
    gr.save()

def methods():
    ans = []
    for modu in [game, player]:
        ans += modu.__dict__.items()
    return dict(ans)

if __name__ == '__main__':
    django.setup()
    logging.basicConfig(filename='example.log',level=logging.INFO)
    log.startLogging(sys.stdout)

    port = int(sys.argv[1]) 

    factory = WebSocketServerFactory("ws://localhost:%d" % (port,), debug=True)
    factory.methods = methods()

    add_test_gamerooms()
    create_gamerooms(factory)

    factory.locks = {}
    for g in factory.gamerooms:
        factory.locks[g] = {}
        for r in factory.gamerooms[g]:
            factory.locks[g][r] = threading.Lock()


    factory.protocol = MyServerProtocol

    reactor.listenTCP(port, factory)
    reactor.run()
