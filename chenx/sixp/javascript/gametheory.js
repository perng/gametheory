/*
 * Sixp Remote Play JavaScript Library v0.1
 *
 * Copyright 2015, Xin Chen
 * Licensed under the MIT license. 
 *
 * Date: Tue Mar 31 16:16:00 - 03/31/2015
 */

if (typeof (Chess6p_Remote) === 'undefined') {

    // String.starsWith exists in firefox, but not in iOS safari and maybe other browsers.
    if (typeof String.prototype.startsWith != 'function') {
        String.prototype.startsWith = function (str){
            //return this.indexOf(str) === 0; // O(n)
            return this.slice(0, str.length) == str; // O(1)
        };
    }
    
    var Chess6p_Remote = function() {
        this.DEBUG = true;
        this.DEBUG = false;

        this.ws = "ws://gametheory.olidu.com:80";
        this.ws = "ws://homecox.com:9000";

        // if these values will be accessed in UI by jquery or javascript DOM, 
        // so cannot be accessed as private value. must define as public, and use 'this.'.
        // well, it seems like int type is ok, but for string type must declare as public
        this.iconPlayerOn  = ' <img src="image/head_yellow.png" style="vertical-align:middle;">&nbsp;';
        this.iconPlayerOff = ' <img src="image/head_gray.png" style="vertical-align:middle;">&nbsp;';
        this.C_RESET_GAME = 'reset_game';
        this.C_REPLY_RESET_GAME = 'reply_reset_game';  // private variable, can be accessed w/o this.
        this.C_REPLY_RESET_GAME_LEN = this.C_REPLY_RESET_GAME.length;

        var socket = null;
        var isopen = false;
        var current_cmd = '';  // keep track of current status.
        var current_tid = '';  // keep track of current tracker id.
        var current_user = ''; // keep track of current logged in user.
        var current_room = ''; // keep track of current room.

        var current_player_id = '';
        var current_table_id = '';
        this.current_is_black = false; // whether is black side (play first).
        var current_players;

        this.remote_game_started = false; // control whether be able to play with this.
        this.both_sides_connected = false; // true when both players are connected.
    }

    Chess6p_Remote.prototype.isRemotePlay = function() {
        return document.getElementById("cbRemote").checked;
    }

    Chess6p_Remote.prototype.showRegForm = function() {
        $('#form_login').hide();
        $('#link_reg').hide();
        $('#form_reg').show();
        this.showInfo('');
    }

    Chess6p_Remote.prototype.hideRegForm = function() {
        $('#form_login').show();
        $('#link_reg').show();
        $('#form_reg').hide();
        this.showInfo('');
    }

    Chess6p_Remote.prototype.doRegister = function() {
        var usr = document.getElementById('reg_name').value.trim();
        var pwd = document.getElementById('reg_pwd').value.trim();
        if (usr == '' || pwd == '') {
            this.showInfo('Register failed: name and uuid cannot be empty.', 'error');
            if (usr == '') { document.getElementById('reg_name').focus(); }
            else           { document.getElementById('reg_pwd').focus();  }
            return;
        }
    
        this.appendConsole('register');
        this.showInfo('Register ...');
        current_cmd = "register";
        this.doConnect();
    }

    Chess6p_Remote.prototype.doLogout = function() {
        $('#selectGameRoom').removeAttr('disabled');
        location.reload();
    }

    Chess6p_Remote.prototype.doJoinRoom = function() {
        var room_id = $('#selectGameRoom').val();
        if (room_id == '') {
            alert('Please select a valid game room');
            return;
        }
    
        this.send_msg_sit(room_id);
    }

    Chess6p_Remote.prototype.doLeaveRoom = function() {
        if (this.remote_game_started) {
            if (! confirm('Leaving room will abandon unfinished game. Continue?')) {
                return;
            }
        }
        if (current_table_id == '') return;
        this.send_msg_leave(current_table_id);
    }

    Chess6p_Remote.prototype.showLoginForm = function(show) {
        if(show) {  
            if( ! window.WebSocket ) {
                this.showInfo('You browser does not support websocket.<br/>Cannot play remotely.', 
                              'error');
                return;
            }

            $('#form_login').show();
            $('#link_reg').show();
            $('#div_players').show();
            document.getElementById('gameLevel').disabled = true;
            document.getElementById('comSide').disabled = true;
        } else {
            if( ! window.WebSocket ) {
                this.showInfo('');
            }

            $('#form_login').hide();
            $('#link_reg').hide();
            $('#div_players').hide();
            document.getElementById('gameLevel').disabled = false;
            document.getElementById('comSide').disabled = false;
        }
    }

    Chess6p_Remote.prototype.doLogin = function() {
        if ($.trim( $('#login_id').val() ) == '') {
            this.showInfo('Please enter Player ID');
            $('#login_id').focus();
            return;
        }
        this.appendConsole('login');
        this.showInfo('Connecting to server ...');
        current_cmd = "login";
        this.doConnect();
    }

    Chess6p_Remote.prototype.turnOnGameRoomUI = function(v) {
        if (v) {
            $('#span_game_room').show();
        } else {
            $('#span_game_room').hide();
        }
    }

    Chess6p_Remote.prototype.send_msg_register = function() {
        var usr = document.getElementById('reg_name').value.trim();
        var pwd = document.getElementById('reg_pwd').value.trim();
    
        current_tid = this.make_tracker();
        var msg = '{"_tracker": ' + current_tid + ', "cmd": "register", "player_name": "' +
                  usr + '", "uuid": "' + pwd + '", "uuid_type": "WEB"} ';
        //alert(msg);
    
        current_cmd = 'register';
        this.send_data(msg);
    }

    Chess6p_Remote.prototype.send_msg_login = function() {
        //var name = $.trim( $('#login_name').val() );
        //var pwd  = $.trim( $('#login_pwd').val() );
        var id = $.trim( $('#login_id').val() );
        var tracker = this.make_tracker();
        current_cmd = "login";
        current_player_id = id;
    
        var msg = '{"player_id": ' + id + ', "_tracker": ' + tracker +
        ', "cmd": "login"}';
        this.send_data(msg);
    }

    Chess6p_Remote.prototype.send_msg_get_game_rooms = function() {
        var tracker = this.make_tracker();
        current_cmd = "get_game_rooms";
        game_name = 'Six Pieces';
    
        var msg = '{"_tracker": ' + tracker + ', "cmd": "' + current_cmd + 
                  '", "game_name": "' + game_name + '"}';
        this.send_data(msg);
    }

    Chess6p_Remote.prototype.send_msg_sit = function(room_id) {
        var tracker = this.make_tracker();
        current_cmd = "sit";
        var msg='{"_tracker": ' + tracker + 
                ', "cmd": "sit_for_auto_match_game", "room_id": ' + room_id + '}';
        this.send_data(msg);
    }

    Chess6p_Remote.prototype.send_msg_leave = function(table_id) {
        var tracker = this.make_tracker();
        current_cmd = "leave";
        var msg='{"_tracker": ' + tracker +
                ', "cmd": "leave_table", "table_id": ' + table_id + '}';
        this.send_data(msg);
    }

    Chess6p_Remote.prototype.send_msg_move = function(curIndex, dstIndex) {
        var tracker = this.make_tracker();
        current_cmd = "leave";
        var move = curIndex + '/' + dstIndex;
        var msg = '{"_tracker": ' + tracker + ', "message": "' + move + 
            '", "cmd": "broadcast_in_table", "table_id": ' + current_table_id + '}';
        this.send_data(msg);
    }

    Chess6p_Remote.prototype.send_msg_reset = function() {
        var tracker = this.make_tracker();
        current_cmd = "leave";
        var move = this.C_RESET_GAME;
        var msg = '{"_tracker": ' + tracker + ', "message": "' + move +
            '", "cmd": "broadcast_in_table", "table_id": ' + current_table_id + '}';
        this.send_data(msg);
    }

    Chess6p_Remote.prototype.send_msg_reply_reset = function(reply) {
        var tracker = this.make_tracker();
        current_cmd = "leave";
        var move = this.C_REPLY_RESET_GAME + ':' + reply;
        var msg = '{"_tracker": ' + tracker + ', "message": "' + move +
            '", "cmd": "broadcast_in_table", "table_id": ' + current_table_id + '}';
        this.send_data(msg);
    }

    Chess6p_Remote.prototype.make_tracker = function() {
        // create a random number as tracker.
        return Math.floor((Math.random() * 1000000) + 1);
    }

    Chess6p_Remote.prototype.showInfo = function(msg, type) {
        //if (! this.DEBUG) return;
    
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
    
        $('#span_info').html(msg);
    }

    Chess6p_Remote.prototype.appendConsole = function(msg) {
        var c = document.getElementById('console');
        if (c) { c.innerHTML += msg + '<br/>'; }
        c.scrollTop = c.scrollHeight;
    }

    Chess6p_Remote.prototype.send_data = function(data) {
        this.appendConsole('==> Send: ' + data);
        socket.send(data);
    }

    Chess6p_Remote.prototype.doDisconnect = function(startup) {
        //if (! startup && ! confirm('Are you sure to disconnect?')) return;
    
        if (socket != null) socket.close();
        socket = null;
        isopen = false;
        this.appendConsole("<font color='green'>Disconnected!</font>");
    }

    Chess6p_Remote.prototype.getMyColorPiece = function(is_black) {
        if (is_black) {
            return " <span style='font-size: 20px;'>&#9679;</span> ";
        } else {
            return " <span style='font-size: 20px;'>&#9675;</span> ";
        }
    }

    Chess6p_Remote.prototype.handle_sys_cmd = function(jo) {
        var sys_cmd = jo.sys_cmd;
    
        if (sys_cmd == 'player_joined') {
            var player_id = jo.player_id;
            var sender_id = jo.sender_id;
            // This may be redundant. But useful when a player left and re-join.
            if (player_id == current_player_id) {
                $('#span_me').html(this.iconPlayerOn + 'Player ' + current_player_id + this.getMyColorPiece());
            } else {
                $('#span_you').html('Player ' + player_id + this.iconPlayerOn + this.getMyColorPiece());
            }
        } 
        else if (sys_cmd == 'player_left') {
            var player_id = jo.player_id;
            if (player_id != current_player_id) {
                if (this.remote_game_started) {
                    this.showInfo('Player ' + player_id + ' left. Game is aborted.');
                } else { // remote_game_started is false when game ends.
                    this.showInfo('Player ' + player_id + ' left.');
                }
                $('#span_you').html(this.iconPlayerOff);
                this.remote_game_started = false;
                this.both_sides_connected = false;
            }
        }
        else if (sys_cmd == 'game_start') {
            var sender_id = jo.sender_id;
            var table_id = jo.table_id;
            var players = jo.players;
            current_players = players;
            $('#span_table').html('Table ' + table_id);
            
            if (this.current_is_black) {
                // black side table id is already displayed when processing WAITING message.
                // this is needed by 1st player to display the other player's icon.
                if (players.length != 2) {
                    this.showInfo('wrong number of players', 'error');
                    return;
                }
    
                var you = '';
                if (players[0] != current_player_id) you = players[0];
                else if (players[1] != current_player_id) you = players[1];
                $('#span_you').html(this.getMyColorPiece(false) + 'Player ' + you + this.iconPlayerOn);
            }
            else {
            //    $('#span_table').html('Table ' + table_id); // white side.
            }
    
            this.showInfo('Game starts!');
            this.both_sides_connected = true;
            this.remote_game_started = true;
            sp.setAutoMoveSide(-1); // current side is black, set auto side to white.
            reset();
        }
        else if (sys_cmd == 'peer_message') {
            //if (! this.remote_game_started) return;
            var msg = jo.message;
            var sender_id = jo.sender_id;
    
            if (sender_id == current_player_id) return;

            if (msg == this.C_RESET_GAME) {
                if ( confirm('The other player wants to start a new game. OK?') ) {
                    this.send_msg_reply_reset('Y');
                    this.showInfo('Game starts!');
                    this.remote_game_started = true;
                    sp.reset();
                }
                else {
                    this.send_msg_reply_reset('N');
                }
            }
            else if (msg.startsWith(this.C_REPLY_RESET_GAME)) {
                // +1 for ':'
                var reply = msg.substr(this.C_REPLY_RESET_GAME_LEN+1, 1);
                if (reply == 'Y') {
                    this.showInfo('Game starts!');
                    this.remote_game_started = true;
                    sp.reset();
                } else {
                    alert('The other player does not want to start a new game.');
                }
            }
            else { // move peer's piece on my board.
                if (this.remote_game_started) {
                    sp.remoteMove(msg);
                }
            }
        }
    }

    Chess6p_Remote.prototype.handle_message = function(data) {
        this.appendConsole("<== Text received: " + data);
    
        var jo = JSON.parse(data);
    
        var sys_cmd = jo.sys_cmd;
        if (! (typeof sys_cmd === 'undefined')) {
            this.appendConsole('sys cmd receved');
            this.handle_sys_cmd(jo);
            return;
        }
    
        var status = jo.status;
        var reply_cmd = jo.reply_cmd;
        var msg = jo.msg;
        var tracker = jo._tracker;
        //var o = jo.o; // undefined.
    
        //this.appendConsole(":reply_cmd=" + reply_cmd + ", status=" + status + 
        //              ", msg=" + msg + ", tracker=" + tracker);
    
        if (reply_cmd == 'login') {
            if (status == 'ok') {
                $('#btnLogin').val('Logout');
                this.showInfo('Login succeeded.');        
                this.send_msg_get_game_rooms();
    
                $('#link_reg').hide();
            } 
            else {
                this.turnOnGameRoomUI(false);
                this.handle_message_not_ok(status, msg, tracker);
            }
        }
        else if (reply_cmd == 'get_game_rooms') {
            if (status == 'ok') {
                this.populate_game_rooms(jo.game_rooms);
                this.turnOnGameRoomUI(true);
            } else {
                this.handle_message_not_ok(status, msg, tracker);
            }
        }
        else if (reply_cmd == 'sit_for_auto_match_game') {
            if (status == 'ok') {
                $('#btnJoin').val('Leave');
                $('#selectGameRoom').attr('disabled', 'disabled');
    
                current_table_id = jo.table_id;
                var game_status = jo.game_status;
                if (game_status == 'WAITING') {
                    this.current_is_black = true;
                    $('#span_me').html(this.iconPlayerOn + 'Player ' + current_player_id + this.getMyColorPiece(true));
                    //$('#span_table').html('Table ' + current_table_id); // off position. need to set center.
                    this.showInfo('You joined game. Waiting for another player..');
                }
                else if (game_status == 'PLAYING') {
                    this.current_is_black = false;
                    $('#span_me').html(this.iconPlayerOn + 'Player ' + current_player_id + this.getMyColorPiece(false));
                    // show 1st player's icon.
                    var first_player_id = 
                                (current_player_id != current_players[0]) ?
                                current_players[0] : current_players[1];
                    $('#span_you').html(this.getMyColorPiece(true) + 'Player ' + 
                    first_player_id + this.iconPlayerOn);
    
                   this.showInfo('Game starts!');
                   this.both_sides_connected = true;
                   this.remote_game_started = true;
                   sp.setAutoMoveSide(1); // current side is white, set this to black.
                   reset(); // start game.
                }
            } else {
                this.handle_message_not_ok(status, msg, tracker);
            }
        }
        else if (reply_cmd == 'leave_table') {
            if (status == 'ok') {
                this.leaveTableCleanup();
                this.showInfo('You left the game.');
            } else {
                this.handle_message_not_ok(status, msg, tracker);
            }
        }
        else if (reply_cmd == "register") {
            var my_player_id = jo.player_id;
            if (status == 'ok') {
                this.showInfo('Register succeeded. Your player id is ' + my_player_id + '.');
                alert('Register succeeded. Your player id is ' + my_player_id +
                      '.\nPlease keep your player id for login.');
    
                $('#reg_name').val('');
                $('#reg_pwd').val('');
                $('#form_reg').hide();
                $('#link_reg').show();
                $('#form_login').show();
            } else {
                this.handle_message_not_ok(status, msg, tracker);
            }
        }
    }

    Chess6p_Remote.prototype.leaveTableCleanup = function() {
        $('#btnJoin').val('Join');
        $('#selectGameRoom').removeAttr('disabled');
    
        $('#span_me').html(this.iconPlayerOff);
        $('#span_you').html(this.iconPlayerOff);
        $('#span_table').html('');
    
        this.remote_game_started = false;
        this.both_sides_connected = false;
    
        reset();  
    }

    Chess6p_Remote.prototype.populate_game_rooms = function(rooms) {
        if (typeof rooms === 'undefined' || rooms.length == 0) {
            this.showInfo('There is not game room to select from.');
            return;
        }
    
        this.showInfo('Please select a game room.');
        
        // clean up the select room list.
        $('#selectGameRoom').children().remove();
        $('#selectGameRoom').append($('<option>', {
            value: '',
            text: '-- select Game Room --'
        }));
    
        rooms.forEach(function (room) {
            $('#selectGameRoom').append($('<option>', {
                value: room.room_id,
                text: room.room_name
            }));
        });
    }

    Chess6p_Remote.prototype.handle_message_not_ok = function(status, msg, tracker) {
        if (status == 'error') {
            this.showInfo(msg, 'error');
        }   
        else {
            this.showInfo('Unknown return status ' + status + 
                     ', msg = ' + msg + ', tracker = ' + tracker, 'error');
        }
    }


    Chess6p_Remote.prototype.doConnect = function() {
       var _this = this;
    
       socket = new WebSocket(this.ws); 
       socket.binaryType = "arraybuffer";
       socket.onopen = function() {
          isopen = true;
          _this.appendConsole("<font color='green'>Connected!</font>");
          if (current_cmd == "register") {
              _this.send_msg_register();
          } else if (current_cmd == "login") {
              _this.send_msg_login();
          }
          else {
              _this.showInfo('connect error: unkonwn command "' + current_cmd + '"', 'error');
          }
       }
       socket.onerror = function() {
           _this.turnOnGameRoomUI(false);
           _this.appendConsole("<font color='red'>Connection not opened.</font>");
    
           var msg = 'Connection error.';
           _this.appendConsole(msg);
           _this.showInfo(msg, 'error');
       }
       socket.onmessage = function(e) {
          if (typeof e.data == "string") {
            //_this.appendConsole("Text message received: " + e.data);
            //process_message(e.data);
            _this.handle_message(e.data);
          } else {
            var arr = new Uint8Array(e.data);
            _this.appendConsole("Binary message received: " + decodeBinaryMsg(arr));
          }
       }
       socket.onclose = function(e) {
          _this.turnOnGameRoomUI(false);
          var msg = '';
          if (current_cmd == "login") { 
              msg = 'Login failed.'; 
          }
          else { 
              msg = 'Connection is closed.'; 
          }
    
          _this.appendConsole(msg);
          _this.showInfo(msg, 'error');
          
          socket = null;
          isopen = false;
       }
    }

}

