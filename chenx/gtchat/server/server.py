#!/usr/bin/python

###############################################################################
#
# The MIT License (MIT)
#
# Copyright (c) X. Chen
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
# 3) added Chatroom API classes Cls_chatroom, Cls_ActiveUser, Cls_Rooms,
#    Cls_UserPref.
#
# X. Chen (3/18/2015 - 5/11/2015)
# 

import sys, os
import json, time, re
#import signal
from signal import *
import datetime
#import atexit

from twisted.internet import reactor
from twisted.python import log
from twisted.web.server import Site
from twisted.web.static import File

from autobahn.twisted.websocket import WebSocketServerFactory, \
    WebSocketServerProtocol, \
    listenWS

reload(sys)
sys.setdefaultencoding("utf-8")


# Configuration parameters.
from config import *

#
# Configuration parameters. Now imported from config.py above.
#
"""
DEBUG = True
#DEBUG = False
LOG = True
#LOG = False
WEBSOCKET_URL = "ws://localhost:9001"
WEB_PORT = 8080
CONST_LOG_PATH = "/home2/cssauhco/gametheory/gtchat/log.txt"
CONST_LOG_CACHE_SIZE = 500
CONST_DB_PATH = "/home2/cssauhco/gametheory/gtchat/db.txt"
CONST_USE_LOBBY = True
CONST_LOBBY_NAME = "Lobby"
CONST_DEFAULT_PREF = "bgImgID:2,bgSoundID:1"
"""

