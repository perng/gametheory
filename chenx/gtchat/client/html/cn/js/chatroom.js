/**
 * Javascript for chatroom.
 * @author: X. C.
 * @since: April, 2015
 */

         var socket = null;
         var isopen = false;
         var current_cmd = '';  // keep track of current status.
         var current_msg = '';  // keep track of current message.
         var arrow_mode = false; // to flip input by arrow keys.
         var current_tid = '';  // keep track of current tracker id.
         var current_user = ''; // keep track of current logged in user.
         var current_room = ''; // keep track of current room.
         var is_room_master = false;  // Whether this user is room master.
         var request_src = ''; // used for command line requests @rooms, @users.
         var bgImg_downloaded = false;
         var bgImgID = 2;

         // If this is not empty, the server textbox and connect button will
         // be hidden, and when the page is loaded it'll automatically connect to 
         // server given by the value of AUTO_CONNECT.
         var AUTO_CONNECT = ''; 
         //AUTO_CONNECT = 'ws://127.0.0.1:9001';
         AUTO_CONNECT = 'ws://192.168.198.131:9001';
         //AUTO_CONNECT = 'ws://homecox.com:9001';

         // If DEBUG is true, the debug console will be shown.
         var DEBUG = true;
         DEBUG = false;

         if (typeof String.prototype.startsWith != 'function') {
             String.prototype.startsWith = function (str){
                 //return this.indexOf(str) === 0; // O(n)
                 return this.slice(0, str.length) == str; // O(1)
             };
         }

         function send_data(data) {
             appendConsole('==> Send: ' + data);
             socket.send(data);
         }

         // if server message contains a message code, get it.
         // note: indexOf() returns -1 if not exist.
         // but here if server message contains '|', its position always > 0.
         function getJoMsg(v) {
             var code;
             var msg;
             //return {'code' : '', 'msg' : v};

             if (v.indexOf('|') > 0) {
                 v = v.split('|');
                 code = v[0];
                 msg = (typeof S_MSG[code] == 'undefined') ? v[1] : S_MSG[code];
             } else {
                 code = ''; // code does not exist.
                 msg = v;
             }

             return {
                 'code' : code,
                 'msg'  : msg
             };
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
                   //dispConnectionStatus('<img src="images/people.png" style="height:40px; vertical-align:middle;">');
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
            document.getElementById('selectBgImg').disabled = v;
            setChatroomScrSaver(v);
            //document.getElementById('btnSendBin').disabled = v;
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

               if (msg == '@rooms') {
                   request_src = 'console';
                   current_cmd = "get_room_list";
                   data = '{"cmd":"get_room_list", "tracker":"' + current_tid + '"}';
                   send_data(data);
                   //appendChatroomInfo(msg + ":");
               }
               else if (msg == '@users') {
                   request_src = "console"
                   current_cmd = "get_user_list";
                   data = '{"cmd":"get_user_list", "tracker":"' + current_tid + '"}';
                   send_data(data);
                   //appendChatroomInfo(msg + ":");
               }
               else if (msg == '@help') {
                   appendChatroomInfo(msg + 
": @rooms (list rooms), @who (list room users), @users (list logged in users), @create {room} (create and join a new room), @join {room} (join an existing room), @invite {user} (invite a user to current room), @leave (leave a room), @where (show current room name), @public (set room as public), @private (set room as private), @master {user} (assign another room user as master), @kick {user} (kick a user out of current room), @max {max_size} (set room max size), @passwd {new password} (update password), @logout (logout)");
               }
               else if (msg == '@leave') {
                   doLeaveRoom();
               }
               else if (msg == '@create') {
                   appendChatroomInfo('@create: ' + C_MSG['11']);
               }
               else if (msg.startsWith('@create ')) {
                   request_src = "console";
                   var room_name = msg.substr(8); // after '@create '
                   var err = validateRoomname(room_name);
                   if (err != '') {
                       appendChatroomInfo('@create: ' + err);
                   } else {
                       appendConsole('Now create room: ' + room_name);
                       doCreateRoom(room_name);
                   }
               }
               else if (msg == '@join') {
                   appendChatroomInfo('@create: ' + C_MSG['11']);
               }
               else if (msg.startsWith('@join ')) {
                   var room_name = msg.substr(6); // after '@join '
                   var err = validateRoomname(room_name);
                   if (err != '') {
                       appendChatroomInfo('@join: ' + err);
                   } else {
                       appendConsole('Now join room: ' + room_name);
                       doJoinRoom(room_name);
                   }
               }
               else if (msg == '@logout') {
                   doLogout();
               }
               else if (msg == '@passwd') {
                   showFormUpdatePwd();
               }
               // All commands below need a non-empty current_room.
               else if (current_room == '') {
                   //appendChatroomInfo('>> ' + msg);
                   appendChatroomInfo(C_MSG['12'] + + msg);
                   appendChatroomInfo(C_MSG['13']);
                   appendConsole('Type message before join a room:' + msg);
               }
               else if (msg == '@who') {
                   request_src = "console_who";
                   current_cmd = "get_room_user_list";
                   data = '{"cmd":"get_room_user_list", "room_name":"' + current_room + '", "tracker":"' + current_tid + '"}';
                   send_data(data);
                   //appendChatroomInfo(msg + ":");
               }
               else if (msg == '@where') {
                   appendChatroomInfo('@where: ' + C_MSG['14'] + current_room);
               }
               else if (msg == '@invite') {
                   appendChatroomInfo('@create: ' + C_MSG['15']);
               }
               else if (msg == '@private' || msg == '@public') { // Only room master can do this.
                   if (! is_room_master) {
                       appendChatroomInfo(msg + ': ' + C_MSG['16']);
                   }   
                   else {
                       current_cmd = "set_room_permission";
                       var is_public = (msg == '@public' ? 1 : 0);
                       data = '{"cmd":"set_room_permission", "permission":"' + is_public + '", "room_name":"' + 
                              current_room + '", "tracker":"' + current_tid + '"}';
                       send_data(data);
                   }
               }
               else if (msg.startsWith('@invite ')) {
                   var user_name = $.trim( msg.substr(8) ); // after '@invite '
                   var err = validateUsername(user_name);
                   if (err != '') {
                       appendChatroomInfo('@invite: ' + err);
                   } else {
                       appendConsole('Now invite: ' + user_name);
                       doInvite(user_name);
                   }
               }
               else if (msg == '@master') {
                   appendChatroomInfo('@master: ' + C_MSG['15']);
               }
               else if (msg.startsWith('@master ')) {
                   if (! is_room_master) {
                       appendChatroomInfo('@master: ' + C_MSG['16']);
                   }
                   else {
                       var user_name = $.trim(msg.substr(8)); //after '@master'
                       var err = validateUsername(user_name);
                       if (err != '') {
                           appendChatroomInfo('@master: ' + err);
                       } else {
                           doMaster(user_name, current_room);
                       }
                   }
               }
               else if (msg == '@kick') {
                   appendChatroomInfo('@kick: ' + C_MSG['15']);
               }
               else if (msg.startsWith('@kick ')) {
                   if (! is_room_master) {
                       appendChatroomInfo('@kick: ' + C_MSG['16']);
                   }
                   else {
                       var user_name = $.trim(msg.substr(6)); //after '@kick'
                       var err = validateUsername(user_name);
                       if (err != '') {
                           appendChatroomInfo('@kick: ' + err);
                       } else {
                           doKick(user_name, current_room);
                       }
                   }
               }
               else if (msg == '@max') {
                   appendChatroomInfo('@max: ' + C_MSG['17']);
               }
               else if (msg.startsWith('@max ')) {
                   if (! is_room_master) {
                       appendChatroomInfo('@max: ' + C_MSG['16']);
                   }
                   else {
                       current_cmd = "max";
                       var max_size = $.trim( msg.substr(5) ); // after '@max '
                       if (! isInt(max_size)) {
                           appendChatroomInfo('@max: ' + max_size + C_MSG['18']);
                       }
                       else {
                           if (max_size < 0) max_size = 0;
                           data = '{"cmd":"max", "size":"' + max_size + '", "room_name":"' +
                                  current_room + '", "tracker":"' + current_tid + '"}';
                           send_data(data);
                       }
                   }
               }
               else {
                   current_cmd = "speak";
                   //alert(msg);
                   data = '{"cmd":"speak", "room_name":"' + current_room + '", "msg":"' + strEncode(msg) + 
                          '", "tracker":"' + current_tid + '"}';
                   send_data(data);
                   //console.log("Text message sent: " + msg);
                   msg = decodeNewLine(msg);
                   //appendChatroom('<font color="#99ff99">>> ' + getTimeStamp() + '<br/>' + msg + '</font>');
                   doSpeak(msg, current_user, true);
               }
            } else {
               //console.log("Connection not opened.")
               appendChatroom("<font color='red'>" + C_MSG['19'] + "</font>");
            }
         }

         function doSpeak(msg, usr, isMe) {
             var t = getTimeStamp();
             var color = isMe ? ' color="#99ff99"' : '';
             var author = '>> ' + usr + ' ' + t;
             if (isMe) {
                 author = '<span style="font-size:10pt; color:#ccffcc;">' + author + '</span>';
                 msg = '<span style="color: #99ff99;">' + msg + '</span>';
             }
             else {
                 author = '<span style="font-size:10pt; color: #cccccc;">' + author + '</span>';
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
         }
         function appendChatroomError(msg) {
             appendChatroom('<font color="red">' + msg + '</font>');
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

             // If current txtMsg is empty, press arrow keys to flip
             // in/out the last input for convenience.
             if ($('#txtMsg').val() == '' && (e.keyCode == 38 || e.keyCode == 37)) {
                 // 38: up arrow, 37: left arrow.
                 $('#txtMsg').val(current_msg);
                 arrow_mode = true;
                 return;
             }
             else if (arrow_mode == true && (e.keyCode == 40 || e.keyCode == 39)) {
                 // 40: down array, 39: right arrow.
                 $('#txtMsg').val('');
                 arrow_mode = false;
                 return;
             }

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
         function doLogout() {
             if (! confirm(C_MSG['24'])) return;

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
                 appendChatroomInfo('@leave ' + C_MSG['25']);
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
             data = '{"cmd":"master", "user":"' + user + '", "room_name":"'
                      + room + '", "tracker":"' + current_tid + '"}';
             send_data(data);
         }
         function doKick(user, room) {
             current_tid = make_tracker();
             current_cmd = "kick";
             data = '{"cmd":"kick", "user":"' + user + '", "room_name":"' +
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

         function handle_c_response(jo) {
             var status = jo.status;
             var last_cmd = jo.last_cmd;
             //var msg = jo.msg;
             var jo_msg = getJoMsg(jo.msg);
             var code = jo_msg.code;
             var msg = jo_msg.msg;
             var tracker = jo.tracker;
             //dump(':response: ' + status + ', ' + last_cmd + ', ' + msg + ',' + tracker);

             if (status == 'ok') { updateInfo(''); }

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
             //var msg = jo.msg;
             var jo_msg = getJoMsg(jo.msg);
             var code = jo_msg.code;
             var msg = jo_msg.msg;
             var usr = jo.usr;
             var room_name = jo.room_name;
             var tracker = jo.tracker;
             //dump(':speak: ' + msg + ',' + room_name + ',' + tracker);
             msg = strDecode(msg);
             //appendChatroom('>> ' + usr + ': ' + getTimeStamp() + '<br/>' + msg);
             doSpeak(msg, usr, false);
         }
         function handle_c_whisper(jo) {
             //var msg = jo.msg;
             var jo_msg = getJoMsg(jo.msg);
             var code = jo_msg.code;
             var msg = jo_msg.msg;
             var usr = jo.usr;
             var tracker = jo.tracker;
             dump(':whisper: ' + msg + ',' + usr + ',' + tracker);
         }
         function handle_c_broadcast(jo) {
             //var msg = jo.msg;
             var jo_msg = getJoMsg(jo.msg);
             var code = jo_msg.code;
             var msg = jo_msg.msg;
             var usr = jo.usr;
             var tracker = jo.tracker;
             dump(':boradcast: ' + msg + ',' + usr + ',' + tracker);
         }
         function handle_c_invited(jo) {
             //var msg = jo.msg;
             var jo_msg = getJoMsg(jo.msg);
             var code = jo_msg.code;
             var msg = jo_msg.msg;
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
             //var msg = jo.msg;
             var jo_msg = getJoMsg(jo.msg);
             var code = jo_msg.code;
             var msg = jo_msg.msg;
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

             var bgImg = is_public ? 'url(images/home.png)' : 'url(images/lock.png)';
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
             $('#selectUsersList option[value=' + user_name + ']').remove();
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
                 // logs in with multple sessions.

                 var v = msg.split(':');  // msg: user:preference
                 current_user = v[0];     // $('#login_name').val();
                 bgImgID = v[1];

                 // set background image dropdown list selected value.
                 $('#selectBgImg').val(bgImgID);

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
             appendChatroomInfo("@rooms: " + msg);
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
                     var bgImg = is_public == '1' ? 'url(images/home.png)' : 'url(images/lock.png)'

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
             $('#' + listName + ' option[value=' + item_name + ']').remove();
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
             appendChatroomInfo("@users: " + msg);
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
             var bgImg = isMaster ? 'url(images/master.gif)' : 'url(images/person.png)';
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
                 appendChatroomInfo("@who: " + C_MSG['55'] + users);
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
                 appendChatroomError('@create ' + C_MSG['58'] + msg);
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
                 appendChatroomInfo(current_msg + ': ' + msg);
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
                 appendChatroomInfo(msg);
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
                 appendChatroomInfo(current_msg + ': ' + msg);
                 return;
             }
             if (tracker != current_tid) {
                 if (DEBUG) {
                     msg = 'master message with wrong tracker.';
                     //updateInfo(msg, 'error');
                     appendChatroomInfo('Error: ' + msg);
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
                 appendChatroomInfo(current_msg + ': ' + msg);
                 return;
             }
             if (tracker != current_tid) {
                 if (DEBUG) {
                     msg = 'kick message with wrong tracker.';
                     //updateInfo(msg, 'error');
                     appendChatroomInfo('Error: ' + msg);
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
                 appendChatroomInfo(current_msg + ': ' + msg);
                 return;
             }
             if (tracker != current_tid) {
                 if (DEBUG) {
                     msg = 'max message with wrong tracker.';
                     //updateInfo(msg, 'error');
                     appendChatroomInfo('Error: ' + msg);
                 }
                 return;
             }

             var v = msg.split(':'); // max_size:room_master:room_name
             var size = v[0];
             var room_name = v[2]; // should be the same as current_room.

             msg = C_MSG['72'] + size;
             appendChatroomInfo(msg);
         }

         function handle_cr_set_room_permission(status, msg, code, tracker) {
             if (status != 'ok') {
                 appendChatroomInfo(current_msg + ': ' + msg);
                 return;
             }
             if (tracker != current_tid) {
                 if (DEBUG) {
                     msg = 'set room permission message with wrong tracker.';
                     //updateInfo(msg, 'error');
                     appendChatroomInfo('Error: ' + msg);
                 }
                 return;
             }

             msg = C_MSG['73'] + (msg == '1' ? C_MSG['74'] : C_MSG['75']);
             appendChatroomInfo(msg);
         }

         function handle_cr_join_room(status, msg, code, tracker) {
             if (status != 'ok') {
                 //updateInfo(msg, 'error');
                 appendChatroomInfo(current_msg + ': ' + msg);
                 return;
             }
             if (tracker != current_tid && tracker != 0) { // 0 - from server.
                 if (DEBUG) {
                     msg = 'join room message with wrong tracker.';
                     //updateInfo(msg, 'error');
                     appendChatroomInfo('Error: ' + msg);
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
                 appendChatroomInfo(current_msg + ': ' + msg);
                 return;
             }
             if (tracker != current_tid && tracker != 0) { // 0 - from server.
                 if (DEBUG) {
                     msg = 'leave room message with wrong tracker.';
                     appendConsole(msg, 'error');
                 }
                 appendChatroomInfo(msg);
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
                 appendChatroom('<font color="red">' + C_MSG['78'] + '(tracker: ' 
                                + tracker + '): ' + msg + '</font>');
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
             data = '{"cmd":"get_room_user_list", "room_name":"' + 
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
             // 134, 163: size of panel_settings.
             if (x >= 0 && x <= 134 && y >= 0 && y <= 163) return;

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

             if (id == '1') { bgImg = 'url(images/matrix1024.gif)'; bgSize = '50% 50%' }
             else if (id == '2') { bgImg = 'url(images/universe.jpg)'; bgSize = '100% 100%'; }
             else if (id == '3') { bgImg = 'url(images/beach.jpg)'; }
             else if (id == '4') { bgImg = 'url(images/greatwall.jpg)'; }

             $('#chatroom').css('background-image', bgImg);
             $('#chatroom').css('background-size', bgSize);

             getInputFocus();
         }

         // v: field:value pair.
         function send_msg_pref(pref) {
             var current_tid = make_tracker();
             data = '{"cmd":"update_pref", "pref":"' + pref +
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
                 setChatroomBgImg(bgImgID);
                 return;
             }

             var screensaver_img = 'images/matrix1024.gif';
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
                 if ($(this).attr('checked')) { 
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
                         doJoinRoom($(this).val());
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

             doDisconnect(true); // initialize to clean state.
             if (AUTO_CONNECT != '') {
                 $('#div_server').hide();
                 current_cmd = 'doConnect';
                 doConnect();
             }
         });

