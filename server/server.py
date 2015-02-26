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
            print request.peer
            self.ip=request.peer.split(':')[1]
            print 'connection from ', self.ip
        except:
            print 'something wrong with incoming request'

    def onOpen(self):
        print("WebSocket connection open.")

    def onMessage(self, payload, isBinary):
        print 'received:', payload
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
    factory.protocol = MyServerProtocol

    reactor.listenTCP(port, factory)
    reactor.run()
