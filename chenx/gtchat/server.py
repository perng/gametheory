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
# 3) add Cls_chatroom
#
# Right now there is this problem: multiple-login: a user login multiple times.
# Ideally it should be solved this way: if a user login from a new location,
# the previous one should be kicked out.
#
# Also for user valication, each time should validate his src also:
# i.e., only when both usr and src match, it's valid. This prevents 
# identity spoofing.
#
# Basically: 
# - from one src there can be only one active user
# - one active user can be from only one src
#
# X.C. (3/18/2015 -  )
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


DEBUG = True

#
# Cls_Chatroom is a singleton: only one instance is running at any time.
#
class Cls_Chatroom():
    def __init__(self):

        # Storage (database)

        # entry = name:pwd
        self.T_users = {}
        self.T_users_src = {} # entry = name:src. E.g. usr1:tcp4:127.0.0.1:57778
 
        # entry = src:Cls_ActiveUser_object
        self.T_users_active = {}

        # entry = name:user_list
        self.T_rooms = {}

        if DEBUG:
            print ">>> new Cls_Chatroom instance created"


    def handle(self, msg, client):
        src = client.peer;

        if DEBUG:
            print(' ')
            print ('==' + src + ':: ' + msg)

        try:
            self.params = json.loads(msg)

            cmd = self.get_param('cmd')
            usr = self.get_param_usr(cmd, src)
            if DEBUG: print("cmd = " + cmd + ", usr = " + usr + ", src = " + src)

            if cmd == "register":
                pwd = self.get_param('pwd')
                self.api_register(usr, pwd, src)

            elif cmd == "login":
                type = self.get_param('type')
                pwd = self.get_param('pwd') if type == 'reg' else ''
                self.api_login(type, usr, pwd, src, client)

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

            elif cmd == "exit":
                self.api_exit(usr, src)

            #elif cmd == "whisper":
            #    msg = self.get_param('msg')
            #    target_usr = self.get_param('target_usr')
            #    self.api_whisper(msg, target_usr, usr, src)

            else:
                raise Exception("unknown cmd")

        except Exception as err:
            #return JsonResponse(FAIL)
            #print(err.args)
            #sys.stdout.write(":exception: ")
            #print(err)
            return "failed:exception:" + str(err)

        return "ok"


    def send_msg(self, src, msg):
        # assumption: usr has been validated in caller.
        #if not usr in self.T_users_active:
        #    raise Exception("send_msg(): Not active user: " + usr)

        self.T_users_active[src].getClient().sendMessage(msg.encode('utf8'))


    def get_param(self, param):
        if not self.params.get(param):
            raise Exception("invalid request parameter: " + param)
        return self.params[param]

 
    def get_param_usr(self, cmd, src):
        """
        Only when cmd = 'regiser'/'login', get usr from params;
        For any other cmd, get usr from T_users_active.
        This avoids identity spoofing.
        """
        if cmd == "login" or cmd == "register":
            usr = self.get_param('usr')
        else:
            usr = self.get_src_username(src)

        if usr == '':
            raise Exception("handle(): unknown user from src " + src)

        return usr


    def validate_user(self, src):
        if src not in self.T_users_active:
            raise Exception("Invalid user")


    def validate_user_name(self, usr):
        if usr not in self.T_users_src:
            raise Exception("Invalid user name")


    def validate_room_name(self, room_name):
        if len(room_name) == 0:
            raise Exception("Room name must be at least one char")


    def validate_room_user(self, room_name, src):
        if room_name not in self.T_rooms:
            raise Exception("Invalid room")
        if not self.T_rooms[room_name].containsUser(src):
            raise Exception("User " + self.get_src_username(src) + " is not in room " + room_name)


    def get_src_username(self, src):
        if src in self.T_users_active:
            return self.T_users_active[src].name
        else:
            return ''


    def api_speak(self, msg, room_name, usr, src):
        self.validate_user(src)
        self.validate_room_name(room_name)
        self.validate_room_user(room_name, src)

        """
        Now broadcast to users in this room.
        Only users in this room receive this message.
        """
        users = self.T_rooms[room_name].getUserSrcList();
        msg = self.make_msg_c_speak(msg, usr, room_name)
        for user in users:
            if user != src:  # do not send to self.
                self.send_msg(user, msg)


    """
    'c_speak' is a client side API call. This msg will be sent to clients.
    """
    def make_msg_c_speak(self, msg, usr, room_name):
        data = {"cmd":"c_speak", "msg":msg, "usr":usr, "room_name":room_name}
        return json.JSONEncoder().encode(data)


    #def api_whisper(self, target_usr, msg, usr, src):
    #    """
    #    speak to an individual
    #    """
    #    self.validate_user(usr)
    #    self.validate_user(target_usr)
    #    self.send_msg(target_usr, msg)
    

    def api_create_room(self, room_name, usr, src):
        """
        When a room is created, the user automatically enters this room.
        All users receive this message (optional, this can be expensive).
        """
        self.validate_user(src)
        self.validate_room_name(room_name)

        if room_name in self.T_rooms:
            raise Exception("Room name already exists")

        room = Cls_Room(room_name)  # create a Room object.
        room.addUser(src, usr);         # add first user.
        self.T_users_active[src].setRoom(room_name)

        self.T_rooms[room_name] = room  # add room to room list.

        if DEBUG: 
            self.dump_db("T_rooms", self.T_rooms)


    def api_invite(self, invitee, room_name, usr, src):
        """
        A user can invite another into a room only when he is in the room.
        Only invitee receives this.
        """
        self.validate_user(src)
        self.validate_room_name(room_name)
        self.validate_room_user(room_name, src)
        self.validate_user_name(invitee)

        # If invitee is already in room, shouln't receive another invitation.
        if self.T_rooms[room_name].containsUsername(invitee):
            raise Exception("api_invite(): invitee " + invitee + 
                  " is already in room " + room_name)

        """
        Now, send room invitation message to the invitee.
        """
        msg = self.make_msg_c_invited(invitee, room_name, usr)
        user = self.T_users_src[invitee]  # get latest src of invitee
        self.send_msg(user, msg)


    """
    'c_invited' is a client side API call.
    """
    def make_msg_c_invited(self, invitee, room_name, usr):
        msg = usr + " invited you to room " + room_name
        data = {"cmd":"c_invited", 
                "msg":msg, "room_name":room_name, "usr":usr}
        return json.JSONEncoder().encode(data)


    def api_join_room(self, room_name, usr, src):
        """
        Only users in this room receive this.
        """
        self.validate_user(src)
        self.validate_room_name(room_name)

        # A user already in a room cannot join again.
        if self.T_rooms[room_name].containsUsername(usr):
            raise Exception("api_join_room(): user " + usr + 
                  " is already in room " + room_name)

        self.T_rooms[room_name].addUser(src, usr)
        self.T_users_active[src].setRoom(room_name)

        if DEBUG:
            self.dump_db("T_rooms", self.T_rooms)


    def api_leave_room(self, room_name, usr, src):
        """
        Only users in this room receive this.
        """
        self.validate_user(src)
        self.validate_room_name(room_name)
 
        self.T_rooms[room_name].removeUser(src)
        self.T_users_active[src].setRoom('')

        if self.T_rooms[room_name].isEmpty():
            del self.T_rooms[room_name]

        if DEBUG:
            self.dump_db("T_rooms", self.T_rooms)


    def api_login(self, type, usr, pwd, src, client):
        """
        The user can be a registered user, or a tmp user (un-registered).
        Once logged in, the user is added to active user list.
        All users receive this (optionally, this will be expensive)
        A registered user can have multiple login sessions.
        """

        """
        Note if a src already exists, and 
        1) usr is also the same, then abort, since this user already logged in.
        2) usr is different. Then this may be the same user logging in with 
           different account. So first cleanup the previous login session
           (remove previous account from room if any, and remove from storage),
           then assign new information.
        """
        if src in self.T_users_active:
            if usr == self.T_users_active[src].name:
                raise Exception("user " + usr + " from " + src + " already logged in")
            else:
                # clear previous session.
                prev_usr = self.T_users_active[src].name
                self.exit_cleanup(prev_usr, src)

        if (type == 'reg'): # register user
            if usr not in self.T_users or self.T_users[usr] != pwd:
                raise Exception("invalid login information")
            #if usr in self.T_users_active:
            #    raise Exception("this user has already logged in")
        else: # 'tmp'. anonymous user
            if usr in self.T_users:
                raise Exception("this username already exists (1)")

        user = Cls_ActiveUser(usr, src, client)
        self.T_users_active[src] = user

        # Record the src of the lastest logging session of a user.
        # used by api_invite: usr -> src -> T_users_active[src] object.
        self.T_users_src[usr] = src  

 
    def api_update_pwd(self, usr, old_pwd, new_pwd, new_pwd2, src):
        """
        Only usr himself receives a response.
        """
        if (new_pwd != new_pwd2):
            raise Exception("two new password do not match")
        if (len(new_pwd) < 8):
            raise Exception("new password length should >= 8")
        if not usr in self.T_users:
            raise Exception("this username does not exist")
        if old_pwd != self.T_users[usr]:
            raise Exception("old password does not match")

        self.T_users[usr] = new_pwd

        if DEBUG: 
            self.dump_db("T_users", self.T_users)


    def api_register(self, usr, pwd, src):
        """
        After register, the user still need to login to become an active user.
        Only usr himself receives a response.
        """
        if len(usr) == 0:
            raise Exception("invalid user name")
        if len(pwd) < 8:
            raise Exception("user password length should >= 8")

        if usr in self.T_users:
            raise Exception("this username already exists (0)")

        # add new user to database.
        self.T_users[usr] = pwd
        #self.T_users_src[usr] = src

        if DEBUG:
            self.dump_db("T_users", self.T_users)
            #self.dump_db("T_users_src", self.T_users_src)


    def api_exit(self, usr, src):
        """
        For a proper exit, remove user from chat room if any, 
        and clear its entry in storage.
        """
        self.validate_user(src)
        self.exit_cleanup(usr, src)


    def exit_cleanup(self, usr, src):
        room_name = self.T_users_active[src].room
        if room_name != "":
            self.T_rooms[room_name].removeUser(src)
            if self.T_rooms[room_name].isEmpty():
                del self.T_rooms[room_name]

        del self.T_users_active[src]
        del self.T_users_src[usr]


    def dump_db(self, tbl_name, tbl):
        print("==table: " + tbl_name + "==")
        print(tbl)


