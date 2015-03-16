###############################################################################
#
# The MIT License (MIT)
#
# Copyright (c) Tavendo GmbH
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in
# all copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
# THE SOFTWARE.
#
###############################################################################

import sys
from twisted.internet import reactor
from autobahn.twisted.websocket import WebSocketClientFactory, \
    WebSocketClientProtocol, \
    connectWS

### xc.
from twisted.internet import stdio
from twisted.protocols import basic
import re

class DataForwardingProtocol(): #WebSocketClientProtocol):
    def __init__(self):
        self.output = None

    def dataReceived(self, data):
        if self.output:
            self.output.write(data)


class Echo(basic.LineReceiver):
    from os import linesep as delimiter

    def __init__(self, p):
        self.p = p

    def connectionMade(self):
        self.transport.write('>>> ')

    def lineReceived(self, line):
        #self.p.protocol.sendMessage("=============".encode('utf8'))
        #self.p.protocol.sendHello
        #self.p.sendHello()
        #self.p.hello
        #self.p.protocol.hello()
        #BroadcastClientProtocol().hello() # this works.
        #BroadcastClientProtocol().sendHello()
        self.sendLine('Echo: ' + line)
        self.transport.write('>>> ')
        self.p(line)


class BroadcastClientProtocol(WebSocketClientProtocol):

    """
    Simple client that connects to a WebSocket server, send a HELLO
    message every 2 seconds and print everything it receives.
    """

    def hello(self, msg):
        #print("hello")
        self.sendMessage(msg.encode('utf8'))

    def sendHello(self):
        self.sendMessage("Hello from Python!".encode('utf8'))
        #reactor.callLater(2, self.sendHello)

    def onOpen(self):
        self.sendHello()
        #self.hello()
        #stdio.StandardIO(Echo(BroadcastClientProtocol))
        stdio.StandardIO(Echo(self.hello))

        #inputForwarder = DataForwardingProtocol()
        #inputForwarder.output = self.hello
        #stdio.StandardIO(inputForwarder)
        #stdioWrapper = stdio.StandardIO(inputForwarder)
        #self.output = stdioWrapper

    def onMessage(self, payload, isBinary):
        if not isBinary:
            print("Text message received: {}".format(payload.decode('utf8')))


if __name__ == '__main__':

    if len(sys.argv) < 2:
        print("Need the WebSocket server address, i.e. ws://localhost:9000")
        sys.exit(1)

    #stdio.StandardIO(Echo())

    #stdio.StandardIO(BroadcastClientProtocol)
    factory = WebSocketClientFactory(sys.argv[1])
    factory.protocol = BroadcastClientProtocol
    connectWS(factory)

    #stdio.StandardIO(Echo(factory.protocol))
    #stdio.StandardIO(Echo(factory))

    reactor.run()

