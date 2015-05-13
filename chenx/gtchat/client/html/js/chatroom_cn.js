/**
 * Javascript for chatroom.
 * @author: X. Chen
 * @since: March 18, 2015
 */

         var socket = null;
         var isopen = false;
         var current_cmd = '';  // keep track of current status.
         var current_msg = '';  // keep track of current message.
         var arrow_mode = false; // to flip input by arrow keys.
         var tmp_msg = '';       // in arrow mode, keep tmp command.
         var current_tid = '';  // keep track of current tracker id.
         var current_user = ''; // keep track of current logged in user.
         var current_room = ''; // keep track of current room.
         var is_room_master = false;  // Whether this user is room master.
         var request_src = ''; // used for command line requests #rooms, #users.
         var bgImg_downloaded = false;
         var bgImgID = 2;
         var bgImgSize = '';
         var bgSoundID = 1;
         var canPlayMP3 = supportAudioMP3();
         var current_app = '';
         var apps = '';
         var helpMsgAll    = getHelpAll();
         var helpMsgCommon = getHelpCommon();
         var helpMsgMaster = getHelpMaster();
         var url_sixp = 'http://homecox.com/games/sp/';
         var vid_on = false;
         var soundVoice = null;

         if (typeof String.prototype.startsWith != 'function') {
             String.prototype.startsWith = function (str){
                 //return this.indexOf(str) === 0; // O(n)
                 return this.slice(0, str.length) == str; // O(1)
             };
         }

         function supportAudioMP3() {
             var audio  = document.createElement("audio");
             var canPlayMP3 = (typeof audio.canPlayType === "function" &&
                          audio.canPlayType("audio/mpeg") !== "");
             return canPlayMP3;
         }

         function playSound(type) {
             if (! canPlayMP3 || bgSoundID == 0) return;
             var v;
             if (type == 'send') {
                 v = document.getElementById('idSoundSend');
                 v.src = '../sound/send' + bgSoundID + '.mp3';
             } else if (type == 'recv') {
                 v = document.getElementById('idSoundRecv');
                 v.src = '../sound/recv' + bgSoundID + '.mp3';
             } else if (type == 'info') {
                 v = document.getElementById('idSoundSend');
                 v.src = '../sound/info.mp3';
             } else if (type == 'err') {
                 v = document.getElementById('idSoundSend');
                 v.src = '../sound/error.mp3';
             }
             v.play();
         }

         function send_data(data) {
             appendConsole('==> Send: ' + data);
             socket.send(data);
         }

         function doDisconnect(startup) {
             if (! startup && ! confirm(C_MSG['1'])) return;

             if (socket != null) socket.close();
             socket = null;
             isopen = false;
             //if (! startup) appendConsole("<font color='green'>Disconnected!</font>");
             if (! startup) dispConnectionStatus("<font color='green'>" + C_MSG['3'] + "</font>")
             toggleButton(true);
             cleanup_logout();
         }
         function dispConnectionStatus(msg) {
             document.getElementById('connection_status').innerHTML = msg;
             //updateInfo(msg);
         }
         function btnConnect_onclick(b) {
             if (b.value == 'Connect') {
                 b.disabled = true;
                 current_cmd = 'doConnect';
                 doConnect();
             } else {
                 doDisconnect(false);
                 setTimeout(function() { 
                     dispConnectionStatus("<font color='green'>" + C_MSG['4'] + "</font>"); 
                 }, 10);
             }
         }
         function doConnect() {
         //window.onload = function() {
            cleanup_logout(); // clean up before start.

            document.getElementById('btnConnect').disabled = true;
            //appendConsole("<font color='orange'>connecting ...</font>");
            dispConnectionStatus("<font color='orange'>" + C_MSG['5'] + "</font>")
            var ws = "ws://" + document.getElementById('ws').value;
            if (AUTO_CONNECT != '') ws = AUTO_CONNECT;

            socket = new WebSocket(ws); 
            socket.binaryType = "arraybuffer";
            socket.onopen = function() {
               //console.log("Connected!");
               isopen = true;
               current_cmd = '';

               if (AUTO_CONNECT != '') {
                   //dispConnectionStatus("Welcome to chatroom.");
                   //dispConnectionStatus('<img src="../images/people.png" style="height:40px; vertical-align:middle;">');
                   dispConnectionStatus('');
               } else {
                   //dispConnectionStatus("<font color='green'>Connected!</font>");
                   dispConnectionStatus('');
               }

               updateInfo('');
               toggleButton(false);
            }
            socket.onerror = function() {
                //appendConsole("<font color='red'>Connection not opened.</font>");
                dispConnectionStatus("<font color='red'>" + C_MSG['6'] + "</font>")
                document.getElementById('btnConnect').disabled = false;
                //updateInfo("Cannot open connection.", 'error');
            }
            socket.onmessage = function(e) {
               if (typeof e.data == "string") {
                  //console.log("Text message received: " + e.data);
                  appendConsole("Text message received: " + e.data);
                  process_message(e.data);
               } else {
                  var arr = new Uint8Array(e.data);
                  //console.log("Binary message received: " + hex);
                  appendConsole("Binary message received: " + decodeBinaryMsg(arr));
               }
            }
            socket.onclose = function(e) {
               //console.log("Connection closed.");
               //appendChatroot("<font color='green'>Connection closed.</font>");
               dispConnectionStatus("<font color='green'>" + C_MSG['4'] + "</font>")
               socket = null;
               isopen = false;

               if (current_cmd == 'doConnect') {
                   dispConnectionStatus("<font color='red'>" + C_MSG['7'] + "</font>");
               } else {
                   handle_cr_logout('ok', C_MSG['8'], '0');
                   toggleButton(true);
                   cleanup_logout();
                   dispConnectionStatus("<font color='red'>" + C_MSG['8'] + "</font>");
               }
            }
         };
         function decodeBinaryMsg(arr) {
              var hex = '';
              for (var i = 0; i < arr.length; i++) {
                  hex += ('00' + arr[i].toString(16)).substr(-2);
              }
              return hex;
         }
         function toggleButton(v) {
            document.getElementById('btnConnect').disabled = false;
            document.getElementById('btnConnect').value = v ? C_MSG['9'] : C_MSG['10'];
            document.getElementById('ws').disabled = ! v;
            if (v) $('#span_login').hide();
            else $('#span_login').show();
         }
         function disableChatroom(v) {
            document.getElementById('btnSendTxt').disabled = v;
            document.getElementById('txtMsg').disabled = v;
            document.getElementById('cbSendMode').disabled = v;
            document.getElementById('btnLogout').disabled = v;
            document.getElementById('selectBgSound').disabled = v;
            document.getElementById('selectBgImg').disabled = v;
            setChatroomScrSaver(v);
            //document.getElementById('btnSendBin').disabled = v;
         }

         // Show help for all commands.
         function getHelpAll() {
             var help = "\
<br/>#a (#app, 显示所有应用) \
<br/>#a chess {#app chess, 打开六子棋游戏窗口) \
<br/>#a {app} (#app {app}, 打开指定的应用或URL) \
<br/>#a1 (#a on, #app on, 打开应用窗口) \
<br/>#a0 (#a off, #app off, 隐藏应用窗口) \
<br/>#ac (#a clear, #app clear, 关闭应用，退出应用窗口) \
<br/>#b (#public, 设置当前聊天室为公开聊天室) \
<br/>#c {room} (#create, 创建并加入新聊天室) \
<br/>#e (#erase, 清除聊天室内容) \
<br/>#h (#?, #help, 显示帮助信息) \
<br/>#ha (#help all, 显示所有帮助信息) \
<br/>#hm (#help master, 显示聊天室管理员帮助信息) \
<br/>#i {user} (#invite, 邀请用户加入当前聊天室) \
<br/>#j {room} (#join, 加入已有聊天室) \
<br/>#k {user} (#kick, 把某一用户踢出当前聊天室) \
<br/>#l (#leave, 离开当前聊天室, 并进入大厅) \
<br/>#m {user} (#master, 转移聊天室管理员身份给室内另一用户) \
<br/>#o (#who, 列出当前聊天室用户) \
<br/>#p (#passwd, 更新密码) \
<br/>#r (#rooms, 列出所有在线聊天室) \
<br/>#s {size} (#size, 设置当前聊天室最大容量, 0表示无上限) \
<br/>#u (#users, 列出所有在线用户) \
<br/>#v (#private, 设置当前聊天室为秘密聊天室) \
<br/>#v1 (#vid, #vid on, 打开视频窗口) \
<br/>#v0 (#vid off, 关闭视频窗口) \
<br/>#w (#where, 显示当前聊天室名) \
<br/>#x (#exit, #logout, 退出登录) \
";
             return help;
         }

         // Help on commands for common users.
         function getHelpCommon() {
             var help = "\
<br/>#a (#app, 显示所有应用) \
<br/>#a chess {#app chess, 打开六子棋游戏窗口) \
<br/>#a {app} (#app, 打开指定的应用或URL) \
<br/>#a1 (#a on, #app on, 打开应用窗口) \
<br/>#a0 (#a off, #app off, 隐藏应用窗口) \
<br/>#ac (#a clear, #app clear, 关闭应用，退出应用窗口) \
<br/>#c {room} (#create, 创建并加入新聊天室) \
<br/>#e (#erase, 清除聊天室内容) \
<br/>#h (#?, #help, 显示帮助信息) \
<br/>#hm (#help master, 显示聊天室管理员帮助信息) \
<br/>#i {user} (#invite, 邀请用户加入当前聊天室) \
<br/>#j {room} (#join, 加入已有聊天室) \
<br/>#l (#leave, 离开当前聊天室, 并进入大厅) \
<br/>#o (#who, 列出当前聊天室用户) \
<br/>#p (#passwd, 更新密码) \
<br/>#r (#rooms, 列出所有在线聊天室) \
<br/>#u (#users, 列出所有在线用户) \
<br/>#v1 (#vid, #vid on, turn on video camera) \
<br/>#v0 (#vid off, turn off video camera) \
<br/>#w (#where, 显示当前聊天室名) \
<br/>#x (#exit, #logout, 退出登录) \
";
             return help;
         }

         // Help on commands for room master only.
         function getHelpMaster() {
             var help = "\
<br/>#b (#public, 设置当前聊天室为公开聊天室) \
<br/>#k {user} (#kick, 把某一用户踢出当前聊天室) \
<br/>#m {user} (#master, 转移聊天室管理员身份给室内另一用户) \
<br/>#s {size} (#size, 设置当前聊天室最大容量, 0表示无上限) \
<br/>#v (#private, 设置当前聊天室为秘密聊天室) \
";
             return help;
         }

         function sendText() {
            if (isopen) {
               var msg = "Hello, world!";
               var o = document.getElementById('txtMsg');
               var v = o.value.trim();
               //alert('[' + v + ']');

               o.value = '';

               if (v == '') { 
                   getInputFocus();
                   return; 
               } else {
                   msg = v;
               }

               current_msg = msg;
               current_tid = make_tracker();

               if (msg == '#rooms' || msg == '#r') {
                   request_src = 'console';
                   current_cmd = "get_room_list";
                   var data = '{"cmd":"get_room_list", "tracker":"' + current_tid + '"}';
                   send_data(data);
                   //appendChatroomInfo(msg + ":");
               }
               else if (msg == '#users' || msg == '#u') {
                   request_src = "console"
                   current_cmd = "get_user_list";
                   var data = '{"cmd":"get_user_list", "tracker":"' + current_tid + '"}';
                   send_data(data);
                   //appendChatroomInfo(msg + ":");
               }
               else if (msg == '#help' || msg == '#h' || msg == '#?') {
                   appendChatroomInfo('#help: ' + helpMsgCommon);
               }
               else if (msg == '#hm' || msg == '#help master') {
                   appendChatroomInfo('#help master: ' + helpMsgMaster);
               }
               else if (msg == '#ha' || msg == '#help all') {
                   appendChatroomInfo('#help all: ' + helpMsgAll);
               }
               else if (msg == '#leave' || msg == '#l') {
                   doLeaveRoom();
               }
               else if (msg == '#create' || msg == '#c') {
                   appendChatroomError('#create: ' + C_MSG['11']);
               }
               else if (msg.startsWith('#create ') || msg.startsWith('#c ')) {
                   request_src = "console";
                   var room_name = msg.startsWith('#c ') ? msg.substr(3) : msg.substr(8); // after '#create '
                   room_name = $.trim(room_name);
                   var err = validateRoomname(room_name);
                   if (err != '') {
                       appendChatroomError('#create: ' + err);
                   } else {
                       appendConsole('Now create room: ' + room_name);
                       doCreateRoom(room_name);
                   }
               }
               else if (msg == '#join' || msg == '#j') {
                   appendChatroomError('#join: ' + C_MSG['11']);
               }
               else if (msg.startsWith('#join ') || msg.startsWith('#j ')) {
                   var room_name = msg.startsWith('#j ') ? msg.substr(3) : msg.substr(6); // after '#join '
                   room_name = $.trim(room_name);
                   var err = validateRoomname(room_name);
                   if (err != '') {
                       appendChatroomError('#join: ' + err);
                   } else {
                       appendConsole('Now join room: ' + room_name);
                       doJoinRoom(room_name);
                   }
               }
               else if (msg == '#logout' || msg == '#exit' || msg == '#x') {
                   doLogout(false);
               }
               else if (msg == '#passwd' || msg == '#p') {
                   showFormUpdatePwd();
               }

               // For apps.
               else if (msg == '#a1' || msg == '#a on' || msg == '#app on') {
                   appendChatroomInfo('#app on');
                   doAppOn();
               }
               else if (msg == '#a0' || msg == '#a off' || msg == '#app off') {
                   appendChatroomInfo('#app off');
                   doAppOff();
               }
               else if (msg == '#ac' || msg == '#a clear' || msg == '#app clear') {
                   doAppClear();
               }
               else if (msg == '#a' || msg == '#app') {
                   //appendChatroomError('#app: please provide an app or url');
                   doShowApps();
               }
               else if (msg.startsWith('#a ') || msg.startsWith('#app ')) {
                   doAppUrl(msg);
               }

               else if (msg == '#erase' || msg == '#e') {
                   clearChatroom();
               }
               //
               // All commands below need a non-empty current_room.
               //
               else if (current_room == '') {
                   //appendChatroomInfo('>> ' + msg);
                   appendChatroomInfo(C_MSG['12'] + + msg);
                   appendChatroomInfo(C_MSG['13']);
                   appendConsole('Type message before join a room:' + msg);
               }
               else if (msg == '#who' || msg == '#o') {
                   request_src = "console_who";
                   current_cmd = "get_room_user_list";
                   var data = '{"cmd":"get_room_user_list", "room_name":"' + current_room + '", "tracker":"' + current_tid + '"}';
                   send_data(data);
                   //appendChatroomInfo(msg + ":");
               }
               else if (msg == '#where' || msg == '#w') {
                   appendChatroomInfo('#where: ' + C_MSG['14'] + current_room);
               }
               else if (msg == '#invite' || msg == '#i') {
                   appendChatroomError('#invite: ' + C_MSG['15']);
               }
               else if (msg.startsWith('#invite ') || msg.startsWith('#i ')) {
                   var user_name = msg.startsWith('#i ') ? msg.substr(3) : msg.substr(8); // after '#invite '
                   user_name = $.trim(user_name);
                   var err = validateUsername(user_name);
                   if (err != '') {
                       appendChatroomError('#invite: ' + err);
                   } else {
                       appendConsole('Now invite: ' + user_name);
                       doInvite(user_name);
                   }
               }
               //
               // Commands below requires to be a room master.
               //
               else if (msg == '#private' || msg == '#v' || msg == '#public' || msg == '#b') { // Only room master can do this.
                   if (! is_room_master) {
                       appendChatroomError(msg + ': ' + C_MSG['16']);
                   }   
                   else {
                       current_cmd = "set_room_permission";
                       var is_public = ((msg == '#public' || msg == '#b') ? 1 : 0);
                       var data = '{"cmd":"set_room_permission", "permission":"' + is_public + '", "room_name":"' + 
                              current_room + '", "tracker":"' + current_tid + '"}';
                       send_data(data);
                   }
               }
               else if (msg == '#master' || msg == '#m') {
                   if (! is_room_master) {
                       appendChatroomError('#master: ' + C_MSG['16']);
                   }
                   else {
                       appendChatroomError('#master: ' + C_MSG['15']);
                   }
               }
               else if (msg.startsWith('#master ') || msg.startsWith('#m ')) {
                   if (! is_room_master) {
                       appendChatroomError('#master: ' + C_MSG['16']);
                   }
                   else {
                       var user_name = msg.startsWith('#m ') ? msg.substr(3) : msg.substr(8); //after '#master'
                       user_name = $.trim(user_name);
                       var err = validateUsername(user_name);
                       if (err != '') {
                           appendChatroomError('#master: ' + err);
                       } else {
                           doMaster(user_name, current_room);
                       }
                   }
               }
               else if (msg == '#kick' || msg == '#k') {
                   if (! is_room_master) {
                       appendChatroomError('#kick: ' + C_MSG['16']);
                   }
                   else {
                       appendChatroomError('#kick: ' + C_MSG['15']);
                   }
               }
               else if (msg.startsWith('#kick ') || msg.startsWith('#k ')) {
                   if (! is_room_master) {
                       appendChatroomError('#kick: ' + C_MSG['16']);
                   }
                   else {
                       var user_name = msg.startsWith('#k ') ? msg.substr(3) : msg.substr(6); //after '#kick'
                       user_name = $.trim(user_name);
                       var err = validateUsername(user_name);
                       if (err != '') {
                           appendChatroomError('#kick: ' + err);
                       } else {
                           doKick(user_name, current_room);
                       }
                   }
               }
               else if (msg == '#size' || msg == '#s') {
                   if (! is_room_master) {
                       appendChatroomError('#size: ' + C_MSG['16']);
                   }
                   else {
                       appendChatroomError('#size: ' + C_MSG['17']);
                   }
               }
               else if (msg.startsWith('#size ') || msg.startsWith('#s ')) {
                   if (! is_room_master) {
                       appendChatroomError('#size: ' + C_MSG['16']);
                   }
                   else {
                       current_cmd = "size";
                       var max_size = msg.startsWith('#s ') ? msg.substr(3) : msg.substr(5); // after '#max '
                       max_size = $.trim(max_size);
                       if (! isInt(max_size)) {
                           appendChatroomError('#size: ' + max_size + C_MSG['18']);
                       }
                       else {
                           if (max_size < 0) max_size = 0;
                           var data = '{"cmd":"max", "size":"' + max_size + '", "room_name":"' +
                                  current_room + '", "tracker":"' + current_tid + '"}';
                           send_data(data);
                       }
                   }
               }
               else if (msg == '#v1' || msg == '#vid' || msg == '#vid on') {
                   appendChatroomInfo(msg);
                   if (! vid_on) {
                       var data = '{"cmd":"speak", "room_name":"' + current_room +
                          '", "msg":"' + '[turn on video]' +
                          '", "meta":"' + 'vid_on' +
                          '", "tracker":"' + current_tid + '"}';
                       send_data(data);

                       current_cmd = "speak";
                       doVidOn();
                   }
               }
               else if (msg == '#v0' || msg == '#vid off') {
                   appendChatroomInfo(msg);
                   if (vid_on) { doVidOff(); }
               }
               else {
                   current_cmd = "speak";
                   //alert(msg);
                   var meta = '.'; //size=a';
                   var data = '{"cmd":"speak", "room_name":"' + current_room +
                          '", "msg":"' + strEncode(msg) +
                          '", "meta":"' + strEncode(meta) +
                          '", "tracker":"' + current_tid + '"}';
                   send_data(data);
                   //doSpeak(msg, current_user, true);
               }
            } else {
               //console.log("Connection not opened.")
               appendChatroom("<font color='red'>" + C_MSG['19'] + "</font>");
            }
         }


         function turnOnVid(usr) {
             // do nothing.
         }
         function turnOffVid(usr) {
              $('#webcam_' + usr).remove();
         }
         function showVid(usr, msg) { 
             //$('#image').attr("src", msg);
             var vids = $('#vids');
             var usr_id = usr.replace(/\s+/g, '_').replace(/\(/g, '').replace(/\)/g, '');
             var vid_id = 'vid_' + usr_id;
             var div = document.getElementById(vid_id);
             if (div == null) {
                 vids.append('<div id="webcam_' + usr + '" class="webcam" title="' + usr + '"><img id="' + vid_id + '" class="vid"></div>');
             }
             $('#' + vid_id).attr("src", msg);
         }

         function playAudio(usr, msg) {
             if (soundVoice == null) {
                 soundVoice = document.getElementById('idSoundVoice');
             }
             soundVoice.src = msg;
             soundVoice.play();
         }

         function doSpeak(msg, meta, usr, isMe) {
             var t = getTimeStamp();
             var color = isMe ? ' color="#99ff99"' : '';
             var author = '>> ' + usr + ' ' + t;

             if (meta == 'vid_on') {
                 turnOnVid(usr);
             }
             else if (meta == 'vid_off') {
                 turnOffVid(usr);
             }
             else if (meta == 'vid') {
                 showVid(usr, msg);
                 return;
             }
             else if (meta == 'audio') {
                 playAudio(usr, msg);
                 return;
             }

             msg = strDecode(msg);
             if (isMe) {
                 author = '<span style="font-size:10pt; color:#ccffcc;">' + author + '</span>';
                 msg = '<span style="color: #99ff99;">' + msg + '</span>';
                 playSound('send');
             }
             else {
                 author = '<span style="font-size:10pt; color: #cccccc;">' + author + '</span>';
                 playSound('recv');
             }
             appendChatroom(author + '<br/>' + msg);
         }

         function isInt(value) {
             return !isNaN(value) && 
                    parseInt(Number(value)) == value && 
                    !isNaN(parseInt(value, 10));
         }

         function validateUsername(s) {
             var msg = '';
             if (s == '') {
                 msg = C_MSG['88']; //'please provide a user name';
             }
             else if (! nameIsValid(s)) {
                 msg = s + ': ' + C_MSG['89']; // 'found invalid character';
             }
             return msg;
         }
         function validateRoomname(s) {
             var msg = '';
             if (s == '') {
                 msg = C_MSG['90']; // 'please provide a room name';
             }
             else if (! nameIsValid(s)) {
                 msg = s + ': ' + C_MSG['91']; // 'found invalid character';
             }
             return msg;
         }

         // for username and roomname, must not contain special chars:
         // `~!@#$%^&*()+-={}[]\|:";'<>,./?
         // can only be a-zA-Z0-9_ and utf-8 chars like Chinese.
         function nameIsValid(s) {
             var res = s.search(/[`'~!@#\$%\^&\*\+\-=\[\];<>\.\/\?\)\{\}:,\|\"\(\\]/g);
             return res == -1;
         }

         function pwdIsValid(s) {
             var res = s.search(/[:,\|\"\(\\]/g);
             return res == -1;
         }

         // double quote need be encoded.
         function strEncode(s) {
             s = s.replace(/&/g, "&amp;");
             s = s.replace(/"/g, '&quot;');
             return s;
         }
         function strDecode(s) {
             s = s.replace(/&quot;/g, '"');
             s = s.replace(/&amp;/g, '&');
             s = decodeNewLine(s);
             return s;
         }
         function decodeNewLine(s) {
             return s.replace(/\n/g, '<br/>').replace(/\r/g, '<br/>');
         }
         // Used locally. For remote users, this encode is done by server.
         function encodeHtml(s) {
             return s.replace(/</g, '&lt;');
         }

         // http://stackoverflow.com/questions/14430633/how-to-convert-text-to-binary-code-in-javascript
         function sendBinary() {
            if (isopen) {
               var o = document.getElementById('txtMsg');
               var v = o.value;
               if (v.trim() == '') { getInputFocus(); return; }

               if (v.length == 0) {
                   var buf = new ArrayBuffer(32);
                   var arr = new Uint8Array(buf);
                   for (i = 0; i < arr.length; ++i) arr[i] = i;
               } else {
                   var buf = new ArrayBuffer(v.length);
                   var arr = new Uint8Array(buf);
                   for (i = 0; i < arr.length; ++i) {
                       arr[i] = v[i].charCodeAt(0); //.toString(2);
                   }
               }

               send_data(buf);
               //console.log("Binary message sent.");
               appendConsole("Binary message sent: " + decodeBinaryMsg(arr));
               o.value = '';
            } else {
               //console.log("Connection not opened.")
               appendConsole("<font color='red'>" + C_MSG['19'] + "</font>");
            }
         };
         function appendConsole(msg) {
             var c = document.getElementById('console');
             if (c) { c.innerHTML += msg + '<br/>'; }
             updateScroll(c);
             getInputFocus();
         }
         function appendChatroom(msg) {
             var c = document.getElementById('chatroom');
             if (c) { c.innerHTML += msg + '<br/>'; }
             updateScroll(c);
             getInputFocus();
         }
         function appendChatroomInfo(msg) {
             appendChatroom('<font color="orange">' + msg + '</font>');
             playSound('info');
         }
         function appendChatroomError(msg) {
             appendChatroom('<font color="red">' + msg + '</font>');
             playSound('err');
         }

         function toggleSendMode() {
             if ( sendTextOnEnter() ) {
                 $('#btnSendTxt').hide();
                 $('#txtMsg').css('resize', 'none');
             }
             else {
                 $('#btnSendTxt').show();
                 $('#txtMsg').css('resize', 'vertical');
             }
         }
         function sendTextOnEnter() {
             return document.getElementById("cbSendMode").checked;
         }
         function checkEnter(e) {
             // look for window.event in case event isn't passed in
             e = e || window.event;

             // Use arrow up/down to flip in/out the last input.
             // If a printable key is pressed, the last input becomes current.
             if (e.keyCode == 38) {
                 // 38: up arrow, 37: left arrow.
                 if (tmp_msg != '') return;
                 tmp_msg = $('#txtMsg').val();
                 $('#txtMsg').val(current_msg);
                 arrow_mode = true;
                 return;
             }
             else if (arrow_mode == true && e.keyCode == 40) {
                 // 40: down array, 39: right arrow.
                 $('#txtMsg').val(tmp_msg);
                 tmp_msg = '';
                 arrow_mode = false;
                 return;
             }
             else if (arrow_mode && (e.keyCode == 37 || e.keyCode == 39)) {
                 // Avoid the issue that first press up, then left/right will
                 // leave arrow_mode while making last_input current input
                 // without any printable key pressed.
                 // Actually, any other functional key can be included here.
                 return;
             }
             arrow_mode = false; // other key pressed.
             tmp_msg = '';

             // Do not send text on Enter when either:
             // 1) not in sendTextOnEnter mode or 2) Shift key is pressed.
             // Shift-Enter is a convention for not sending text, e.g., in gtalk.
             if (! sendTextOnEnter() || e.shiftKey) return;

             if (e.keyCode == 13) { 
                 // prevent new line from being entered.
                 e.returnValue = false;
                 if(e.preventDefault) {
                     e.preventDefault();
                 }

                 // now send text to server.
                 sendText(); 
             }
         }
         function getInputFocus() {
             if (document.getElementById('span_login').style.display == 'block') {
                 document.getElementById('login_name').focus();
             } 
             else {
                 document.getElementById('txtMsg').focus();
             }
         }
         /* Scroll down to always show most recent message at bottom. */
         function updateScroll(e) {
             //var e = document.getElementById("chatroom");
             e.scrollTop = e.scrollHeight;
         }
         function clearChatroom() {
             if (! confirm(C_MSG['87'])) { return; }
             document.getElementById("chatroom").innerHTML = '';
         }
         function selectText(containerid) {
             if (document.selection) {
                 var range = document.body.createTextRange();
                 range.moveToElementText(document.getElementById(containerid));
                 range.select();
              } else if (window.getSelection) {
                  var range = document.createRange();
                  range.selectNode(document.getElementById(containerid));
                  window.getSelection().addRange(range);
              }
         }
         function updateInfo(msg, type) {
             if (msg == '') {
                 document.getElementById('div_info').innerHTML = '';
                 return;
             }

             type = (typeof type === 'undefined') ? 'ok' : type;

             if (type == 'ok') {
                 msg = '<font color="green">' + msg + '</font>';
             } 
             else if (type == 'info') {
                 msg = '<font color="orange">' + msg + '</font>';
             }
             else if (type == 'error') {
                 msg = '<font color="red">' + msg + '</font>';
             }

             document.getElementById('div_info').innerHTML = msg;
             //document.getElementById('connection_status').innerHTML = msg;
         }
         function ucFirst(s) {
             if (s.length == 0) return '';
             return s.substr(0,1).toUpperCase() + s.substr(1);
         }

         function showFormUpdatePwd() {
             var h = getCenterPanelHeight(); 
             $('#span_updatepwd').css('top', h + 'px');

             $('#span_updatepwd').show();
             $('#updatepwd_old').focus();
         }

         function showFormReg() {
             $('#span_login').hide();
             $('#span_register').show();
             $('#reg_name').focus();
         }
         function cancelFormReg() {
             $('#div_info').html('');

             $('#reg_name').val('');
             $('#reg_pwd').val('');
             $('#reg_pwd2').val('');

             $('#span_register').hide();
             $('#span_login').show();
             $('#login_name').focus();
         }
         function doRegister() {
             var usr = document.getElementById('reg_name').value.trim();
             var pwd = document.getElementById('reg_pwd').value.trim();
             var pwd2 = document.getElementById('reg_pwd2').value.trim();
             if (usr == '' || pwd == '') {
                 msg = C_MSG['20'];
                 //updateInfo(msg, 'error');
                 alert(msg);
                 document.getElementById('reg_name').focus();
                 return;
             }
             else if (pwd != pwd2) {
                 msg = C_MSG['21']; 
                 //updateInfo(msg, 'error');
                 alert(msg);
                 document.getElementById('reg_pwd').focus();
                 return;
             }
             current_tid = make_tracker();
             var msg = '{"cmd":"register","usr":"' + usr + '","pwd":"' + pwd + '","tracker":"' + current_tid + '"}';
             //alert(msg);
             current_cmd = 'register';
             send_data(msg);
         }

         function doUpdatePwd() {
             var pwd_old = document.getElementById('updatepwd_old').value.trim();
             var pwd = document.getElementById('updatepwd_new').value.trim();
             var pwd2 = document.getElementById('updatepwd_new2').value.trim();
             if (pwd_old == '' || pwd == '' || pwd2 == '') {
                 msg = C_MSG['22'];
                 alert(msg);
                 if (pwd_old == '') $('#updatepwd_old').focus();
                 else if (pwd == '') $('#updatepwd_new').focus();
                 else $('#updatepwd_new2').focus();
                 return;
             }
             else if (pwd != pwd2) {
                 msg = C_MSG['23'];
                 alert(msg);
                 $('#updatepwd_new').focus();
                 return;
             }
             current_tid = make_tracker();
             var msg = '{"cmd":"update_pwd","old_pwd":"' + pwd_old + '","new_pwd":"' + pwd + '","tracker":"' + current_tid + '"}';
             //alert(msg);
             current_cmd = 'update_pwd';
             send_data(msg);
         }
         function cancelUpdatePwd() {
             $('#updatepwd_old').val('');
             $('#updatepwd_new').val('');
             $('#updatepwd_new2').val('');
             $('#span_updatepwd').hide();

             document.getElementById('txtMsg').focus();
         }
         function formUpdatePwdEnter(e) {
             //if(e.which === 13) { doUpdatePwd(); }
         }

         function doLogin() {
             var usr = document.getElementById('login_name').value.trim();
             var pwd = document.getElementById('login_pwd').value.trim();

             if (usr == '' || pwd == '') {
                 msg = C_MSG['2']; // 'Login failed: name and password cannot be empty.';
                 alert(msg);
                 if (usr == '') $('#login_name').focus();
                 else $('#login_pwd').focus();
                 return;
             }

             current_tid = make_tracker();
             var msg = '{"cmd":"login","type":"reg","usr":"' + usr + '","pwd":"' + 
                        pwd + '","tracker":"' + current_tid + '"}';
             //alert(msg);
             current_cmd = 'login';
             send_data(msg);
         }
         // If force is true, then logout without first confirm.
         // This happens when close window.
         function doLogout(force) {
             if (! force && ! confirm(C_MSG['24'])) return;

             if (vid_on) { doVidOff(); }

             // should logout locally no matter what happen on server side.
             // if disconnected before sending logout msg, will not get any
             // response anyways. So do UI logout display here.
             $('#div_logout').html('');
             //updateInfo('You are logging out.', 'info');
             cleanup_logout();

             var h = getCenterPanelHeight();
             $('#span_login').css('top', h + 'px');
             $('#span_register').css('top', h + 'px');

             //cancelFormReg();
             $('#span_login').show();
             getInputFocus();

             var msg = '{"cmd":"logout"}';
             send_data(msg);
         }
         function getCenterPanelHeight() {
             return 140;
             /*
             // Do below if signin/reg/update_pwd spans are inside
             // div chatroom. But now since they are moved outside 
             // div chatroom, this is no longer needed.
             var h = document.getElementById('chatroom').scrollHeight;
             h = h - 454 + 120 + 30; // h - chatroom height + init top + 30
             return h;
             */
         }
         function doCreateRoom(room) {
             current_tid = make_tracker();
             var room_name = $.trim(room);
             if (room_name == '') {
                 updateInfo("Please enter a room name.", 'error');
                 if (request_src != 'concole') $('#txtNewRoom').focus();
                 return;
             }
             var msg = '{"cmd":"create_room","room_name":"' + room_name + 
                       '", "tracker":"' + current_tid + '"}';
             send_data(msg);
         }
         function doLeaveRoom() {
             if (current_room == '') {
                 appendChatroomInfo('#leave ' + C_MSG['25']);
                 return;
             }

             current_tid = make_tracker();
             current_cmd = "leave_room";
             var msg = '{"cmd":"leave_room", "room_name":"' + current_room +
                       '", "tracker":"' + current_tid + '"}';
             send_data(msg);
         }
         function doJoinRoom(room) {
             var room_name = $.trim(room);
             if (room_name == '') {
                 updateInfo(C_MSG['26'], 'error');
                 return;
             }
             current_tid = make_tracker();
             current_cmd = "join_room";
             var msg = '{"cmd":"join_room", "room_name":"' + room_name + 
                       '", "tracker":"' + current_tid + '"}';
             send_data(msg);
         }
         function doMaster(user, room) {
             current_tid = make_tracker();
             current_cmd = "master";
             var data = '{"cmd":"master", "user":"' + user + '", "room_name":"'
                      + room + '", "tracker":"' + current_tid + '"}';
             send_data(data);
         }
         function doKick(user, room) {
             current_tid = make_tracker();
             current_cmd = "kick";
             var data = '{"cmd":"kick", "user":"' + user + '", "room_name":"' +
                      room + '", "tracker":"' + current_tid + '"}';
             send_data(data);
         }
         function doInvite(user) {
             var user_name = $.trim(user);

             current_tid = make_tracker();
             current_cmd = "invite";
             var msg = '{"cmd":"invite", "room_name":"' + current_room +
                       '", "invitee":"' + user_name +
                       '", "tracker":"' + current_tid + '"}';
             send_data(msg);
         }
         function doInviteReply(e, v) {
             // continue only when Enter is pressed.
             e = e || window.event;
             if (e.keyCode != 13) { return; }

             v = v.toLowerCase();

             var reply = '';
             if (v == 'yes' || v == 'y') { reply = 'Y'; }
             else if (v == 'no' || v == 'n') { reply = 'N'; }
             else if (v == 'later' || v == 'l') { reply = 'L'; }

             if (reply != '') {
                 current_tid = make_tracker();
                 var inviter = $('#inviter').val();
                 var inviter_room = $('#inviter_room').val();
                 var msg = '{"cmd":"invite_reply", "inviter":"' + inviter +
                   '", "room_name":"' + inviter_room + 
                   '", "reply":"' + reply + '", "tracker":"' + current_tid + '"}';
                 send_data(msg);

                 $('#span_invite').hide();
                 $('#txtMsg').removeAttr('disabled');
                 $('#txtMsg').focus();
             }
         }

         function doAppChess() {
             appendChatroomInfo('#app chess');
             doAppUrl_preload(url_sixp);
             doAppOn();
         }
         function doAppOn() {
             $('#app_panel').show();
             if (current_app == '') {
                 current_app == 'chess';
                 doAppUrl_preload(url_sixp);
             }
             $('#chatroom').css('width', '360px');

             var bgSize = bgImgSize.split(' ');
             var width = parseInt(bgSize[0].replace('%', '')) * 2;
             var newBgSize = width + '% ' + bgSize[1];  //alert (newBgSize);
             $('#chatroom').css('background-size', newBgSize);
         }
         function doAppOff() {
             $('#chatroom').css('width', '720px');
             $('#app_panel').hide();
             $('#chatroom').css('background-size', bgImgSize);
         }
         function doAppClear() {
             appendChatroomInfo('#app clear');
             current_app = '';
             document.getElementById('app').src = '';
             doAppOff();
         }
         function doAppUrl(msg) {
             var url = '';
             msg = msg.replace(/\s+/g, ' ');

             var v = msg.split(' ');
             if (v.length >= 2) { url = v[1]; }
             url = $.trim(url);

             if (url == '') {
                 appendChatroomInfo('Please provide an app or url');
                 return;
             }

             if (url == 'chess') {
                 doAppChess();
                 return;
             }

             var url2 = url.toLowerCase();
             if (! url2.startsWith('http://') && ! url2.startsWith('https://')) {
                 url = 'http://' + url;
             }

             appendChatroomInfo(msg);
             current_app = url;
             //document.getElementById('app').src = url;
             doAppUrl_preload(url);
             doAppOn();
         }
         // Show a waiting message in the app iframe, preload in app_preload iframe.
         // When preload is done, show it in the app iframe.
         function doAppUrl_preload(url) {
             document.getElementById('app').src = "../loading.html";
             document.getElementById('app_preload').src = url;
             $('#app_preload').load(function() {
                 document.getElementById('app_preload').src = '';
                 $('#app_preload').unbind(); // unbind from load(), otherwise it cycles.
                 document.getElementById('app').src = url;
                 //appendChatroomInfo('loaded: ' + url);
             });
         }
         function doShowApps() {
             if (apps == '') {
                 apps = 'chess';
                 apps = '<font color="yellow">Internal apps</font>:,' + apps;
                 apps += ',<font color="yellow">external apps:</font>';
                 apps += ',audio-visualization.coding.io,pick-sticks-paper.coding.io,nicephoto.coding.io';
                 apps = apps.replace(/,/g, '<br/>');
                 apps = '<font color="#00ff00">' + apps + '</font>';
             }
             appendChatroomInfo('#apps');
             appendChatroomInfo(apps);
             appendChatroomInfo('Use example: #a chess');
         }

         function doVidOn() {
             if (vid_on) { return; }
             vid_on = true;

             init_vid();
             init_audio();
             $('#vid_panel').show();
             $('#chatroom').css('width', '360px');

             var bgSize = bgImgSize.split(' ');
             var width = parseInt(bgSize[0].replace('%', '')) * 2;
             var newBgSize = width + '% ' + bgSize[1];  //alert (newBgSize);
             $('#chatroom').css('background-size', newBgSize);
         }
         function doVidOff() {
             vid_on = false;
             record_stop();
             $('#vid_panel').hide();
             $('#chatroom').css('width', '720px');
             $('#chatroom').css('background-size', bgImgSize);

             current_cmd = "speak";
             var data = '{"cmd":"speak", "room_name":"' + current_room +
                 '", "msg":"' + '[turn off video]' +
                 '", "meta":"' + 'vid_off' +
                 '", "tracker":"' + current_tid + '"}';
             send_data(data);
         }

         function process_message(msg) {
             //alert(msg);
             var jo = JSON.parse(msg);
             var cmd = jo.cmd;
             //alert(jo + ',' + cmd);
             if (cmd == 'c_response') handle_c_response(jo);
             else if (cmd == 'c_speak') handle_c_speak(jo);
             else if (cmd == 'c_whisper') handle_c_whisper(jo);
             else if (cmd == 'c_broadcast') handle_c_broadcast(jo);
             else if (cmd == 'c_invited') handle_c_invited(jo);
             else if (cmd == 'c_invite_reply') handle_c_invite_reply(jo);
             else if (cmd == 'c_event') handle_c_event(jo);
         }

         // Note: code field exists ONLY in c_response msg, when status is 'error'.
         // In c_response msg, if status is 'ok', then code is always '0'.
         // The code field can be used to retrieve response in other languages locally.
         // i.e., this is only useful in Chinese version so far, to get error msg
         // in Chinese from chatroom_msg_cn.js.
         function handle_c_response(jo) {
             var status = jo.status;
             var last_cmd = jo.last_cmd;
             var msg = jo.msg;
             var code = jo.code;
             var tracker = jo.tracker;
             //dump(':response: ' + status + ', ' + last_cmd + ', ' + msg + ',' + tracker);

             if (status == 'ok') { updateInfo(''); }
             else {
                 msg = S_MSG[code];
             }

             if (last_cmd == 'register')         { handle_cr_register(status, msg, code, tracker); }
             else if (last_cmd == 'login')       { handle_cr_login(status, msg, code, tracker); }
             else if (last_cmd == 'update_pwd')  { handle_cr_update_pwd(status, msg, code, tracker); }
             else if (last_cmd == 'update_pref')  { handle_cr_update_pref(status, msg, code, tracker); }
             else if (last_cmd == 'get_room_list')  { handle_cr_get_room_list(status, msg, code, tracker); }
             else if (last_cmd == 'get_user_list')  { handle_cr_get_user_list(status, msg, code, tracker); }
             else if (last_cmd == 'get_room_user_list')  { handle_cr_get_room_user_list(status, msg, code, tracker); }
             else if (last_cmd == 'create_room') { handle_cr_create_room(status, msg, code, tracker); }
             else if (last_cmd == 'invite')      { handle_cr_invite(status, msg, code, tracker); }
             else if (last_cmd == 'invite_reply')      { handle_cr_invite_reply(status, msg, code, tracker); }
             else if (last_cmd == 'master')      { handle_cr_master(status, msg, code, tracker); }
             else if (last_cmd == 'kick')      { handle_cr_kick(status, msg, code, tracker); }
             else if (last_cmd == 'max')      { handle_cr_max(status, msg, code, tracker); }
             else if (last_cmd == 'set_room_permission') { handle_cr_set_room_permission(status, msg, code, tracker); }
             else if (last_cmd == 'join_room')   { handle_cr_join_room(status, msg, code, tracker); }
             else if (last_cmd == 'leave_room')  { handle_cr_leave_room(status, msg, code, tracker); }
             else if (last_cmd == 'speak')       { handle_cr_speak(status, msg, code, tracker); }
             else if (last_cmd == 'whisper')     { handle_cr_whisper(status, msg, code, tracker); }
             else if (last_cmd == 'broadcast')   { handle_cr_broadcast(status, msg, code, tracker); }
             else if (last_cmd == 'admin_show_table') { handle_cr_admin_show_table(status, msg, code, tracker); }
             else if (last_cmd == 'logout')      { handle_cr_logout(status, msg, code, tracker); }
         }
         function handle_c_speak(jo) {
             var msg = jo.msg;
             var meta = jo.meta;
             var usr = jo.usr;
             var room_name = jo.room_name;
             var tracker = jo.tracker;
             doSpeak(msg, meta, usr, false);
         }
         function handle_c_whisper(jo) {
             var msg = jo.msg;
             var usr = jo.usr;
             var tracker = jo.tracker;
             dump(':whisper: ' + msg + ',' + usr + ',' + tracker);
         }
         function handle_c_broadcast(jo) {
             var msg = jo.msg;
             var usr = jo.usr;
             var tracker = jo.tracker;
             dump(':boradcast: ' + msg + ',' + usr + ',' + tracker);
         }
         function handle_c_invited(jo) {
             var msg = jo.msg;
             var usr = jo.usr;
             var room_name = jo.room_name;
             var tracker = jo.tracker;
             dump(':invited: ' + msg + ',' + usr + ',' + room_name + ',' + tracker);

             // disable message box, enable after reply to invitatio request.
             $('#txtMsg').attr('disabled', 'disabled');

             $('#inviter').val(usr);
             $('#inviter_room').val(room_name);
             $('#invite_msg').html(usr + C_MSG['27'] +
                                   room_name + ' (yes/no/later)?');
             $('#span_invite').show();
             $('#txtInviteReply').focus();
         }
         function handle_c_invite_reply(jo) {
             var msg = jo.msg;
             var usr = jo.usr;
             var tracker = jo.tracker;
             dump(':invited: ' + msg + ',' + usr + ',' + tracker);

             if (msg == 'Y') {
                 appendChatroomInfo(usr + C_MSG['28']);
             } 
             else if (msg == 'N') {
                 appendChatroomInfo(usr + C_MSG['29']);
             } 
             else if (msg == 'L') {
                 appendChatroomInfo(usr + C_MSG['30']);
             }
             else {
                 appendChatroomInfo('Unknown invitation reply code: ' + 
                                    msg + ' from ' + usr);
             }
         }
         function handle_c_event(jo) {
             var type = jo.type;
             var usr = jo.usr;
             var tracker = jo.tracker;
             //dump(':event: ' + type + ',' + usr + ',' + tracker);
             
             if (type == 'join_room') {
                 if (current_room != '') {
                     msg = C_MSG['31'] + usr + C_MSG['32'];
                     appendChatroomInfo(msg);
                     appendToSelectList('selectRoomUsersList', usr);
                 }
             }
             else if (type == 'leave_room') {
                 if (current_room != '') {
                     msg = C_MSG['31'] + usr + C_MSG['33'];
                     appendChatroomInfo(msg);
                     removeFromSelectList('selectRoomUsersList', usr);
                 }
             }
             else if (type == 'room_created') {
                 var v = usr.split(':');
                 if (v.length == 2 && v[1] != '') {
                     var room_name = v[1];
                     addRoomsList(room_name);
                     $('#span_msg').html(C_MSG['34'] + room_name + C_MSG['35']);
                     $('#span_msg').show().delay(5000).fadeOut();
                 }
                 else if (DEBUG) {
                     dump('Event room_created wrong parameter (no room): ' + usr);
                 }
             }
             else if (type == 'room_gone') {
                 var v = usr.split(':');
                 if (v.length == 2 && v[1] != '') {
                     var room_name = v[1];
                     removeFromSelectList('selectRoomsList', room_name);
                     $('#span_msg').html(C_MSG['36'] + room_name + C_MSG['37']);
                     $('#span_msg').show().delay(5000).fadeOut();
                 }
                 else if (DEBUG) {
                     dump('Event room_created wrong parameter (no room): ' + usr);
                 }
             }
             else if (type == 'set_room_permission') {
                 var v = usr.split(':');
                 if (v.length == 3 && v[1] != '') {
                     var room_name = v[1];
                     var is_public = (v[2] == '1') ? true : false;
                     //$('#span_msg').html('Room ' + room_name + ' is gone.');
                     //$('#span_msg').show().delay(5000).fadeOut();
                     setRoomPermission(room_name, is_public);
                 }
                 else if (DEBUG) {
                     dump('Event room_created wrong parameter (no room): ' + usr);
                 }
             }
             else if (type == 'login') {
                 appendToSelectList('selectUsersList', usr);
                 $('#span_msg').html(C_MSG['31'] + usr + C_MSG['38']);
                 $('#span_msg').show().delay(5000).fadeOut();
             }
             else if (type == 'logout') {
                 removeUsersList(usr);
                 removeFromSelectList('selectRoomUsersList', usr);
                 var action = (tracker == '' ? C_MSG['39'] : C_MSG['40']);
                 $('#span_msg').html(C_MSG['31'] + usr + action);
                 $('#span_msg').show().delay(5000).fadeOut();
             }
             else if (type == 'master') {
                 var v = usr.split(':'); // new_master:room_name 
                 if (v.length == 3) {
                     var new_master = v[0];
                     var old_master = v[1];
                     var room_name = v[2];
                     //$('#span_msg').html('Room ' + room_name + ' is gone.');
                     //$('#span_msg').show().delay(5000).fadeOut();
                     setRoomMaster(new_master, old_master, room_name);
                     if (new_master == current_user) {
                         is_room_master = true;
                         appendChatroomInfo(old_master + C_MSG['41']);
                     }
                 }
                 else if (DEBUG) {
                     dump('Event master wrong parameter (no new master): ' + usr);
                 }
             }
             else if (type == 'kicked') {
                 var v = usr.split(':');  // kicked_user:room_master:room_name
                 var room = v[2];
                 appendChatroomInfo(C_MSG['42'] + room);
             }
             else if (type == 'kick') {
                 var v = usr.split(':');  // kicked_user:room_master:room_name
                 var user = v[0];
                 appendChatroomInfo(C_MSG['31'] + user + C_MSG['43']);
             }
             else if (type == 'max') {
                 var v = usr.split(':');  // max_size:room_master:room_name
                 var size = v[0];
                 appendChatroomInfo(C_MSG['44'] + size + '.');
             }
         }

         function setRoomMaster(new_master, old_master, room_name) {
             //appendChatroomInfo('::Room ' + room_name + ' new master is ' + new_master);
             setRoomMasterIcon(old_master, false);
             setRoomMasterIcon(new_master, true);
         }

         function setRoomPermission(room_name, is_public) {
             //appendChatroomInfo('::Room ' + room_name + ' is public is ' + is_public);

             var bgImg = is_public ? 'url(../images/home.png)' : 'url(../images/lock.png)';
             $('#selectRoomsList option[value=' + room_name + ']').css(
                 'background-image', bgImg
             );
         }

         function addRoomsList(room_name) {
             appendToSelectList('selectRoomsList', room_name);
             if (room_name == current_room) {
                 setSelectOptionBgColor('selectRoomsList', room_name, '#ccddff');
             }
         }

         function removeUsersList(user_name) {
             //$('#selectUsersList option[value=' + user_name + ']').remove();
             //above will have error when user_name is like: "user (2)".
             $('#selectUsersList option').each(function() {
                 if ($(this).val() == user_name) {
                     $(this).remove();
                 }
             });
         }

         function dump(msg) {
             appendConsole(msg);
         }

         function make_tracker() {
             // create a random number as tracker.
             return Math.floor((Math.random() * 1000000) + 1);
         }

         /* handle response messages. */
         function handle_cr_register(status, msg, code, tracker) {
             if (current_cmd != "register" || current_tid != tracker) {
                 dump(C_MSG['45']);
                 dump('cur_cmd = ' + current_cmd + ', cur_tid = ' + current_tid);
                 return;
             }
             if (status == 'ok') {
                 document.getElementById('reg_pwd').value = ''; // clear password.
                 msg = C_MSG['46'];
                 //appendChatroomInfo(msg);
                 alert(msg);
                 cancelFormReg();
             } else {
                 msg = C_MSG['47'] + ': ' + msg + '.';
                 //updateInfo('Register failed: ' + msg + '.', 'error');
                 //appendChatroomError(msg, 'error');
                 alert(msg);
                 document.getElementById('reg_name').focus();
             }
         }
         function handle_cr_login(status, msg, code, tracker) {
             //alert('get in. status = ' + status);
             if (current_cmd != "login" || current_tid != tracker) {
                 dump(C_MSG['48']);
                 //dump('cur_cmd = ' + current_cmd + ', cur_tid = ' + current_tid);
                 return;
             }
             if (status == 'ok') {
                 $('#span_login').hide();
                 document.getElementById('login_pwd').value = ''; // clear password.
                 // msg is username plus sequence number when the user 
                 // logs in with multple sessions, followed by preferences.
                 var v = msg.split(',');  // msg: user,preferences
                 current_user = v[0];     // $('#login_name').val();

                 // get preferences. E.g, bgImgID:1,bgSoundID:1
                 for (var i = 1, n = v.length; i < n; ++ i ) {
                     kv = v[i].split(':');
                     if (kv.length == 2) {
                         var key = kv[0], val = kv[1];
                         if (key == 'bgImgID') bgImgID = val;
                         else if (key == 'bgSoundID') bgSoundID = val;
                     }
                 } 
                 //console.log('bgImg=' + bgImgID + ', bgSound=' + bgSoundID);

                 // set environment according to user preferences.
                 $('#selectBgSound').val(bgSoundID);
                 $('#selectBgImg').val(bgImgID);
                 setChatroomBgImg(bgImgID);

                 var msg_logout = ' [<a href="#" onclick="doLogout();">Logout</a>] ';
                 //$('#div_logout').html(msg_logout);

                 $('#div_user').html(C_MSG['49'] + current_user);

                 client_get_room_list();
                 client_get_user_list();

                 // enable chatroom once logged in, so user can
                 // use command interface too, instead of must use 
                 // GUI for create/join room.
                 disableChatroom(false); 
                 appendChatroomInfo(C_MSG['50']);
                 appendChatroomInfo(C_MSG['13']);
             } else {
                 alert(C_MSG['51'], 'error');
                 document.getElementById('login_name').focus();
             }
         }
         function handle_cr_update_pwd(status, msg, code, tracker) {
             if (status != 'ok') {
                 //appendChatroomInfo('Error: ' + msg);
                 alert(C_MSG['52'] + msg);

                 if (code == 30) $('#updatepwd_old').focus(); 
                 else $('#updatepwd_new').focus(); 
                 return;
             }

             //appendChatroomInfo(msg);
             alert(C_MSG['53']);
             cancelUpdatePwd();
         }
         function handle_cr_update_pref(status, msg, code, tracker) {
             if (status != 'ok') {
                 //appendChatroomInfo('Error: ' + msg);
                 //alert(C_MSG['52'] + msg); // be silent on this.
                 return;
             }

             //appendChatroomInfo(msg);
         }

         function handle_cr_get_room_list_console(status, msg, code, tracker) {
             if (status != 'ok') {
                 updateInfo(msg, 'error');
                 return;
             }

             //msg = msg.split(',').sort().join(', ');
             var arr = msg.split(',');

             // remove room permission (:1 or :0).
             //arr = arr.map(function(x){ return x.substr(0, x.length - 2); });
             arr = arr.map(function(x){ return /:0$/.test(x) ? 
                 x.substr(0, x.length - 2) + ' (private)' : x.substr(0, x.length - 2); });
             msg = arr.sort().join(', ');
             appendChatroomInfo("#rooms: " + msg);
         }
         function handle_cr_get_room_list(status, msg, code, tracker) {
             if (request_src == 'console') {
                 handle_cr_get_room_list_console(status, msg, code, tracker);
                 request_src = '';
                 return;
             }

             //appendConsole('now populate room list: ' + msg);
             if (status == 'ok') {
                 // add to selectRoomsList
                 addToSelectRoomsList('selectRoomsList', '', msg);
                 setSelectOptionBgColor('selectRoomsList', current_room, '#ccddff');
             }
             else {
                 updateInfo(C_MSG['54'] + msg + '.', 'error');
             }
         }

         function addToSelectRoomsList(listName, empty_option, listItems) {
             var o = $('#' + listName);

             // clear all entries and insert empty option if any.
             o.children().remove();

             if (empty_option != '') {
                 o.append($('<option>', {
                     value: '',
                     text: empty_option
                 }));
             }

             if (listItems != '') {
                 var items = listItems.split(',').sort();
                 items.forEach(function(item_name) {
                     var leng = item_name.length;
                     var room = item_name.substr(0, leng - 2);
                     var is_public = item_name.substr(leng - 1, 1);
                     var bgImg = is_public == '1' ? 'url(../images/home.png)' : 'url(../images/lock.png)'

                     //if (room == '@Lobby') room = C_MSG['92'];

                     o.append($('<option>', {
                         value: room,
                         text: room
                     }).css('background-image', bgImg));
                 });
             }
         }

         function addToSelectList(listName, empty_option, listItems) {
             var o = $('#' + listName);

             // clear all entries and insert empty option if any.
             o.children().remove();

             if (empty_option != '') {
                 o.append($('<option>', {
                     value: '',
                     text: empty_option
                 }));
             }

             if (listItems != '') {
                 var items = listItems.split(',').sort();
                 items.forEach(function(item_name) {
                     o.append($('<option>', {
                         value: item_name,
                         text: item_name
                     }));
                 });
             }
         }
         function appendToSelectList(listName, item_name) {
             var o = $('#' + listName);
             o.append($('<option>', {
                 value: item_name,
                 text: item_name
             }));
         }
         function removeFromSelectList(listName, item_name) {
             //$('#' + listName + ' option[value=' + item_name + ']').remove();
             //above will have error when item_name is like: "user (2)".
             $('#' + listName + ' option').each(function() {
                 if ($(this).val() == item_name) {
                     $(this).remove();
                 }
             });
         }
         function setSelectOptionBgColor(listName, item_name, color) {
             if (color == '') { color = 'transparent'; }

             $('#' + listName + ' option[value=' + item_name + ']').css(
                 'background-color', color
             );
         }

         function handle_cr_get_user_list_console(status, msg, code, tracker) {
             if (status != 'ok') {
                 updateInfo(msg, 'error');
                 return;
             }
            
             msg = msg.split(',').sort().join(', ');
             appendChatroomInfo("#users: " + msg);
         }
         function handle_cr_get_user_list(status, msg, code, tracker) {
             if (request_src == 'console') {
                 handle_cr_get_user_list_console(status, msg, code, tracker);
                 request_src = '';
                 return;
             }

             //appendConsole('now populate user list: ' + msg);
             if (status == 'ok') {
                 // add to selectUsersList
                 addToSelectList('selectUsersList', '', msg);
             }
             else {
                 updateInfo('Error when get user list:' + msg + '.', 'error');
             }
         }

         function setRoomMasterIcon(user, isMaster) {
             if (user == '') return;

             var bgImg = isMaster ? 'url(../images/master.gif)' : 'url(../images/person.png)';
             var title = isMaster ? 'Room master' : '';

             $('#selectRoomUsersList option[value=' + user + ']').css(
                 'background-image', bgImg
             ).attr('title', title);
         }

         function handle_cr_get_room_user_list(status, msg, code, tracker) {
             if (status != 'ok') {
                 updateInfo(msg, 'error');
                 return;
             }

             var v = msg.split(':');
             var room_name = v[0];
             var room_master = v[1];
             var users = v[2];

             if (request_src == 'console_who') {
                 users = users.split(',').sort().join(', ');
                 appendChatroomInfo("#who: " + C_MSG['55'] + users);
             }
             else if (request_src == 'showRoomUsers') {
                 addToSelectList('selectRoomUsersList', '', users);
                 setRoomMasterIcon(room_master, true);
             }
             else {
                 users = users.split(',').sort().join(', ');
                 appendChatroomInfo(C_MSG['56'] + room_name + C_MSG['57'] + users);
             }
             request_src = '';
         }
         function handle_cr_create_room(status, msg, code, tracker) {
             request_src = '';
             if (status != 'ok') {
                 //updateInfo(msg, 'error');
                 appendChatroomError(current_msg + C_MSG['58'] + msg);
                 return;
             }

             var v = msg.split(':');
             //appendConsole("handle create room: " + v[0] + ", " + v[1]);
             var room_name = v[1];

             $('#spanCreateRoom').hide();

             if (current_room != '') {
                 appendChatroomInfo(C_MSG['59'] + current_room);
                 // clear background color of previous current_room.
                 setSelectOptionBgColor('selectRoomsList', current_room, '');
             }
             current_room = room_name;
             is_room_master = true;
             //disableChatroom(false);
            
             $('#div_room').html(C_MSG['60'] + room_name);
             appendChatroomInfo(C_MSG['61'] + room_name);
             appendConsole('You created and joined room: ' + room_name);

             showRoomUsers(room_name);
         }
         function handle_cr_invite(status, msg, code, tracker) {
             if (status != 'ok') {
                 appendChatroomError(current_msg + ': ' + msg);
                 return;
             }
             var v = msg.split(':');
             if (v.length < 2) {
                 updateInfo('invalid invite msg: ' + msg, 'error');
                 appendChatroom(C_MSG['62']);
                 return;
             }

             var invitee = v[0];
             appendChatroomInfo(C_MSG['63'] + invitee + C_MSG['64']);
         }
         function handle_cr_invite_reply(status, msg, code, tracker) {
             if (status != 'ok') {
                 appendChatroomError(msg);
                 return;
             }
             var v = msg.split(':');
             if (v.length < 3) {
                 updateInfo('invalid invite msg: ' + msg, 'error');
                 //appendChatroom('invalid invite reply message.');
                 return;
             }

             var inviter = v[0];
             var room = v[1];
             var reply = v[2];

             if (reply == 'Y') {
                 msg = C_MSG['65'] +
                       inviter + C_MSG['66'] + room;
             }
             else if (reply == 'N') {
                 msg = C_MSG['67'] +
                       inviter + C_MSG['66'] + room;
             }
             else if (reply == 'L') {
                 msg = C_MSG['68'] +
                       inviter + C_MSG['66'] + room + C_MSG['69'];
             } else {
                 msg = C_MSG['70'];
             }
             appendChatroomInfo(msg);
         }

         function handle_cr_master(status, msg, code, tracker) {
             if (status != 'ok') {
                 appendChatroomError(current_msg + ': ' + msg);
                 return;
             }
             if (tracker != current_tid) {
                 if (DEBUG) {
                     msg = 'master message with wrong tracker.';
                     //updateInfo(msg, 'error');
                     appendChatroomError('Error: ' + msg);
                 }
                 return;
             }

             var v = msg.split(':');
             var new_master = v[0];
             var old_master = v[1];
             var room_name = v[2]; // should be the same as current_room.

             msg = C_MSG['71'] + msg;
             appendChatroomInfo(msg);
             setRoomMaster(new_master, old_master, room_name);
             is_room_master = false; // current_user is no longer room master.
         }

         function handle_cr_kick(status, msg, code, tracker) {
             if (status != 'ok') {
                 appendChatroomError(current_msg + ': ' + msg);
                 return;
             }
             if (tracker != current_tid) {
                 if (DEBUG) {
                     msg = 'kick message with wrong tracker.';
                     //updateInfo(msg, 'error');
                     appendChatroomError('Error: ' + msg);
                 }
                 return;
             }

             var v = msg.split(':'); // kicked_user:room_master:room_name
             var user = v[0];
             var room_name = v[2]; // should be the same as current_room.

             msg = C_MSG['31'] + user + C_MSG['43'];
             appendChatroomInfo(msg);
         }

         function handle_cr_max(status, msg, code, tracker) {
             if (status != 'ok') {
                 appendChatroomError(current_msg + ': ' + msg);
                 return;
             }
             if (tracker != current_tid) {
                 if (DEBUG) {
                     msg = 'max message with wrong tracker.';
                     //updateInfo(msg, 'error');
                     appendChatroomError('Error: ' + msg);
                 }
                 return;
             }

             var v = msg.split(':'); // max_size:room_master:room_name
             var size = v[0];
             var room_name = v[2]; // should be the same as current_room.
             if (size == '0') size = C_MSG['93'];

             msg = C_MSG['72'] + size;
             appendChatroomInfo(msg);
         }

         function handle_cr_set_room_permission(status, msg, code, tracker) {
             if (status != 'ok') {
                 appendChatroomError(current_msg + ': ' + msg);
                 return;
             }
             if (tracker != current_tid) {
                 if (DEBUG) {
                     msg = 'set room permission message with wrong tracker.';
                     //updateInfo(msg, 'error');
                     appendChatroomError('Error: ' + msg);
                 }
                 return;
             }

             msg = C_MSG['73'] + (msg == '1' ? C_MSG['74'] : C_MSG['75']);
             appendChatroomInfo(msg);
         }

         function handle_cr_join_room(status, msg, code, tracker) {
             if (status != 'ok') {
                 //updateInfo(msg, 'error');
                 appendChatroomError(current_msg + ': ' + msg);
                 return;
             }
             if (tracker != current_tid && tracker != 0) { // 0 - from server.
                 if (DEBUG) {
                     msg = 'join room message with wrong tracker.';
                     //updateInfo(msg, 'error');
                     appendChatroomError('Error: ' + msg);
                 }
                 return;
             }

             var v = msg.split(':');
             if (v.length < 2 || v[1] == '') {
                 updateInfo("join_room: " + C_MSG['76']);
                 return;
             }
             var room_name = v[1];

             $('#spanCreateRoom').hide();

             if (current_room != '') {
                 setSelectOptionBgColor('selectRoomsList', current_room, '');
             }
             current_room = room_name;
             setSelectOptionBgColor('selectRoomsList', room_name, '#ccddff');
             is_room_master = false;
             //disableChatroom(false);

             $('#div_room').html(C_MSG['60'] + room_name);
             appendChatroomInfo(C_MSG['77'] + room_name);
             appendConsole('You joined room: ' + room_name);

             showRoomUsers(room_name);
         }
         function handle_cr_leave_room(status, msg, code, tracker) {
             if (status != 'ok') {
                 appendChatroomError(current_msg + ': ' + msg);
                 return;
             }
             if (tracker != current_tid && tracker != 0) { // 0 - from server.
                 if (DEBUG) {
                     msg = 'leave room message with wrong tracker.';
                     appendConsole(msg, 'error');
                 }
                 appendChatroomError(msg);
                 return;
             }

             $('#div_room').html(C_MSG['60']);
             appendChatroomInfo(C_MSG['59'] + current_room);

             $('#spanCreateRoom').show();

             setSelectOptionBgColor('selectRoomsList', current_room, '');
             hideRoomUsers();

             current_room = '';
             is_room_master = false;
             //disableChatroom(true);
         }
         function handle_cr_speak(status, msg, code, tracker) {
             if (status != 'ok') {
                 //updateInfo(msg, 'error');
                 msg = C_MSG['78'];
                 appendChatroom('<font color="red">' + msg + '</font>');
                 return;
             }
             if (tracker != current_tid) {
                 if (DEUBG) {
                     msg = 'speak message with wrong tracker.';
                     //appendChatroom('<font color="red">Wrong tracker ' 
                     //               + tracker + ': ' + msg + '</font>');
                     // Note this is possible when the user speaks too fast that
                     // he sends a msg before response of the first msg comes back.
                     return;
                 }
                 return;
             }
             doSpeak(msg, '', current_user, true);
         }
         function handle_cr_whisper(status, msg, code, tracker) {

         }
         function handle_cr_broadcast(status, msg, code, tracker) {

         }
         function handle_cr_admin_show_table(status, msg, code, tracker) {

         }
         function handle_cr_logout(status, msg, code, tracker) {
             // basically, won't get this.
             if (status == 'ok') {
                 $('#div_logout').html('');
                 appendChatroomInfo(C_MSG['79'], 'info');
                 //$('#span_login').show();
                 //cleanup_logout();
                 getInputFocus();
             }
             else {
                 updateInfo(msg);
                 //cleanup_logout(); // should do cleanup no matter what.
             }
         }
         function cleanup_logout() {
             // clean up the select room list.
             $('#selectRoomsList').children().remove();
             $('#selectUsersList').children().remove();

             showAllUsersPanel();
             $('#selectRoomUsersList').children().remove();
             $('#span_room_users').hide();

             $('#spanCreateRoom').show();
             current_user = '';
             current_room = '';
             disableChatroom(true);

             $('#div_logout').html('');
             $('#div_user').html(C_MSG['57']);
             $('#div_room').html(C_MSG['60']);
             updateInfo('');
         }

         function client_get_room_list() {
             var tracker = make_tracker();
             var msg = '{"cmd":"get_room_list", "tracker":"' + tracker + '"}';
             send_data(msg);
         }
         function client_get_user_list() {
             var tracker = make_tracker();
             var msg = '{"cmd":"get_user_list", "tracker":"' + tracker + '"}';
             send_data(msg);
         }

         function showAllUsersPanel() {
             $('#selectUsersList').show();
             $('#selectRoomUsersList').hide();

             $('#span_all_users').css('background-color', '#ccddff');
             $('#span_room_users').css('background-color', '#99bbff');

             $('#span_all_users').css('color', 'black');
             $('#span_room_users').css('color', '#eeeeff');
         }

         function showRoomUsersPanel() {
             $('#selectUsersList').hide();
             $('#selectRoomUsersList').show();

             $('#span_all_users').css('background-color', '#99bbff');
             $('#span_room_users').css('background-color', '#ccddff');

             $('#span_all_users').css('color', '#eeeeff');
             $('#span_room_users').css('color', 'black');
         }

         function showRoomUsers(room_name) {
             $('#span_room_users').show();
             showRoomUsersPanel();

             request_src = "showRoomUsers";
             current_cmd = "get_room_user_list";
             var data = '{"cmd":"get_room_user_list", "room_name":"' + 
                    room_name + '", "tracker":"' + current_tid + '"}';
             send_data(data);
         }

         function hideRoomUsers() {
             $('#span_room_users').hide();
             showAllUsersPanel();
         }

         function formRegEnter(e) {
             //if(e.which === 13) { doRegister(); }
         }

         function formLoginEnter(e) {
             //if(e.which === 13) { doLogin(); }
         }

         function showSettings() {
             $('#panel_settings').show();
         }

         function getMousePosInDiv(e, div_id) {
             var mouse_x = (window.Event) ? e.pageX : event.clientX +
                 (document.documentElement.scrollLeft ? document.documentElement.scrollLeft : document.body.scrollLeft);
             var mouse_y = (window.Event) ? e.pageY : event.clientY + 
                 (document.documentElement.scrollTop ? document.documentElement.scrollTop : document.body.scrollTop);
             //return {'x': mouse_x, 'y': mouse_y};

             var div_pos = $('#' + div_id).offset();
             return {'x' : mouse_x - div_pos.left, 'y' : mouse_y - div_pos.top};
         }

         function hideSettings(event, _this) {
             var e = event.toElement || event.relatedTarget;
             //alert(event + ':' + e + ':' + _this + ' - ' + event);

             while (e != null) {
                 if (e == _this) return;
                 e = e.parentNode;
             }

             // for other elements that while loop above does not work.
             var pos = getMousePosInDiv(event, 'panel_settings');
             var x = pos.x, y = pos.y;
             //$('#div_msg').html(x + ',' + y); return;
             // 134, 213: width/height of panel_settings.
             if (x >= 0 && x <= 134 && y >= 0 && y <= 213) return;

             $('#panel_settings').hide();
         }

         function getTimeStamp() {
             return getDateTime(1);
         }

         function getDateTime(mode) {
             var now= new Date(); 
             var year    = now.getFullYear();
             var month   = now.getMonth()+1; 
             var day     = now.getDate();
             var hour    = now.getHours();
             var minute  = now.getMinutes();
             var second  = now.getSeconds(); 
             if(month.toString().length == 1) {
                 var month = '0'+month;
             }
             if(day.toString().length == 1) {
                 var day = '0'+day;
             }   
             if(hour.toString().length == 1) {
                 var hour = '0'+hour;
             }
             if(minute.toString().length == 1) {
                 var minute = '0'+minute;
             }
             if(second.toString().length == 1) {
                 var second = '0'+second;
             }   

             var dateTime;
             if (mode == 1) {
                 dateTime = +hour+':'+minute+':'+second;
             } else {
                 dateTime = year+'/'+month+'/'+day+' '+hour+':'+minute+':'+second;   
             }
             return dateTime;
         }

         function setChatroomBgImg(id) {
             var bgImg = 'none';
             var bgSize = '100% 100%';

             if (id == '1') { bgImg = 'url(../images/matrix1024.gif)'; bgSize = '50% 50%' }
             else if (id == '2') { bgImg = 'url(../images/universe.jpg)'; bgSize = '100% 100%'; }
             else if (id == '3') { bgImg = 'url(../images/beach.jpg)'; }
             else if (id == '4') { bgImg = 'url(../images/greatwall.jpg)'; }

             $('#chatroom').css('background-image', bgImg);
             $('#chatroom').css('background-size', bgSize);

             bgImgSize = bgSize;

             getInputFocus();
         }

         // v: field:value pair.
         function send_msg_pref(pref) {
             var current_tid = make_tracker();
             var data = '{"cmd":"update_pref", "pref":"' + pref +
                    '", "tracker":"' + current_tid + '"}';
             send_data(data);
         }

         //
         // If do_set is false, clear Screen Saver image, and set background image.
         // otherwise, set background image.
         // This gif is large. So first display a small static image,
         // download this gif and then replace it.
         //
         function setChatroomScrSaver(do_set) {
             if (! do_set) {
                 //setChatroomBgImg(bgImgID);
                 return;
             }

             var screensaver_img = '../images/matrix1024.gif';
             var screensaver_img_url = 'url(' + screensaver_img + ')';
             
             if (bgImg_downloaded) {
                 $('#chatroom').css('background-image', screensaver_img_url);
                 $('#chatroom').css('background-size', '50% 50%');
                 getInputFocus();
                 return;
             }

             var _images = [screensaver_img];
             $.each(_images, function (e) {
                 $(new Image()).load(function () {
                     //alert($(this).attr('src') + ' has loaded!');
                     $('#chatroom').css('background-image', screensaver_img_url);
                     $('#chatroom').css('background-size', '50% 50%');
                     bgImg_downloaded = true;
                     getInputFocus();
                 }).attr('src', this);
             });
         }


         $(document).ready(function() {

             $('#txtNewRoom').keyup(function (e) {
                 if(e.which === 13) {
                     doCreateRoom( $(this).val() );
                 }
             });

             $('#btnClearConsole').click(function() {
                 $('#console').html('');
             });

             getInputFocus();

             if (DEBUG) {
                 $('#debug_console').show();
             }

             $('#cbToggleDebug').click(function() {
                 if ($(this).prop('checked')) { 
                     $('#btnClearConsole').show();
                     $('#console').show();
                 } else {
                     $('#btnClearConsole').hide();
                     $('#console').hide();
                 }
             });


             $('#selectRoomsList').dblclick(function () {
                 $("#selectRoomsList option:selected").each(function () {
                     //alert('hi: ' + $(this).val());
                     if ($(this).val() == current_room) {
                         appendChatroomInfo(C_MSG['80'] + current_room);
                     } else {
                         var room = $(this).val();
                         //if (room == C_MSG['92']) room = '@Lobby';
                         current_msg = current_cmd = '#join ' + room;
                         doJoinRoom(room);
                     }
                 });
             });

             $('#selectRoomsList').blur(function() {
                 // de-select all rows.
                 document.getElementById('selectRoomsList').selectedIndex = -1;
             });
 
             $('#selectUsersList').blur(function() {
                 // de-select all rows.
                 document.getElementById('selectUsersList').selectedIndex = -1;
             });

             $('#selectRoomUsersList').blur(function() {
                 document.getElementById('selectRoomUsersList').selectedIndex = -1;
             });

             $('#span_all_users').click(function() {
                 showAllUsersPanel();
             });

             $('#span_room_users').click(function() {
                 showRoomUsersPanel();
             });


             $('#reg_name').watermark(C_MSG['81']);
             $('#reg_pwd').watermark(C_MSG['82']);
             $('#reg_pwd2').watermark(C_MSG['83']);

             $('#login_name').watermark(C_MSG['81']);
             $('#login_pwd').watermark(C_MSG['82']);

             $('#updatepwd_old').watermark(C_MSG['84']);
             $('#updatepwd_new').watermark(C_MSG['85']);
             $('#updatepwd_new2').watermark(C_MSG['86']);

             $('#cbSendMode').click(function() {
                 toggleSendMode();
                 getInputFocus();
             });

             toggleSendMode();


             $(".fancybox").fancybox({
                 'width': '75%',
                 'height': '75%',
                 'autoScale': false,
                 'transitionIn': 'none',
                 'transitionOut': 'none',
                 'type': 'iframe'
             });

             setChatroomScrSaver(true);
             $('#selectBgImg').val(bgImgID); // initialize to client default.

             $('#selectBgImg').change(function() {
                 //alert($(this).val());
                 bgImgID = $(this).val();
                 setChatroomBgImg(bgImgID);
                 send_msg_pref("bgImgID:" + bgImgID);
             });

             $('#selectBgSound').val(bgSoundID);
             $('#selectBgSound').change(function() {
                 bgSoundID = $(this).val();
                 send_msg_pref("bgSoundID:" + bgSoundID);
             });

             doDisconnect(true); // initialize to clean state.
             if (AUTO_CONNECT != '') {
                 $('#div_server').hide();
                 current_cmd = 'doConnect';
                 doConnect();
             }

             // Force logout if user closes browser window.
             $(window).bind("beforeunload", function() {
                 //return true || confirm('bye');
                 doLogout(true);
             });
         });