#
# Cls_Chatroom is a singleton: only one instance is running at any time.
#
class Cls_Chatroom():

    def __init__(self, factory):
        self.factory = factory

        self.getConfig()

        """
        Storage (database tables)
        """
        self.T_users = {}         # entry = name:pwd
        self.T_users_pref = {}    # entry = name:pref. Preferences.
        self.T_users_src = {}     # entry = name:src. E.g. usr1:tcp4:127.0.0.1:57778
        self.T_users_active_ct = {} # entry: name:[list of session_id], session_id = 1, 2, 3, ...
        self.T_users_active = {}  # entry = src:Cls_ActiveUser_object
        self.T_rooms = {}         # entry = name:user_list

        # These are fine, but do not include unicode characters.
        # But users may want to enter name in Chinese, for example.
        #self.username_pattern = re.compile("^[a-zA-Z0-9_]+$")
        #self.roomname_pattern = re.compile("^[a-zA-Z0-9_]+$")

        # Absolutely cannot contain: : , | " ( \
        # self.username_neg_pattern = re.compile("[:,\|\"\(\\\]")
        # Use more strict enforcement, disallow these.
        # Allow: a-zA-Z0-9_, and other unicode characters.
        self.username_neg_pattern = re.compile("[`'~!@#\$%\^&\*\+\-=\[\];<>\./\?)\{\}:,\|\"\(\\\]")
        self.roomname_neg_pattern = self.username_neg_pattern

        # Password cannot contain: : , | " ( \
        self.pwd_neg_pattern = re.compile("[:,\|\"\(\\\]")

        self.color_pattern = re.compile("^#[0-9a-fA-F]{6}$")

        self.DB_is_dirty = False
        self.loadDB()

        """
        Use a default room Lobby, when user first logs in, he is in lobby.
        When a user leaves any room, he is back in Lobby.
        """
        if self.USE_LOBBY:
            self.createLobby()
       
        if DEBUG:
            print ">>> new Cls_Chatroom instance created"


    def getConfig(self):
        if DEBUG:
            print "== config =="
            print "DEBUG = " + str(DEBUG)
            print "LOG = " + str(LOG)
            print "WEBSOCKET_URL = " + WEBSOCKET_URL
            print "WEB_PORT = " + str(WEB_PORT)
            print "LOG_PATH = " + CONST_LOG_PATH 
            print "DB_PATH = " + CONST_DB_PATH
            print "USE_LOBBY = " + str(CONST_USE_LOBBY)
            print "LOBBY_NAME = " + CONST_LOBBY_NAME 
            print "DEFAULT_PREF = " + CONST_DEFAULT_PREF 

        self.DB = CONST_DB_PATH
        self.LOG_PATH = CONST_LOG_PATH
        self.USE_LOBBY = CONST_USE_LOBBY    # True
        self.LOBBY_NAME = CONST_LOBBY_NAME  # "Lobby"

        self.createFileIfNotExist(CONST_LOG_PATH)
        self.use_log_cache = True

        if LOG:
            self.logs = []
            self.doLog("server starts")


    def doLog(self, msg):
        if not LOG:
            return

        if not (os.path.exists(self.LOG_PATH) and os.path.isfile(self.LOG_PATH)):
            print 'No log since log file does not exist: ' + self.LOG_PATH
            return

        time = self.getTimeStamp(1)
        msg = time + ': ' + encode_utf8(msg)
        self.logs.append(msg)

        # write in batch to disk every 100 logs.
        if self.use_log_cache and len(self.logs) < CONST_LOG_CACHE_SIZE:
            return

        for line in self.logs:
            fo = open(self.LOG_PATH, "a")
            fo.write(line + "\n")
            fo.close()

            # clear the list.
            self.logs = []


    def createLobby(self):
        room_name = self.LOBBY_NAME 
        room = Cls_Room(room_name, True)
        self.T_rooms[room_name] = room


    def loadDB(self):
        """
        Load default values from database. E.g., users, rooms.
        This is also good for testing purpose.
        """

        if not (os.path.exists(self.DB) and os.path.isfile(self.DB)):
            print 'use default since self.DB not exists'
            self.T_users['admin'] = 'password'
            self.T_users['a'] = '11111111'
            self.T_users['b'] = '11111111'

            default_pref = CONST_DEFAULT_PREF  #"bgImgID:2,bgSoundID:1"

            self.T_users_pref['admin'] = Cls_UserPref(default_pref) 
            self.T_users_pref['a'] = Cls_UserPref(default_pref)
            self.T_users_pref['b'] = Cls_UserPref(default_pref)

            print self.T_users
            print self.T_users_pref
            self.createFileIfNotExist(self.DB)

            self.DB_is_dirty = True
            return 

        print 'read from self.DB'

        """
        Read from storage file.
        """
        fo = open(self.DB, "r")
        lines = fo.read().splitlines()
        fo.close()

        for line in lines:
            fields = line.split("\t");
            #print 'line: ' + line + ', len=' + str( len(fields) ) 
            # no need to trim since data is trimmed before save.
            if len(fields) == 3:
                name = decode_utf8(fields[0])
                pwd  = decode_utf8(fields[1])
                pref = Cls_UserPref( decode_utf8(fields[2]) )
                self.T_users[name] = pwd
                self.T_users_pref[name] = pref

        #print self.T_users
        #print self.T_users_pref


    def saveDB_T_users(self, usr, pwd):
        """
        For now this is called by both register and update_pwd for append.
        When loadDB, all lines are read in sequence, so old pwd will be
        overwritten by new pwd. This way, even if the flushDB is not called
        when server exists, next time the user's login pwd will still be
        correct.
        """

        if not (os.path.exists(self.DB) and os.path.isfile(self.DB)):
            return;

        pref = encode_utf8(self.T_users_pref[usr].getPrefStr())
        usr = encode_utf8(usr)
        pwd = encode_utf8(pwd)

        fo = open(self.DB, "a")
        fo.write(usr + "\t" + pwd + "\t" + pref + "\n")
        fo.close()

        self.DB_is_dirty = True


    def createFileIfNotExist(self, file):
        dir = os.path.dirname(file)
        if not os.path.exists(dir):
            os.makedirs(dir)
            if DEBUG:
                print "creating dir " + dir

        if not os.path.isfile(file):
            fp = open(file, 'w')
            fp.close()
            print "create file " + file


    def flushDB(self):
        """
        Save database data in memory to disk before exit.
        """
        if not self.DB_is_dirty:
            print "DB is not dirty, no need to flush DB."
            return

        print "flush to db before exit" 
        newDB = self.DB + '.tmp'
        fo = open(newDB, 'w')
        for key, value in self.T_users.iteritems():
            pref = encode_utf8(self.T_users_pref[key].getPrefStr())
            usr = encode_utf8(key)
            pwd = encode_utf8(value)
            fo.write(usr + "\t" + pwd + "\t" + pref + "\n")
        fo.close()

        os.rename(self.DB, self.DB + '.' + self.getTimeStamp(2))
        os.rename(newDB, self.DB)


    def getTimeStamp(self, type):
        ts = time.time()
        if (type == 2):
            st = datetime.datetime.fromtimestamp(ts).strftime('%Y-%m-%d-%H-%M-%S')
        else:
            st = datetime.datetime.fromtimestamp(ts).strftime('%Y-%m-%d %H:%M:%S')
        return st


    def handle(self, msg, client):
        src = client.peer
        cmd = ''
        usr = ''
        tracker = ''

        if DEBUG:
            if DEBUG: print(' ')   # if debug, add an empty line for better display.
            msg_head = msg if len(msg) <= 100 else (msg[:100] + ' ...')
            print ('==' + src + ':: ' + encode_utf8(msg_head))

        try:
            # These 3 checks will close connection if msg doesn't obey rule:
            # Must be in json format, and provide cmd, usr.
            #
            # Exception msg format: -1#[1/2/3]|message.
            # @1st param; -1 means should close client connection.
            # @2nd param: 1 - not in json format, 2 - no cmd, 3 - no usr.
            # @3rd param: message. Optional, may not show details, for system
            # security: you don't want to tell an illegal client the reason
            # why the connection is shut down.
            try: 
                # Do replacement of \r and \n to avoid json parse error.
                # either use the line below, or use strict=False.
                # msg = msg.replace('\r', '\\r').replace('\n', '\\n')
                #
                # But this still got issue with "\", so need to escape "\".
                # This then also solves issue of escaped char in register.
                # e.g., \b was treated as special char before. Now it's not
                # and can be correctly disgarded.

                msg = msg.replace('\\', '\\\\')
                self.params = json.loads(msg, strict=False) 

            except Exception as err:
                raise Exception('-1#1|' + str(err))

            try:
                cmd = self.get_param('cmd')
            except Exception as err:
                raise Exception('-1#2|' + str(err))
            
            try:
                usr = self.get_param_usr(cmd, src)
            except Exception as err:
                raise Exception('-1#3|' + str(err))

            # tracker is optional. Default to 0 if not provided.
            tracker = str(self.params['tracker']) if self.params.get('tracker') else '0'

            if DEBUG: print("cmd = " + encode_utf8(cmd) + ", usr = " \
                            + encode_utf8(usr) + ", src = " + src \
                            + ", tracker = " + encode_utf8(tracker))

            if cmd == "register":
                pwd = self.get_param('pwd')
                self.api_register(usr, pwd, src, client, tracker)

            elif cmd == "login":
                type = self.get_param('type')
                pwd = self.get_param('pwd') if type == 'reg' else ''
                self.api_login(type, usr, pwd, src, client, tracker)

            elif cmd == "update_pwd":
                old_pwd = self.get_param('old_pwd')
                new_pwd = self.get_param('new_pwd')
                self.api_update_pwd(usr, old_pwd, new_pwd, src, tracker)

            elif cmd == "update_pref":
                pref = self.get_param('pref')
                self.api_update_pref(usr, pref, src, tracker)

            elif cmd == "get_room_list":
                self.api_get_room_list(usr, src, tracker)

            elif cmd == "get_user_list":
                self.api_get_user_list(usr, src, tracker)

            elif cmd == "get_room_user_list":
                room_name = self.get_param('room_name')
                self.api_get_room_user_list(room_name, usr, src, tracker)

            elif cmd == "create_room":
                room_name = self.get_param('room_name')
                self.api_create_room(room_name, usr, src, tracker)

            elif cmd == "invite":
                invitee = self.get_param('invitee')
                room_name = self.get_param('room_name')
                self.api_invite(invitee, room_name, usr, src, tracker)

            elif cmd == "invite_reply":
                inviter = self.get_param('inviter')
                room_name = self.get_param('room_name')
                reply = self.get_param('reply')
                self.api_invite_reply(inviter, room_name, reply, usr, src, tracker)

            elif cmd == "master":
                user = self.get_param('user')
                room_name = self.get_param('room_name')
                self.api_master(user, room_name, usr, src, tracker)

            elif cmd == "kick":
                user = self.get_param('user')
                room_name = self.get_param('room_name')
                self.api_kick(user, room_name, usr, src, tracker)

            elif cmd == "max":
                size = self.get_param('size')
                room_name = self.get_param('room_name')
                self.api_max(size, room_name, usr, src, tracker)

            elif cmd == "set_room_permission":
                room_name = self.get_param('room_name')
                is_public = True if self.get_param('permission') == '1' else False
                self.api_set_room_permission(room_name, is_public, usr, src, tracker)

            elif cmd == "join_room":
                room_name = self.get_param('room_name')
                self.api_join_room(room_name, usr, src, tracker, False)

            elif cmd == "leave_room":
                room_name = self.get_param('room_name')
                if self.USE_LOBBY and self.LOBBY_NAME == room_name:
                    raise Exception("36|You are in room " + self.LOBBY_NAME)
                else:
                    self.api_leave_room(room_name, usr, src, tracker, True)

            elif cmd == "speak":
                msg = self.get_param('msg')
                meta = self.get_param('meta')
                room_name = self.get_param('room_name')
                self.api_speak(msg, meta, room_name, usr, src, tracker)

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

            elif cmd == "logout":
                self.api_logout(usr, src, tracker)

            else:
                raise Exception("1|unknown cmd: " + cmd)

        except Exception as err:
            #sys.stdout.write(":exception: ")
            err_msg = str(err)

            # Disconnect connections that do not obey communication protocol.
            if err_msg.startswith('-1#'):
                self.send_msg(client, "disconnect: invalid request")
                client.sendClose()
                return 'close_connection:error: ' + err_msg
            
            self.send_c_response("error", cmd, err_msg, usr, client, tracker)
            return "error:" + err_msg

        return "ok"


    def send_msg(self, client, msg):
        # assumption: usr has been validated in caller.
        #if not usr in self.T_users_active:
        #    raise Exception("2|send_msg(): Not active user: " + usr)

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
            raise Exception("3|non-exist request parameter: " + param)
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
            raise Exception("4|unknown user ''")

        return usr


    def validate_active_user(self, src):
        if src not in self.T_users_active:
            raise Exception("5|Invalid user")


    def validate_active_user_name(self, usr):
        if usr not in self.T_users_src:
            raise Exception("6|Invalid user name '" + usr + "'")


    def validate_is_admin(self, usr, src):
        pass  # TO DO: maybe user name must be "admin"


    def validate_room_name(self, room_name):
        if len(room_name) == 0:
            raise Exception("7|Room name must be at least one char")

    def validate_active_room(self, room_name):
        if not room_name in self.T_rooms:
            raise Exception("8|Room '" + room_name + "' does not exist")


    def validate_room_user(self, room_name, src):
        if room_name not in self.T_rooms:
            raise Exception("9|Invalid room")
        if not self.T_rooms[room_name].containsUser(src):
            raise Exception("10|User " + self.get_src_username(src) + " is not in room " + room_name)


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

        Note: the 'code' field exists only in c_reponse message, when status is 'error'.
        """
        if status == 'error':
            #print 'msg = ' + encode_utf8(msg)
            try:
                barIndex = msg.index('|')  # index() raises an exception if not found.
                code = msg[:barIndex]
                msg = msg[barIndex+1:]
            except:
                code = '41'
        else:
            code = '0'

        data = {"cmd":"c_response", "status":status, "last_cmd":last_cmd, \
                "msg":msg, "code":code, "tracker":tracker}
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
            raise Exception("11|unknown table: " + table_name)

        data = {"table":table_name, "content":msg}
        return json.JSONEncoder().encode(data)


    def process_msg(self, msg, meta):
        # do not allow html tag for security.
        # by 4/29/2015, this is the only processing done to msg.
        msg = msg.replace('<', '&lt;')

        """
        Allow: 
        font-style: <b>, <i>, <u>
        font-size (int)
        font-color (#0-9a-f-A-F){6}
        img
        vid
        Format: 'b:i:u:size=3:color=#ffffff', or 'img', or 'vid'.
        """

        """
        # turn off these. let client handle these. 4/29/2015.
        if meta == 'img':
            msg = '<img src="' + msg + '" class="chatroom"/>'
        else:
            metas = meta.split(':')
            for st in metas:
                if st == 'b':
                    msg = '<b>' + msg + '</b>'
                elif st == 'i':
                    msg = '<i>' + msg + '</i>'
                elif st == 'u':
                    msg = '<u>' + msg + '</u>'
                elif st.startswith('size='):
                    size = st[5:]
                    if not self.isInt(size): 
                        raise Exception('39|not valid size number')
                    msg = '<font size="' + size + 'pt">' + msg + '</font>'
                elif st.startswith('color='):
                    color = st[6:]
                    if not self.isHTMLColor(color):
                        raise Exception('40|not valid HTML color')
                    msg = '<font color="' + color + '">' + msg + '</font>'
        """
        #print 'msg processed: ' + msg

        return msg


    def isHTMLColor(self, s):
        return True if self.color_pattern.match(s) else False


    def isInt(self, s):
        try:
            return str(s) == str(int(s))
        except:
            return False


    def api_speak(self, msg, meta, room_name, usr, src, tracker):
        self.validate_active_user(src)
        self.validate_active_room(room_name)
        self.validate_room_user(room_name, src)

        msg = self.process_msg(msg, meta)

        # get user's video camera status. vid will be sent to only those whose camera is on.
        if meta == 'vid_on':
            self.T_users_active[src].video_on = True
        elif meta == 'vid_off':
            self.T_users_active[src].video_on = False 

        # send response message to sender.
        if meta == 'vid' or meta == 'audio':  # don't send response.
            msg = self.make_msg_c_speak(msg, meta, usr, room_name, tracker)
            self.broadcast_video_to_room(room_name, msg, src)
        else:
            if meta == 'img':  # just send "sent" as response.
                response_msg = 'sent'
            else:              # send back the original message.
                response_msg = msg  

            client = self.get_client(src)
            self.send_c_response("ok", "speak", response_msg, usr, client, tracker)

            """
            Now broadcast to users in this room.
            """
            msg = self.make_msg_c_speak(msg, meta, usr, room_name, tracker)
            self.broadcast_to_room(room_name, msg, src)


    """
    'c_speak' is a client side API call. This msg will be sent to clients.
    """
    def make_msg_c_speak(self, msg, meta, usr, room_name, tracker):
        data = {"cmd":"c_speak", "msg":msg, "meta":meta, "usr":usr, "room_name":room_name, \
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
            raise Exception("12|a user cannot whisper to self")

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
        self.broadcast_to_all(msg, src)

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


    def broadcast_to_all(self, msg, src):
        for target_src in self.T_users_active:
            #if target_src != src:  # do not send to self.
                self.send_msg(self.get_client(target_src), msg)
    

    def api_get_room_list(self, usr, src, tracker):
        """
        Return room list. Happens when a user logs in and then want to see what rooms can join.
        """
        self.validate_active_user(src)
        #response_msg = ",".join(self.T_rooms.keys())
        response_msg = ",".join( self.get_room_list_with_permission() )
        client = self.get_client(src)
        self.send_c_response("ok", "get_room_list", response_msg, usr, client, tracker)


    def get_room_list_with_permission(self):
        # used by api_get_room_list only
        items = []
        for room_name in self.T_rooms:
            perm = '1' if self.T_rooms[room_name].getIsPublic() else '0'
            items.append(room_name + ':' + perm)
        return items


    def api_get_user_list(self, usr, src, tracker):
        """
        Return active user list. 
        """
        self.validate_active_user(src)
        response_msg = ",".join(self.T_users_src.keys())
        client = self.get_client(src)
        self.send_c_response("ok", "get_user_list", response_msg, usr, client, tracker)


    def api_get_room_user_list(self, room_name, usr, src, tracker):
        """
        Return user list in a room.
        """
        self.validate_active_user(src)
        self.validate_active_room(room_name)

        room = self.T_rooms[room_name]

        response_msg = room_name + ":" + room.getMaster() + ":" + \
                       ",".join( room.getUserNameList() )
        client = self.get_client(src)
        self.send_c_response("ok", "get_room_user_list", response_msg, usr, client, tracker)


    def api_create_room(self, room_name, usr, src, tracker):
        """
        When a room is created, the user automatically enters this room.
        All users receive this message (optional, this can be expensive).
        """
        self.validate_active_user(src)
        self.validate_room_name(room_name)

        if room_name in self.T_rooms:
            raise Exception("13|Room '" + room_name + "' already exists")
        if self.roomname_neg_pattern.search(room_name):
            raise Exception("14|valid room name should contain only letters, numbers and underscore")

        # If user was in another room, he needs to quit there first.
        # Ideally a user will call api_leave_room first before calling
        # api_create_room, but it may not be done properly by client.
        prev_room = self.T_users_active[src].room
        if prev_room != "":
            self.api_leave_room(prev_room, usr, src, tracker, False)

        room = Cls_Room(room_name, True)  # create a Room object.
        room.addUser(src, usr)      # add first user.
        room.setMaster(usr)         # set as room master.
        self.T_users_active[src].setRoom(room_name)

        self.T_rooms[room_name] = room  # add room to room list.

        if DEBUG:
            self.dump_db("T_rooms", self.T_rooms)

        # send response message to sender.
        #response_msg = "user '" + usr + "' has created room '" + room_name + "'"
        response_msg = usr + ":" + room_name
        client = self.get_client(src)
        self.send_c_response("ok", "create_room", response_msg, usr, client, tracker)

        # send this notification to all users (except sender) so they can update room list.
        msg = self.make_msg_c_event("room_created", usr + ":" + room_name, tracker)
        self.broadcast_to_all(msg, src)


    def api_invite(self, invitee, room_name, usr, src, tracker):
        """
        A user can invite another into a room only when he is in the room.
        Only invitee receives this.
        """
        self.validate_active_user(src)
        self.validate_active_room(room_name)
        self.validate_room_user(room_name, src)
        self.validate_active_user_name(invitee)

        # If invitee is already in room, shouln't receive another invitation.
        if self.T_rooms[room_name].containsUsername(invitee):
            raise Exception("15|" + invitee + " is already in room " + room_name)

        """
        Now, send room invitation message to the invitee.
        """
        msg = self.make_msg_c_invited(invitee, room_name, usr, tracker)
        target_src = self.T_users_src[invitee]  # get latest src of invitee
        self.send_msg(self.get_client(target_src), msg)

        # send response message to sender.
        response_msg = invitee + ":" + room_name  
        # "user '" + invitee + "' is invited to room '" + room_name + "'"
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


    def api_invite_reply(self, inviter, room_name, reply, usr, src, tracker):
        """
        Invitee can reply: Yes/No/Later.
        Only inviter receives this.
        """
        self.validate_active_user(src)
        self.validate_active_room(room_name)
        self.validate_active_user_name(inviter)

        valid_reply = ["Y", "N", "L"]
        if not reply in valid_reply:
            raise Exception('16|Unknown reply code: ' + reply)

        """
        Now, send reply message to the inviter.
        """
        msg = self.make_msg_c_invite_reply(reply, usr, tracker)
        #target_src = self.T_users_src[inviter]  # get latest src of inviter
        target_src = self.T_rooms[room_name].getUserSrc(inviter)
        self.send_msg(self.get_client(target_src), msg)

        # send response message to sender. optional for invitee.
        response_msg = inviter + ":" + room_name + ":" + reply
        # "replied to inviter '" + inviter + "' in room '" + room_name + "'"
        client = self.get_client(src)
        self.send_c_response("ok", "invite_reply", response_msg, usr, client, tracker)

        #api_join_room(self, room_name, usr, src, tracker):
        if reply == 'Y':
            self.api_join_room(room_name, usr, src, tracker, True)


    """
    'c_invited' is a client side API call.
    """
    def make_msg_c_invite_reply(self, reply, usr, tracker):
        data = {"cmd":"c_invite_reply",
                "msg":reply, "usr":usr, "tracker":tracker}
        return json.JSONEncoder().encode(data)


    def api_master(self, user, room_name, usr, src, tracker):
        """
        Only user in this room can become room master.
        """
        self.validate_active_user(src)
        self.validate_active_room(room_name)
        self.validate_active_user_name(user)

        room = self.T_rooms[room_name]

        if user == room.getMaster():
            raise Exception("17|User " + user + " is already room master")

        room.setMaster(user)  # set new room master.

        """
        Now, send reply message to the room users.
        """
        # send response message to sender.
        # new_master:old_master:room_name
        response_msg = user + ':' + usr + ':' + room_name
        client = self.get_client(src)
        self.send_c_response("ok", "master", response_msg, usr, client, tracker)

        # send event message to users in this room.
        msg = self.make_msg_c_event("master", response_msg, tracker)
        self.broadcast_to_room(room_name, msg, src)


    def api_kick(self, user, room_name, usr, src, tracker):
        """
        Only user in this room can become room master.
        """
        self.validate_active_user(src)
        self.validate_active_room(room_name)
        self.validate_active_user_name(user)

        if user == self.T_rooms[room_name].getMaster():
            raise Exception('18|Room master cannot be kicked.')

        user_src = self.T_users_src[user]
        # kick user out of room. tracker = 0 means is from room_master.
        # True to push user to Lobby.
        self.api_leave_room(room_name, user, user_src, 0, True)

        """
        Now, send reply message to the room users.
        """
        # information to send: kicked_user:room_master:room_name
        info = user + ':' + usr + ':' + room_name

        # send message to kicked user.
        msg = self.make_msg_c_event("kicked", info, 0);
        self.send_msg(self.get_client(user_src), msg)

        # send response message to sender/room master.
        client = self.get_client(src)
        self.send_c_response("ok", "kick", info, usr, client, tracker)

        # well - no need to broadcast to room,
        # as leave_room message is already broadcast to room
        # send event message to users in this room. well - no need.
        #msg = self.make_msg_c_event("kick", info, tracker)
        #self.broadcast_to_room(room_name, msg, src)


    def api_max(self, size, room_name, usr, src, tracker):
        """
        Only room master can do this operation.
        """
        self.validate_active_user(src)
        self.validate_active_room(room_name)

        room = self.T_rooms[room_name]
        if room.getMaster() != usr:
            raise Exception('19|User ' + usr + ' has no permission on this operation')
        if size < 0: 
            size = 0

        room.setMaxSize(size)

        # information to send: size:room_master:room_name
        info = size + ':' + usr + ':' + room_name

        # send response message to sender/room master.
        client = self.get_client(src)
        self.send_c_response("ok", "max", info, usr, client, tracker)

        # send event message to users in this room. well - no need.
        msg = self.make_msg_c_event("max", info, tracker)
        self.broadcast_to_room(room_name, msg, src)


    def api_set_room_permission(self, room_name, is_public, usr, src, tracker):
        """
        Only room master can do this operation.
        """
        self.validate_active_user(src)
        self.validate_active_room(room_name)

        room = self.T_rooms[room_name]
        if room.getMaster() != usr:
            raise Exception('20|User ' + usr + ' has no permission on this operation')

        room.setIsPublic(is_public)

        # Now, send message back to usr
        response_msg = '1' if is_public else '0'
        client = self.get_client(src)
        self.send_c_response("ok", "set_room_permission", response_msg, usr, client, tracker)

        # broadcast to all
        msg = self.make_msg_c_event("set_room_permission", usr + ':' + room_name + ':' + response_msg, tracker)
        self.broadcast_to_all(msg, src)


    def api_join_room(self, room_name, usr, src, tracker, invited):
        """
        Only users in this room receive this.
        """
        self.validate_active_user(src)
        self.validate_active_room(room_name)

        room = self.T_rooms[room_name];

        if not room.getIsPublic() and not invited:
            raise Exception('22|Cannot join a private room. Invitation is needed.')

        room_max_size = int( room.getMaxSize() )
        room_size = int( room.getSize() )
        #print 'max size = ' + str(room_max_size) + ', size = ' + str(room_size)
  
        # Note it's possible that a room'size is larger than max_size:
        # e.g., a room's users reached 100, the master set room size to 50.
        if room_max_size > 0 and room_max_size <= room_size:
            raise Exception("23|Cannot join a full room (size is " + str(room_max_size) + ")")

        # If user was in another room, he needs to quit there first.
        # Ideally a user will call api_leave_room first before calling
        # api_join_room, but it may not be done properly by client.
        prev_room = self.T_users_active[src].room

        # A user already in a room cannot join again.
        if prev_room == room_name:
            raise Exception("21|You are already in this room")

        if prev_room != "":
            self.api_leave_room(prev_room, usr, src, tracker, False)

        self.T_users_active[src].setRoom(room_name)
        self.T_rooms[room_name].addUser(src, usr)

        if DEBUG:
            self.dump_db("T_rooms", self.T_rooms)

        # send response message to sender.
        response_msg = usr + ":" + room_name  # "user '" + usr + "' entered room '" + room_name + "'"
        client = self.get_client(src)
        self.send_c_response("ok", "join_room", response_msg, usr, client, tracker)

        # send event message to users in this room.
        msg = self.make_msg_c_event("join_room", usr, tracker)
        self.broadcast_to_room(room_name, msg, src)


    def broadcast_to_room(self, room_name, msg, src):
        """
        broadcase a message to all users in a room, except the sender.
        """
        self.validate_active_room(room_name)

        target_src_list = self.T_rooms[room_name].getUserSrcList()
        for target_src in target_src_list:
            if target_src != src:  # do not send to self.
                self.send_msg(self.get_client(target_src), msg)


    def broadcast_video_to_room(self, room_name, msg, src):
        """
        broadcase video message to users in room whose video camera is on, and not self.
        """
        self.validate_active_room(room_name)

        target_src_list = self.T_rooms[room_name].getUserSrcList()
        for target_src in target_src_list:
            if target_src != src and self.T_users_active[target_src].video_on == True:  
                self.send_msg(self.get_client(target_src), msg)


    def make_msg_c_event(self, type, usr, tracker):
        """
        make message to send to target_user that usr has done something defined by type:
        1) login, 2) logout,         - sent to all (optional, can be expensive. TO DO).
        3) join_room, 4) leave_room  - sent to people in a room.
        5) room_created, 6) room_gone    - sent to all (optional, can be expensive).
        """
        data = {"cmd":"c_event", "type":type, "usr":usr, "tracker":tracker}
        return json.JSONEncoder().encode(data)


    def api_leave_room(self, room_name, usr, src, tracker, from_api_leave_room):
        """
        Only users in this room receive this.
        """
        self.validate_active_user(src)
        self.validate_active_room(room_name)

        room = self.T_rooms[room_name]
 
        room.removeUser(src)
        self.T_users_active[src].setRoom('')

        if room.getMaster() == usr:
            room.setMaster('')

        room_is_gone = False
        if room.isEmpty() \
           and (not self.USE_LOBBY or room_name != self.LOBBY_NAME):
            del self.T_rooms[room_name]
            room_is_gone = True

            # send this notification to all users (except sender) 
            # so they can update room list.
            msg = self.make_msg_c_event("room_gone", usr + ":" + room_name, tracker)
            self.broadcast_to_all(msg, src)

        if DEBUG:
            self.dump_db("T_rooms", self.T_rooms)

        # send response message to sender.
        response_msg = usr + ":" + room_name  
        response_msg += ":0" if room_is_gone else ":1"  # tell usr if this room is gone.
        client = self.get_client(src)
        self.send_c_response("ok", "leave_room", response_msg, usr, client, tracker)

        # if room still exists, send event message to users in this room.
        if not room_is_gone:
            msg = self.make_msg_c_event("leave_room", usr, tracker)
            self.broadcast_to_room(room_name, msg, src)

        # api_leave_room may be called from api_create_room and api_join_room,
        # in those 2 cases don't add user to lobby.
        if from_api_leave_room and \
           (self.USE_LOBBY and room_name != self.LOBBY_NAME):
            # add user to default chatroom Lobby.
            self.addUserToLobby(usr, src, tracker)


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
                raise Exception("24|user " + usr + " already logged in from this connection")
            else:
                # clear previous session.
                prev_usr = self.T_users_active[src].name
                self.logout_cleanup(prev_usr, src, tracker)

        if (type == 'reg'): # register user
            if usr not in self.T_users or self.T_users[usr] != pwd:
                raise Exception("25|invalid login information")

            pref = self.T_users_pref[usr].getPrefStr()  # get preferences.

            if usr in self.T_users_src:
                #raise Exception("26|user " + usr + " has already logged in")
                # Do below to allow multiple logins of the same user.
                # get sequence number.
                n = self.getFirstMisingIntInList(self.T_users_active_ct[usr])
                self.T_users_active_ct[usr].insert(n - 1, n)
                #print "n = " + str(n), self.T_users_active_ct[usr]
                usr = usr + ' (' + str(n) + ')'
            else:
                self.T_users_active_ct[usr] = [1]

        else: # 'tmp'. anonymous user
            if usr in self.T_users:
                raise Exception("27|this username has been taken")
            pref = ''

        user = Cls_ActiveUser(usr, src, client)
        self.T_users_active[src] = user

        # Record the src of the lastest logging session of a user.
        # used by api_invite: usr -> src -> T_users_active[src] object.
        self.T_users_src[usr] = src  

        # send response message to sender. Include personal settings/preferences.
        response_msg = usr + ',' + pref
        client = self.get_client(src)
        self.send_c_response("ok", "login", response_msg, usr, client, tracker)

        # send this notification to all users (except sender).
        msg = self.make_msg_c_event("login", usr, tracker)
        self.broadcast_to_all(msg, src)

        if self.USE_LOBBY:
            # add user to default chatroom Lobby.
            self.addUserToLobby(usr, src, tracker)

        self.doLog("login: " + usr)


    def getFirstMisingIntInList(self, list):
        size = len(list)
        for i in range(0, size):
            if list[i] != i + 1:
                return i + 1

        return size + 1


    def addUserToLobby(self, usr, src, tracker):
        room_name = self.LOBBY_NAME
        self.T_users_active[src].setRoom(room_name)
        self.T_rooms[room_name].addUser(src, usr)      

        # send response message to sender.
        response_msg = usr + ":" + room_name  # "user '" + usr + "' entered room '" + room_name + "'"
        client = self.get_client(src)
        self.send_c_response("ok", "join_room", response_msg, usr, client, tracker)

        # send event message to users in this room.
        msg = self.make_msg_c_event("join_room", usr, tracker)
        self.broadcast_to_room(room_name, msg, src)

 
    def api_update_pwd(self, usr, old_pwd, new_pwd, src, tracker):
        """
        Only usr himself receives a response.
        Note the use of 2 new passwords and compare equality is done in client,
        on server side we only need 1 new password value.
        """
        if (len(new_pwd) < 8):
            raise Exception("28|new password length should >= 8")
        if not usr in self.T_users:
            raise Exception("29|this username does not exist")
        if old_pwd != self.T_users[usr]:
            raise Exception("30|old password does not match")
        if old_pwd == new_pwd:
            raise Exception("31|Please use a password different from the old one")
        if self.pwd_neg_pattern.search(new_pwd):
            raise Exception("38|Invalid character found in password")

        self.T_users[usr] = new_pwd
        self.saveDB_T_users(usr, new_pwd)

        if DEBUG: 
            self.dump_db("T_users", self.T_users)

        # send response message to sender.
        response_msg = usr
        client = self.get_client(src)
        self.send_c_response("ok", "update_pwd", response_msg, usr, client, tracker)


    def api_update_pref(self, usr, pref, src, tracker):
        """
        Only usr himself receives a response.
        This can process multiple preferences. 
        Input format should be: key1:val1,key2:val2,...
        """
        self.validate_active_user(src)

        # print 'update pref of ' + encode_utf8(username) + ': ' + encode_utf8(pref)

        username = self.getUserRealName(usr)
        input_err = ''
        prefs = []

        # first check if data are all in good format.
        items = pref.split(',')
        for item in items:
            fields = item.split(':')
            if len(fields) == 2:
                prefs.append(fields)
            else:
                if input_err != '': 
                    input_err += ','
                input_err += item

        # if data are all in good format, update preferences.
        if input_err == '':
            for item in prefs:
                key = item[0]
                val = item[1]
                self.T_users_pref[username].setPref(key, val)
                #print 'updat pref: ' + key + '=' + val
            self.DB_is_dirty = True  # do this so will flushDB when exit.

            # send response message to sender.
            response_msg = usr 
            if DEBUG: response_msg += ',' + pref
            client = self.get_client(src)
            self.send_c_response("ok", "update_pref", response_msg, usr, client, tracker)
        else:
            # send response message to sender.
            raise Exception("37|invalid preference (should be colon delimited pair): " + input_err)


    def getUserRealName(self, usr):
        """
        For a user that logs in with multiple sessions, name is like: username (n)
        Strip out the sequence number part, return the username part.
        """
        p_index = usr.find("(");
        if p_index > 0:
            usr = usr[0:p_index - 1]  # strip out username
        return usr


    def api_register(self, usr, pwd, src, client, tracker):
        """
        After register, the user still need to login to become an active user.
        Only usr himself receives a response.
        """
        if len(usr) == 0:
            raise Exception("32|invalid user name")
        if len(pwd) < 8:
            raise Exception("33|user password length should >= 8")
        if self.username_neg_pattern.search(usr):
            raise Exception("34|Invalid character found in user name")
        if self.pwd_neg_pattern.search(pwd):
            raise Exception("38|Invalid character found in password")

        if usr in self.T_users:
            raise Exception("35|this username is not available")

        # add new user to database.
        self.T_users[usr] = pwd
        self.T_users_pref[usr] = Cls_UserPref(CONST_DEFAULT_PREF)  # default preference.
        self.saveDB_T_users(usr, pwd)

        if DEBUG:
            self.dump_db("T_users", self.T_users)
            self.dump_db("T_users_pref", self.T_users_pref)

        # send response message to sender.
        response_msg = "user '" + usr + "' is registerd"
        self.send_c_response("ok", "register", response_msg, usr, client, tracker)


    def api_logout(self, usr, src, tracker):
        """
        For a proper logout, remove user from chat room if any, 
        and clear its entry in storage.
        """
        self.validate_active_user(src)

        # send response message to sender.
        response_msg = "user '" + usr + "' logout"
        client = self.get_client(src)
        self.send_c_response("ok", "logout", response_msg, usr, client, tracker)

        self.logout_cleanup(usr, src, tracker)


    def logout_cleanup(self, usr, src, tracker):
        room_name = self.T_users_active[src].room
        if room_name != "":
            self.T_rooms[room_name].removeUser(src)
            if self.T_rooms[room_name].isEmpty() \
               and (not self.USE_LOBBY or room_name != self.LOBBY_NAME):
                del self.T_rooms[room_name]

                # send this notification to all users (except sender) so they can update room list.
                msg = self.make_msg_c_event("room_gone", usr + ":" + room_name, '0')
                self.broadcast_to_all(msg, src)

        print "logout user: " + encode_utf8(usr)
        del self.T_users_active[src]
        del self.T_users_src[usr]

        p_index = usr.find("(");
        if p_index == -1:
            del self.T_users_active_ct[usr]
        else:
            user = usr[0:p_index - 1]  # strip out username
            p2_index = usr.find(")");
            n = usr[p_index + 1:p2_index]  # strip out sequence number.
            #print encode_utf8(usr) + ':' + encode_utf8(user) + ': n = ' + str(n)
            self.T_users_active_ct[user].remove(int(n))

        # send this notification to all users (except sender).
        msg = self.make_msg_c_event("logout", usr, tracker)
        self.broadcast_to_all(msg, src)

        self.doLog("logout: " + usr)


    def unregister(self, src):
        """
        This is invoked when a connection in broken from client side.
        """
        if src not in self.T_users_active:
            return

        usr = self.T_users_active[src].name
        if DEBUG:
            print "unregister: " + encode_utf8(usr) + ", " + src
        self.logout_cleanup(usr, src, '');


    def dump_db(self, tbl_name, tbl):
        print("==table: " + encode_utf8(tbl_name) + "==")
        #print unicode(tbl, 'utf-8').encode('utf-8')
        print(tbl)
        #for key, value in tbl.iteritems():
        #    print encode_utf8(key) + ',' + encode_utf8(value)



class Cls_ActiveUser():
    def __init__(self, usr, src, client):
        self.name = usr
        self.src  = src
        self.client = client  # can send message through this.
        self.room = ''
        self.video_on = False # whether video camera is on.

    def setRoom(self, room):
        self.room = room

    def getSrc(self):
        return self.src

    def getClient(self): 
        return self.client


# Store user preferences in a dictionary.
class Cls_UserPref():
    def __init__(self, pref):
        self.dict = {}
        fields = pref.split(',')
        for field in fields:
            kv = field.split(':')
            if len(kv) == 2:
                key = kv[0].strip()
                val = kv[1].strip()
                self.dict[key] = val

    def __str__(self):
        return self.getPrefStr()

    def __repr__(self):
        return self.__str__()
    
    def setPref(self, key, val):
        self.dict[key] = val

    def getPref(self, key):
        return self.dict[key] if key in self.dict else ''

    def getPrefStr(self):
        pref = ''
        for key, value in self.dict.iteritems():
            if pref != '':
                pref += ','
            pref += key + ':' + value
        return pref


class Cls_Room():
    def __init__(self, room_name, is_public):
        self.room_name = room_name
        self.user_list = {}  # entry: src:usr
        self.user_src = {}   # entry: usr:src. Used by invite_reply only.
        self.master = ''     # room master
        self.is_public = is_public  # boolean value: room is public/private
        self.max_size = 0    # max room users. 0 means infinite.

    def __str__(self):
        return "[room - name: " + self.room_name \
             + ", master: " + self.getMaster() \
             + ", users: " + ",".join(self.getUserNameList()) + "]"
        
    def __repr__(self):
        return self.__str__()

    def getSize(self):
        return len(self.user_list)

    def getMaxSize(self):
        return self.max_size

    def setMaxSize(self, n):
        self.max_size = n if n > 0 else 0

    def setIsPublic(self, is_public):
        self.is_public = is_public

    def getIsPublic(self):
        return self.is_public

    def setMaster(self, m):
        self.master = m

    def getMaster(self):
        return self.master

    def addUser(self, src, usr):
        self.user_list[src] = usr
        self.user_src[usr]  = src  # Used by invite_reply only.

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

    def getUserSrc(self, usr):    # Used by invite_reply only.
        if usr not in self.user_src:
            return ''
        return self.user_src[usr]

    def isEmpty(self):
        if DEBUG and not self.user_list:
            print "room " + encode_utf8(self.room_name) + " is empty now"
        return not self.user_list


class BroadcastServerProtocol(WebSocketServerProtocol):

    def onOpen(self):  
        self.factory.register(self)

    def onMessage(self, payload, isBinary):
        if not isBinary:
            ret = self.factory.game_handler.handle(payload.decode('utf8'), self);
            if DEBUG:
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
            self.game_handler.unregister(client.peer)

    def broadcast(self, msg, sender):
        print("broadcasting message '{}' ..".format(msg.encode('utf-8')) + " - sender: " + sender)
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


def cleanup(*args):
    factory.game_handler.flushDB()
    factory.game_handler.use_log_cache = False
    factory.game_handler.doLog("server stops")
    reactor.stop()


def encode_utf8(str):
    return str.encode('utf-8')

def decode_utf8(str):
    return str.decode('utf-8')


if __name__ == '__main__':

    if len(sys.argv) > 1 and sys.argv[1] == 'debug':
        log.startLogging(sys.stdout)
        debug = True
    else:
        debug = False

    ServerFactory = BroadcastServerFactory
    # ServerFactory = BroadcastPreparedServerFactory

    url = WEBSOCKET_URL

    factory = ServerFactory(url,
                            debug=debug,
                            debugCodePaths=debug)

    factory.game_handler = Cls_Chatroom(factory)
    factory.protocol = BroadcastServerProtocol
    factory.setProtocolOptions(allowHixie76=True)
    listenWS(factory)

    webdir = File(".")
    web = Site(webdir)
    reactor.listenTCP(WEB_PORT, web)

    #atexit.register(factory.game_handler.flushDB)
    #signal.signal(signal.SIGINT, cleanup)
    #signal.signal(signal.SIGTERM, cleanup)
    for sig in (SIGTERM, SIGINT):
        signal(sig, cleanup)

    reactor.run()
