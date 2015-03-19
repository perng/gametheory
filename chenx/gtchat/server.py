#!/usr/bin/python

###############################################################################
#
# The MIT License (MIT)
#
# Copyright (c) Tavendo GmbH, X. Chen
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
# Modifications: 
# 1) avoid send to self when broadcast, 
# 2) output format.
# 3) add API_chatroom
# X.C. (3/15/2015 -  )
# 

import sys
import json, time

from twisted.internet import reactor
from twisted.python import log
from twisted.web.server import Site
from twisted.web.static import File

from autobahn.twisted.websocket import WebSocketServerFactory, \
    WebSocketServerProtocol, \
    listenWS


DEBUG = False

#
# Databases
#

# entry = name:pwd 
T_users = {}
T_users_src = {} # entry = name:src. E.g., usr1:tcp4:127.0.0.1:57778

# entry = name:type,room. type=reg|tmp
T_users_active = {}

# entry = name:user_list
T_rooms = {} 


class API_Chatroom():
    def __init__(self):
        pass

    def handler(self, msg, src):
        if DEBUG:
            print(' ')
            print ('==' + src + ':: ' + msg)

        try:
            self.params = json.loads(msg)

            cmd = self.get_param('cmd')
            usr = self.get_param('usr')
            if DEBUG: print("cmd = " + cmd + ", usr = " + usr)

            if cmd == "register":
                pwd = self.get_param('pwd')
                self.api_register(usr, pwd, src)

            elif cmd == "login":
                type = self.get_param('type')
                pwd = self.get_param('pwd') if type == 'reg' else ''
                self.api_login(type, usr, pwd, src)

            elif cmd == "update_pwd":
                old_pwd = self.get_param('pwd')
                new_pwd = self.get_param('new_pwd')
                new_pwd2 = self.get_param('new_pwd2')
                self.api_update_pwd(usr, old_pwd, new_pwd, new_pwd2, src)

            elif cmd == "create_room":
                room_name = self.get_param('room_name')
                self.api_create_room(room_name, usr, src)

            elif cmd == "invite":
                invitee = self.get_param('invitee')
                room_name = self.get_param('room_name')
                self.api_invite(invitee, room_name, usr, src)

            elif cmd == "join_room":
                room_name = self.get_param('room_name')
                self.api_join_room(room_name, usr, src)

            elif cmd == "leave_room":
                room_name = self.get_param('room_name')
                self.api_leave_room(room_name, usr, src)

            elif cmd == "speak":
                msg = self.get_param('msg')
                room_name = self.get_param('room_name')
                self.api_speak(msg, room_name, usr, src)

        except Exception as err:
            #return JsonResponse(FAIL)
            #print(err.args)
            sys.stdout.write(":exception: ")
            print(err)
            return "failed:" + str(err)

        return "ok"


    def get_param(self, param):
        if not self.params.get(param):
            raise Exception("invalid request parameter: " + param)
        return self.params[param]


    def api_speak(self, msg, room_name, usr, src):
        pass


    def api_create_room(self, room_name, usr, src):
        pass


    def api_invite(self, invitee, room_name, usr, src):
        pass


    def api_join_room(self, room_name, usr, src):
        pass


    def api_leave_room(self, room_name, usr, src):
        pass


    def api_login(self, type, usr, pwd, src):
        if (type == 'reg'): # register user
            if usr not in T_users or T_users[usr] != pwd:
                raise Exception("invalid login information")
        else: # 'tmp'. anonymous user
            if usr in T_users:
                raise Exception("this username already exists (1)")

        T_users_active[usr] = src

 
    def api_update_pwd(self, usr, old_pwd, new_pwd, new_pwd2, src):
        if (new_pwd != new_pwd2):
            raise Exception("two new password do not match")
        if (len(new_pwd) < 8):
            raise Exception("new password length should >= 8")
        if not usr in T_users:
            raise Exception("this username does not exist")
        if old_pwd != T_users[usr]:
            raise Exception("old password does not match")

        T_users[usr] = new_pwd

        if DEBUG: 
            self.dump_db("T_users", T_users)


    def api_register(self, usr, pwd, src):
        if len(usr) == 0:
            raise Exception("invalid user name")
        if len(pwd) < 8:
            raise Exception("user password length should >= 8")

        if usr in T_users:
            raise Exception("this username already exists (0)")

        # add new user to database.
        T_users[usr] = pwd
        T_users_src[usr] = src

        if DEBUG:
            self.dump_db("T_users", T_users)
            self.dump_db("T_users_src", T_users_src)


    def dump_db(self, tbl_name, tbl):
        print("==table: " + tbl_name + "==")
        print(tbl)


class BroadcastServerProtocol(WebSocketServerProtocol):

    def onOpen(self):
        self.factory.register(self)
        self.chatroom = API_Chatroom()

    def onMessage(self, payload, isBinary):
        if not isBinary:
            ret = self.chatroom.handler(payload.decode('utf8'), self.peer);
            print "=> hanldeMsg() returns: " + ret

            if debug:
                msg = "{} from {}".format(payload.decode('utf8'), self.peer)
            else:
                msg = "{}>>> {}".format(self.peer, payload.decode('utf8'))
            self.factory.broadcast(msg, self.peer)

    def connectionLost(self, reason):
        WebSocketServerProtocol.connectionLost(self, reason)
        self.factory.unregister(self)


class BroadcastServerFactory(WebSocketServerFactory):

    """
    Simple broadcast server broadcasting any message it receives to all
    currently connected clients.
    """

    def __init__(self, url, debug=False, debugCodePaths=False):
        WebSocketServerFactory.__init__(self, url, debug=debug, debugCodePaths=debugCodePaths)
        self.clients = []
        self.tickcount = 0
        self.tick()

    def tick(self):
        self.tickcount += 1
        if debug:
            self.broadcast("tick %d from server" % self.tickcount, 'server')
        else:
            self.broadcast("server started", 'server')
        #reactor.callLater(3, self.tick)

    def register(self, client):
        if client not in self.clients:
            print("registered client {}".format(client.peer))
            self.clients.append(client)

    def unregister(self, client):
        if client in self.clients:
            print("unregistered client {}".format(client.peer))
            self.clients.remove(client)

    def broadcast(self, msg, sender):
        print("broadcasting message '{}' ..".format(msg) + " - sender: " + sender)
        for c in self.clients:
            if c.peer != sender: # This avoids a client boardcasting to self. X.C.
                c.sendMessage(msg.encode('utf8'))
                print("message sent to {}".format(c.peer))


class BroadcastPreparedServerFactory(BroadcastServerFactory):

    """
    Functionally same as above, but optimized broadcast using
    prepareMessage and sendPreparedMessage.
    """

    def broadcast(self, msg):
        print("broadcasting prepared message '{}' ..".format(msg))
        preparedMsg = self.prepareMessage(msg)
        for c in self.clients:
            c.sendPreparedMessage(preparedMsg)
            print("prepared message sent to {}".format(c.peer))


if __name__ == '__main__':

    if len(sys.argv) > 1 and sys.argv[1] == 'debug':
        log.startLogging(sys.stdout)
        debug = True
    else:
        debug = False

    ServerFactory = BroadcastServerFactory
    # ServerFactory = BroadcastPreparedServerFactory

    factory = ServerFactory("ws://localhost:9000",
                            debug=debug,
                            debugCodePaths=debug)

    factory.protocol = BroadcastServerProtocol
    factory.setProtocolOptions(allowHixie76=True)
    listenWS(factory)

    webdir = File(".")
    web = Site(webdir)
    reactor.listenTCP(8080, web)

    reactor.run()
