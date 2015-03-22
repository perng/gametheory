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
# 3) added Chatroom API classes Cls_chatroom, Cls_ActiveUser, Cls_Rooms.
#
# X.C. (3/18/2015 - 3/19/2015)
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
#DEBUG = False
LOG = True
#LOG = False

#
# Cls_Chatroom is a singleton: only one instance is running at any time.
#
class Cls_Chatroom():

    def __init__(self):
        """
        Storage (database tables)
        """
        self.T_users = {}         # entry = name:pwd
        self.T_users_src = {}     # entry = name:src. E.g. usr1:tcp4:127.0.0.1:57778
        self.T_users_active = {}  # entry = src:Cls_ActiveUser_object
        self.T_rooms = {}         # entry = name:user_list

        if DEBUG:
            print ">>> new Cls_Chatroom instance created"


    def handle(self, msg, client):
        src = client.peer
        cmd = ''
        usr = ''
        tracker = ''

        if DEBUG or LOG:
            if DEBUG: print(' ')   # if debug, add an empty line for better display.
            print ('==' + src + ':: ' + msg)

        try:
            self.params = json.loads(msg)

            cmd = self.get_param('cmd')
            usr = self.get_param_usr(cmd, src)
            tracker = str(self.params['tracker']) if self.params.get('tracker') else '0'
            if DEBUG: print("cmd = " + cmd + ", usr = " + usr + ", src = " + src \
                            + ", tracker = " + tracker)

            if cmd == "register":
                pwd = self.get_param('pwd')
                self.api_register(usr, pwd, src, client, tracker)

            elif cmd == "login":
                type = self.get_param('type')
                pwd = self.get_param('pwd') if type == 'reg' else ''
                self.api_login(type, usr, pwd, src, client, tracker)

            elif cmd == "update_pwd":
                old_pwd = self.get_param('pwd')
                new_pwd = self.get_param('new_pwd')
                new_pwd2 = self.get_param('new_pwd2')
                self.api_update_pwd(usr, old_pwd, new_pwd, new_pwd2, src, tracker)

            elif cmd == "create_room":
                room_name = self.get_param('room_name')
                self.api_create_room(room_name, usr, src, tracker)

            elif cmd == "invite":
                invitee = self.get_param('invitee')
                room_name = self.get_param('room_name')
                self.api_invite(invitee, room_name, usr, src, tracker)

            elif cmd == "join_room":
                room_name = self.get_param('room_name')
                self.api_join_room(room_name, usr, src, tracker)

            elif cmd == "leave_room":
                room_name = self.get_param('room_name')
                self.api_leave_room(room_name, usr, src, tracker)

            elif cmd == "speak":
                msg = self.get_param('msg')
                room_name = self.get_param('room_name')
                self.api_speak(msg, room_name, usr, src, tracker)

            elif cmd == "whisper":
                msg = self.get_param('msg')
                target_usr = self.get_param('target_user')
                self.api_whisper(msg, target_usr, usr, src, tracker)

            elif cmd == "broadcast":
                msg = self.get_param('msg')
                self.api_broadcast(msg, usr, src, tracker)

            elif cmd == "admin_show_table":
                table_name = self.get_param('table')
                self.api_admin_show_table(table_name, usr, src, tracker)

            elif cmd == "exit":
                self.api_exit(usr, src, tracker)

            else:
                raise Exception("unknown cmd: " + cmd)

        except Exception as err:
            #sys.stdout.write(":exception: ")
            err_msg = str(err)
            self.send_c_response("error", cmd, err_msg, usr, client, tracker)
            return "error:" + err_msg

        return "ok"


    def send_msg(self, client, msg):
        # assumption: usr has been validated in caller.
        #if not usr in self.T_users_active:
        #    raise Exception("send_msg(): Not active user: " + usr)

        # Note: client is not empty only when called from send-c_response.
        #       this is because register call does not add the request user
        #       to T_users_active list, so must provide the client to send 
        #       response.

        #if client == '':
        #    self.T_users_active[src].getClient().sendMessage(msg.encode('utf8'))
        #else:
        client.sendMessage(msg.encode('utf8'))


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
            raise Exception("unknown user ''")

        return usr


    def validate_active_user(self, src):
        if src not in self.T_users_active:
            raise Exception("Invalid user")


    def validate_active_user_name(self, usr):
        if usr not in self.T_users_src:
            raise Exception("Invalid user name")


    def validate_is_admin(self, usr, src):
        pass  # TO DO: maybe user name must be "admin"


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


    def get_client(self, src):
        """ 
        Pre-assumption: src is valid 
        """
        return self.T_users_active[src].getClient()


    def send_c_response(self, status, last_cmd, msg, usr, client, tracker):
        """
        Send response message to request sender.
        In theory for each request, a response should be sent,
        although sometimes it may be ignored without any issue.
        """
        data = {"cmd":"c_response", "status":status, "last_cmd":last_cmd, \
                "msg":msg, "tracker":tracker}
        msg = json.JSONEncoder().encode(data)
        #print "send response now.."
        self.send_msg(client, msg)


    def api_admin_show_table(self, table_name, usr, src, tracker):
        """
        Return table contents to client. For admin/testing purposes only.
        """
        self.validate_active_user(src)
        self.validate_is_admin(usr, src)

        # send response message to sender.
        client = self.get_client(src)
        response_msg = self.make_msg_c_show_table(table_name)
        self.send_c_response("ok", "admin_show_table", response_msg, usr, client, tracker)


    """
    'c_show_table' is a client side API call. This msg will be sent to clients.
    """
    def make_msg_c_show_table(self, table_name):
        if table_name == "T_users":
            msg = self.T_users
        elif table_name == "T_users_src":
            msg = self.T_users_src
        elif table_name == "T_users_active":
            msg = []
            for user in self.T_users_active.values():
                msg.append(user.name)
        elif table_name == "T_rooms":
            msg = []
            for room in self.T_rooms.values():
                msg.append([room.room_name, room.getUserNameList()])
        else:
            raise Exception("unknown table: " + table_name)

        data = {"table":table_name, "content":msg}
        return json.JSONEncoder().encode(data)


    def api_speak(self, msg, room_name, usr, src, tracker):
        self.validate_active_user(src)
        self.validate_room_name(room_name)
        self.validate_room_user(room_name, src)

        """
        Now broadcast to users in this room.
        Only users in this room receive this message.
        """
        target_src_list = self.T_rooms[room_name].getUserSrcList()
        msg = self.make_msg_c_speak(msg, usr, room_name, tracker)
        for target_src in target_src_list:
            if target_src != src:  # do not send to self.
                self.send_msg(self.get_client(target_src), msg)

        # send response message to sender.
        response_msg = "message is sent"
        client = self.get_client(src)
        self.send_c_response("ok", "speak", response_msg, usr, client, tracker)


    """
    'c_speak' is a client side API call. This msg will be sent to clients.
    """
    def make_msg_c_speak(self, msg, usr, room_name, tracker):
        data = {"cmd":"c_speak", "msg":msg, "usr":usr, "room_name":room_name, \
                "tracker":tracker}
        return json.JSONEncoder().encode(data)


    def api_whisper(self, msg, target_usr, usr, src, tracker):
        """
        Optional API call. Speak to an individual in private, not in a chatroom.
        Client will define a way to display this message.
        A user cannot whisper to himself.
        """
        self.validate_active_user(src)
        self.validate_active_user_name(target_usr)
        if usr == target_usr:
            raise Exception("a user cannot whisper to self")

        target_src = self.T_users_src[target_usr]
        msg = self.make_msg_c_whisper(msg, usr, tracker)
        self.send_msg(self.get_client(target_src), msg)

        # send response message to sender.
        response_msg = "message is whispered to user '" + target_user + "'"
        client = self.get_client(src)
        self.send_c_response("ok", "whisper", response_msg, usr, client, tracker)


    """
    'c_whisper' is a client side API call. This msg will be sent to clients.
    """
    def make_msg_c_whisper(self, msg, usr, tracker):
        data = {"cmd":"c_whisper", "msg":msg, "usr":usr, "tracker":tracker}
        return json.JSONEncoder().encode(data)

  
    def api_broadcast(self, msg, usr, src, tracker):
        """
        A broadcast goes to all logged in, except sender himself.
        Client will define how to display this.

        Note: if a user has more than one login session, broadcast message
        from another user will reach all sessions; if the sender is himself,
        the message will reach his own other sessions (except the session
        that sends the message). It is easy to make it such that broadcast
        sender's message don't go to any of his own sessions. But I decide
        to make it possible to reach the sender's other sessions.
        """
        self.validate_active_user(src)

        msg = self.make_msg_c_broadcast(msg, usr, tracker)
        for target_src in self.T_users_active:
            if target_src != src:  # do not send to self.
                self.send_msg(self.get_client(target_src), msg)

        # send response message to sender.
        response_msg = "message is broadcasted"
        client = self.get_client(src)
        self.send_c_response("ok", "broadcast", response_msg, usr, client, tracker)


    """
    'c_broadcast' is a client side API call. This msg will be sent to clients.
    """
    def make_msg_c_broadcast(self, msg, usr, tracker):
        data = {"cmd":"c_broadcast", "msg":msg, "usr":usr, "tracker":tracker}
        return json.JSONEncoder().encode(data)
    

    def api_create_room(self, room_name, usr, src, tracker):
        """
        When a room is created, the user automatically enters this room.
        All users receive this message (optional, this can be expensive).
        """
        self.validate_active_user(src)
        self.validate_room_name(room_name)

        if room_name in self.T_rooms:
            raise Exception("Room '" + room_name + "' already exists")

        room = Cls_Room(room_name)  # create a Room object.
        room.addUser(src, usr);         # add first user.
        self.T_users_active[src].setRoom(room_name)

        self.T_rooms[room_name] = room  # add room to room list.

        if DEBUG: 
            self.dump_db("T_rooms", self.T_rooms)

        # send response message to sender.
        response_msg = "user '" + usr + "' has created room '" + room_name + "'"
        client = self.get_client(src)
        self.send_c_response("ok", "create_room", response_msg, usr, client, tracker)


    def api_invite(self, invitee, room_name, usr, src, tracker):
        """
        A user can invite another into a room only when he is in the room.
        Only invitee receives this.
        """
        self.validate_active_user(src)
        self.validate_room_name(room_name)
        self.validate_room_user(room_name, src)
        self.validate_active_user_name(invitee)

        # If invitee is already in room, shouln't receive another invitation.
        if self.T_rooms[room_name].containsUsername(invitee):
            raise Exception("api_invite(): invitee '" + invitee + \
                  "' is already in room '" + room_name + "'")

        """
        Now, send room invitation message to the invitee.
        """
        msg = self.make_msg_c_invited(invitee, room_name, usr, tracker)
        target_src = self.T_users_src[invitee]  # get latest src of invitee
        self.send_msg(self.get_client(target_src), msg)

        # send response message to sender.
        response_msg = "user '" + invitee + "' is invited to room '" + room_name + "'"
        client = self.get_client(src)
        self.send_c_response("ok", "invite", response_msg, usr, client, tracker)


    """
    'c_invited' is a client side API call.
    """
    def make_msg_c_invited(self, invitee, room_name, usr, tracker):
        msg = usr + " invited you to room " + room_name
        data = {"cmd":"c_invited", 
                "msg":msg, "room_name":room_name, "usr":usr, "tracker":tracker}
        return json.JSONEncoder().encode(data)


    def api_join_room(self, room_name, usr, src, tracker):
        """
        Only users in this room receive this.
        """
        self.validate_active_user(src)
        self.validate_room_name(room_name)

        # A user already in a room cannot join again.
        if self.T_rooms[room_name].containsUsername(usr):
            raise Exception("api_join_room(): user '" + usr + \
                  "' is already in room '" + room_name + "'")

        # If user was in another room, he needs to quit there first.
        # Ideally a user will call api_leave_room first before calling
        # api_join_room, but sometimes it may not be done properly by client.
        prev_room = self.T_users_active[src].room
        if prev_room != "":
            self.api_leave_room(prev_room, usr, src)

        self.T_users_active[src].setRoom(room_name)
        self.T_rooms[room_name].addUser(src, usr)

        if DEBUG:
            self.dump_db("T_rooms", self.T_rooms)

        # send response message to sender.
        response_msg = "user '" + usr + "' entered room '" + room_name + "'"
        client = self.get_client(src)
        self.send_c_response("ok", "join_room", response_msg, usr, client, tracker)


    def api_leave_room(self, room_name, usr, src, tracker):
        """
        Only users in this room receive this.
        """
        self.validate_active_user(src)
        self.validate_room_name(room_name)
 
        self.T_rooms[room_name].removeUser(src)
        self.T_users_active[src].setRoom('')

        if self.T_rooms[room_name].isEmpty():
            del self.T_rooms[room_name]

        if DEBUG:
            self.dump_db("T_rooms", self.T_rooms)

        # send response message to sender.
        response_msg = "user '" + usr + "' left room '" + room_name + "'"
        client = self.get_client(src)
        self.send_c_response("ok", "leave_room", response_msg, usr, client, tracker)


    def api_login(self, type, usr, pwd, src, client, tracker):
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
                raise Exception("user " + usr + " already logged in from this connection")
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
                raise Exception("this username has been taken")

        user = Cls_ActiveUser(usr, src, client)
        self.T_users_active[src] = user

        # Record the src of the lastest logging session of a user.
        # used by api_invite: usr -> src -> T_users_active[src] object.
        self.T_users_src[usr] = src  

        # send response message to sender.
        response_msg = "user '" + usr + "' is logged in"
        client = self.get_client(src)
        self.send_c_response("ok", "login", response_msg, usr, client, tracker)

 
    def api_update_pwd(self, usr, old_pwd, new_pwd, new_pwd2, src, tracker):
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

        # send response message to sender.
        response_msg = "password of user '" + usr + "' is changed"
        client = self.get_client(src)
        self.send_c_response("ok", "update_pwd", response_msg, usr, client, tracker)


    def api_register(self, usr, pwd, src, client, tracker):
        """
        After register, the user still need to login to become an active user.
        Only usr himself receives a response.
        """
        if len(usr) == 0:
            raise Exception("invalid user name")
        if len(pwd) < 8:
            raise Exception("user password length should >= 8")

        if usr in self.T_users:
            raise Exception("this username is not available")

        # add new user to database.
        self.T_users[usr] = pwd

        if DEBUG:
            self.dump_db("T_users", self.T_users)

        # send response message to sender.
        response_msg = "user '" + usr + "' is registerd"
        self.send_c_response("ok", "register", response_msg, usr, client, tracker)


    def api_exit(self, usr, src, tracker):
        """
        For a proper exit, remove user from chat room if any, 
        and clear its entry in storage.
        """
        self.validate_active_user(src)
        self.exit_cleanup(usr, src)

        # send response message to sender.
        response_msg = "user '" + usr + "' exits"
        client = self.get_client(src)
        self.send_c_response("ok", "exit", response_msg, usr, client, tracker)


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
            if DEBUG or LOG:
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