class Cls_ActiveUser():
    def __init__(self, usr, src, client):
        self.name = usr
        self.src  = src
        self.client = client  # can send message through this.
        self.room = ''

    def setRoom(self, room):
        self.room = room

    def getSrc(self):
        return self.src

    def getClient(self): 
        return self.client


class Cls_Room():
    def __init__(self, room_name):
        self.room_name = room_name
        self.user_list = {}  # entry: src:usr

    def __str__(self):
        return "[room - name: " + self.room_name \
             + ", users: " + ",".join(self.getUserNameList()) + "]"
        
    def __repr__(self):
        return self.__str__()

    def addUser(self, src, usr):
        self.user_list[src] = usr

    def removeUser(self, src):
        if src in self.user_list:
            del self.user_list[src]

    def containsUser(self, src):
        return src in self.user_list

    def containsUsername(self, usr):
        return usr in self.user_list.values()

    def getUserNameList(self):
        return self.user_list.values()

    def getUserSrcList(self):
        return self.user_list.keys()

    def isEmpty(self):
        if DEBUG:
            print "room " + self.room_name + " is empty now"
        return not self.user_list


class BroadcastServerProtocol(WebSocketServerProtocol):

    def onOpen(self):  
        self.factory.register(self)

    def onMessage(self, payload, isBinary):
        if not isBinary:
            ret = self.factory.game_handler.handle(payload.decode('utf8'), self);
            print "=> game_handler.handle() returns: " + ret

            """
            if debug:
                msg = "{} from {}".format(payload.decode('utf8'), self.peer)
            else:
                msg = "{}>>> {}".format(self.peer, payload.decode('utf8'))
            self.factory.broadcast(msg, self.peer)
            """

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

    factory.game_handler = Cls_Chatroom()
    factory.protocol = BroadcastServerProtocol
    factory.setProtocolOptions(allowHixie76=True)
    listenWS(factory)

    webdir = File(".")
    web = Site(webdir)
    reactor.listenTCP(8080, web)

    reactor.run()
