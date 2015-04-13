#!/usr/bin/python

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

#
# This is modified from the code of T. GmbH,
# by adding Echo class, which accepts local stdio input and send to server.
# Modified BroadcastClientProtocol class to register Echo class.
# X. Chen, 3/15/2015 
#

import sys
from twisted.internet import reactor
from autobahn.twisted.websocket import WebSocketClientFactory, \
    WebSocketClientProtocol, \
    connectWS

# Used by Echo().
from twisted.internet import stdio
from twisted.protocols import basic
import re

class Echo(basic.LineReceiver):
    """
    Receive stdin input from usr, and send to server.
    """

    from os import linesep as delimiter

    def __init__(self, sendmsg):
        self.sendMsg = sendmsg

    def connectionMade(self):
        self.transport.write('>>> ')

    def lineReceived(self, line):
        #self.sendLine('Echo: ' + line)
        self.transport.write('>>> ')
        if line == "exit":
            print "EXIT"  # flush buffer
            sys.stdout.flush()
            reactor.stop()  # exit program
            return
        if line != "":
            self.sendMsg(line)


class BroadcastClientProtocol(WebSocketClientProtocol):

    """
    Simple client that connects to a WebSocket server, send a HELLO
    message every 2 seconds and print everything it receives.
    """

    def sendMsg(self, msg): 
        if msg != "":
            self.sendMessage(msg.encode('utf8'))

    def sendHello(self):
        self.sendMessage("Hello from Python!".encode('utf8'))
        #reactor.callLater(5, self.sendHello)

    def onOpen(self):
        #self.sendHello()
        stdio.StandardIO(Echo(self.sendMsg))  # register stdio. X.C. 

    def onMessage(self, payload, isBinary):
        if not isBinary:
            #sys.stdout.write('\r') # carriage return, to overwrite previous ">>> ".
            print("Text message received: {}".format(payload.decode('utf8')))
            print(">>> "),  # print without new line.
            sys.stdout.flush()


if __name__ == '__main__':

    if len(sys.argv) < 2:
        print("Need the WebSocket server address, i.e. ws://localhost:9001")
        sys.exit(1)

    factory = WebSocketClientFactory(sys.argv[1])
    factory.protocol = BroadcastClientProtocol
    connectWS(factory)

    reactor.run()

