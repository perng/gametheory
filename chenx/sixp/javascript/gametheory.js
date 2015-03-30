
var DEBUG = true;
var iconPlayerOn  = ' <img src="image/head_yellow.png" style="vertical-align:middle;">&nbsp;';
var iconPlayerOff = ' <img src="image/head_gray.png" style="vertical-align:middle;">&nbsp;';
var C_RESET_GAME = 'reset_game';
var C_REPLY_RESET_GAME = 'reply_reset_game';
var C_REPLY_RESET_GAME_LEN = C_REPLY_RESET_GAME.length;

var socket = null;
var isopen = false;
var current_cmd = '';  // keep track of current status.
var current_tid = '';  // keep track of current tracker id.
var current_user = ''; // keep track of current logged in user.
var current_room = ''; // keep track of current room.

var current_player_id = '';
var current_table_id = '';
var current_is_black = false; // whether is black side (play first).
var current_players;
var remote_game_started = false; // control whether be able to play with this.
var both_sides_connected = false; // true when both players are connected.

var bgImg;

$(document).ready(function() {
    bgImg = new Image();
    bgImg.src = "image/bg.jpg";  // Force preload image.
    bgImg.onload = function() {  // do init() only when image is loaded.
        init();
    };

    if (isMobile()) { DEBUG = false; }
    if (DEBUG) { $('#debug_console').show(); }

    $('#btnClearConsole').click(function() {
        $('#console').html('');
    });

    $('#cbRemote').click(function() {
        showLoginForm($(this).attr('checked'));
    });

    $('#btnLogin').click(function() {
        if ($(this).val() == 'Login') {
            doLogin();
        } else {
            doLogout();
        }
    });

    $('#btnJoin').click(function() {
        if ($(this).val() == 'Join') {
            doJoinRoom();
        } else {
            doLeaveRoom();
        }
    });
});

function isRemotePlay() {
    return document.getElementById("cbRemote").checked;
}

function isMobile() {
    var D=navigator.userAgent.toLowerCase();
    var x=(D.indexOf("android")!=-1)||(D.indexOf("iphone")!=-1);
    return x;
}

function setMobileUI() {
    if (! isMobile()) return;

    $('#debug_console').hide();    
    $('#div_remote').width('300');
}

function doLogout() {
    $('#selectGameRoom').removeAttr('disabled');
    location.reload();
}

function doJoinRoom() {
    var room_id = $('#selectGameRoom').val();
    if (room_id == '') {
        alert('Please select a valid game room');
        return;
    }

    send_msg_sit(room_id);
}

function doLeaveRoom() {
    if (remote_game_started) {
        if (! confirm('Leave room will abandon unfinished game. Continue?')) {
            return;
        }
    }
    if (current_table_id == '') return;
    send_msg_leave(current_table_id);
}

function showLoginForm(show) {
    if(show) {  
        $('#form_login').show();
        $('#div_players').show();
        document.getElementById('gameLevel').disabled = true;
        document.getElementById('comSide').disabled = true;
    } else {
        $('#form_login').hide();
        $('#div_players').hide();
        document.getElementById('gameLevel').disabled = false;
        document.getElementById('comSide').disabled = false;
    }
}

function doLogin() {
    if ($.trim( $('#login_id').val() ) == '') {
        showInfo('Please enter Player ID');
        $('#login_id').focus();
        return;
    }
    appendConsole('login');
    showInfo('Connecting to server ...');
    current_cmd = "connect";
    doConnect();
}

function turnOnGameRoomUI(v) {
    if (v) {
        $('#span_game_room').show();
    } else {
        $('#span_game_room').hide();
    }
}

function send_msg_login() {
    //var name = $.trim( $('#login_name').val() );
    //var pwd  = $.trim( $('#login_pwd').val() );
    var id = $.trim( $('#login_id').val() );
    var tracker = make_tracker();
    current_cmd = "login";
    current_player_id = id;

    var msg = '{"player_id": ' + id + ', "_tracker": ' + tracker +
    ', "cmd": "login"}';
    send_data(msg);
}
function send_msg_get_game_rooms() {
    var tracker = make_tracker();
    current_cmd = "get_game_rooms";
    game_name = 'Six Pieces';

    var msg = '{"_tracker": ' + tracker + ', "cmd": "' + current_cmd + 
              '", "game_name": "' + game_name + '"}';
    send_data(msg);
}
function send_msg_sit(room_id) {
    var tracker = make_tracker();
    current_cmd = "sit";
    var msg='{"_tracker": ' + tracker + 
            ', "cmd": "sit_for_auto_match_game", "room_id": ' + room_id + '}';
    send_data(msg);
}
function send_msg_leave(table_id) {
    var tracker = make_tracker();
    current_cmd = "leave";
    var msg='{"_tracker": ' + tracker +
            ', "cmd": "leave_table", "table_id": ' + table_id + '}';
    send_data(msg);
}
// called in sixp.js, Chess6p.prototype.moveCircle().
function send_msg_move(curIndex, dstIndex) {
    var tracker = make_tracker();
    current_cmd = "leave";
    var move = curIndex + '/' + dstIndex;
    var msg = '{"_tracker": ' + tracker + ', "message": "' + move + 
        '", "cmd": "broadcast_in_table", "table_id": ' + current_table_id + '}';
    send_data(msg);
}
function send_msg_reset() {
    var tracker = make_tracker();
    current_cmd = "leave";
    var move = C_RESET_GAME;
    var msg = '{"_tracker": ' + tracker + ', "message": "' + move +
        '", "cmd": "broadcast_in_table", "table_id": ' + current_table_id + '}';
    send_data(msg);
}
function send_msg_reply_reset(reply) {
    var tracker = make_tracker();
    current_cmd = "leave";
    var move = C_REPLY_RESET_GAME + ':' + reply;
    var msg = '{"_tracker": ' + tracker + ', "message": "' + move +
        '", "cmd": "broadcast_in_table", "table_id": ' + current_table_id + '}';
    send_data(msg);
}


function make_tracker() {
    // create a random number as tracker.
    return Math.floor((Math.random() * 1000000) + 1);
}

function showInfo(msg, type) {
    if (! DEBUG) return;

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

function appendConsole(msg) {
    var c = document.getElementById('console');
    if (c) { c.innerHTML += msg + '<br/>'; }
    c.scrollTop = c.scrollHeight;
}

function send_data(data) {
    appendConsole('==> Send: ' + data);
    socket.send(data);
}

function doDisconnect(startup) {
    //if (! startup && ! confirm('Are you sure to disconnect?')) return;

    if (socket != null) socket.close();
    socket = null;
    isopen = false;
    appendConsole("<font color='green'>Disconnected!</font>");
}

function getMyColorPiece(is_black) {
    if (is_black) {
        return " <span style='font-size: 20px;'>&#9679;</span> ";
    } else {
        return " <span style='font-size: 20px;'>&#9675;</span> ";
    }
}

function handle_sys_cmd(jo) {
    var sys_cmd = jo.sys_cmd;

    if (sys_cmd == 'player_joined') {
        var player_id = jo.player_id;
        var sender_id = jo.sender_id;
        // This may be redundant. But useful when a player left and re-join.
        if (player_id == current_player_id) {
            $('#span_me').html(iconPlayerOn + 'Player ' + current_player_id + getMyColorPiece());
        } else {
            $('#span_you').html('Player ' + player_id + iconPlayerOn + getMyColorPiece());
        }
    } 
    else if (sys_cmd == 'player_left') {
        var player_id = jo.player_id;
        if (player_id != current_player_id) {
            if (remote_game_started) {
                showInfo('Player ' + player_id + ' left. Game is aborted.');
            } else { // remote_game_started is false when game ends.
                showInfo('Player ' + player_id + ' left.');
            }
            $('#span_you').html(iconPlayerOff);
            remote_game_started = false;
            both_sides_connected = false;
        }
    }
    else if (sys_cmd == 'game_start') {
        var sender_id = jo.sender_id;
        var table_id = jo.table_id;
        var players = jo.players;
        current_players = players;
        $('#span_table').html('Table ' + table_id);
        
        if (current_is_black) {
            // black side table id is already displayed when processing WAITING message.
            // this is needed by 1st player to display the other player's icon.
            if (players.length != 2) {
                showInfo('wrong number of players', 'error');
                return;
            }

            var you = '';
            if (players[0] != current_player_id) you = players[0];
            else if (players[1] != current_player_id) you = players[1];
            $('#span_you').html(getMyColorPiece(false) + 'Player ' + you + iconPlayerOn);
        }
        else {
        //    $('#span_table').html('Table ' + table_id); // white side.
        }

        showInfo('Game starts!');
        both_sides_connected = true;
        remote_game_started = true;
        c.setAutoMoveSide(-1); // current side is black, set auto side to white.
        reset();
    }
    else if (sys_cmd == 'peer_message') {
        //if (! remote_game_started) return;
        var msg = jo.message;
        var sender_id = jo.sender_id;

        if (sender_id == current_player_id) return;

        if (msg == C_RESET_GAME) {
            if ( confirm('Your peer wants a new game. OK?') ) {
                send_msg_reply_reset('Y');
                showInfo('Game starts!');
                remote_game_started = true;
                c.reset();
            }
            else {
                send_msg_reply_reset('N');
            }
        }
        else if (msg.startsWith(C_REPLY_RESET_GAME)) {
            // +1 for ':'
            var reply = msg.substr(C_REPLY_RESET_GAME_LEN+1, 1);
            if (reply == 'Y') {
                showInfo('Game starts!');
                remote_game_started = true;
                c.reset();
            } else {
                alert('Your peer does not want to restart a new game.\n' +
                      'To reset board, please leave this room.');
            }
        }
        else { // move peer's piece on my board.
            if (remote_game_started) {
                c.remoteMove(msg);
            }
        }
    }
}

function handle_message(data) {
    appendConsole("<== Text received: " + data);

    var jo = JSON.parse(data);

    var sys_cmd = jo.sys_cmd;
    if (! (typeof sys_cmd === 'undefined')) {
        appendConsole('sys cmd receved');
        handle_sys_cmd(jo);
        return;
    }

    var status = jo.status;
    var reply_cmd = jo.reply_cmd;
    var msg = jo.msg;
    var tracker = jo._tracker;
    //var o = jo.o; // undefined.

    //appendConsole(":reply_cmd=" + reply_cmd + ", status=" + status + 
    //              ", msg=" + msg + ", tracker=" + tracker);

    if (reply_cmd == 'login') {
        if (status == 'ok') {
            //$('#btnLogin').attr('disabled', 'disabled');
            $('#btnLogin').val('Logout');
            showInfo('Login succeeded.');        
            send_msg_get_game_rooms();
        } 
        else {
            turnOnGameRoomUI(false);
            handle_message_not_ok(status, msg, tracker);
        }
    }
    else if (reply_cmd == 'get_game_rooms') {
        if (status == 'ok') {
            populate_game_rooms(jo.game_rooms);
            turnOnGameRoomUI(true);
        } else {
            handle_message_not_ok(status, msg, tracker);
        }
    }
    else if (reply_cmd == 'sit_for_auto_match_game') {
        if (status == 'ok') {
            $('#btnJoin').val('Leave');
            $('#selectGameRoom').attr('disabled', 'disabled');

            current_table_id = jo.table_id;
            var game_status = jo.game_status;
            if (game_status == 'WAITING') {
                current_is_black = true;
                $('#span_me').html(iconPlayerOn + 'Player ' + current_player_id + getMyColorPiece(true));
                //$('#span_table').html('Table ' + current_table_id); // off position. need to set center.
                showInfo('You joined game. Waiting for another player..');
            }
            else if (game_status == 'PLAYING') {
                current_is_black = false;
                $('#span_me').html(iconPlayerOn + 'Player ' + current_player_id + getMyColorPiece(false));
                // show 1st player's icon.
                var first_player_id = 
                            (current_player_id != current_players[0]) ?
                            current_players[0] : current_players[1];
                $('#span_you').html(getMyColorPiece(true) + 'Player ' + 
                first_player_id + iconPlayerOn);

               showInfo('Game starts!');
               both_sides_connected = true;
               remote_game_started = true;
               c.setAutoMoveSide(1); // current side is white, set this to black.
               reset(); // start game.
            }
        } else {
            handle_message_not_ok(status, msg, tracker);
        }
    }
    else if (reply_cmd == 'leave_table') {
        if (status == 'ok') {
            leaveTableCleanup();
            showInfo('You left the game.');
        } else {
            handle_message_not_ok(status, msg, tracker);
        }
    }
}

function leaveTableCleanup() {
    $('#btnJoin').val('Join');
    $('#selectGameRoom').removeAttr('disabled');

    $('#span_me').html(iconPlayerOff);
    $('#span_you').html(iconPlayerOff);
    $('#span_table').html('');

    remote_game_started = false;
    both_sides_connected = false;

    reset();  
}

function populate_game_rooms(rooms) {
    if (typeof rooms === 'undefined' || rooms.length == 0) {
        showInfo('There is not game room to select from.');
        return;
    }

    showInfo('Please select a game room below.');
    
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

function handle_message_not_ok(status, msg, tracker) {
    if (status == 'error') {
        showInfo(msg, 'error');
    }   
    else {
        showInfo('Unknown return status ' + status + 
                 ', msg = ' + msg + ', tracker = ' + tracker, 'error');
    }
}

function doConnect() {
   var ws = "ws://gametheory.olidu.com:80";

   socket = new WebSocket(ws); 
   socket.binaryType = "arraybuffer";
   socket.onopen = function() {
      isopen = true;
      appendConsole("<font color='green'>Connected!</font>");
      send_msg_login();
   }
   socket.onerror = function() {
       turnOnGameRoomUI(false);
       appendConsole("<font color='red'>Connection not opened.</font>");

       var msg = 'Connection error.';
       appendConsole(msg);
       showInfo(msg, 'error');
   }
   socket.onmessage = function(e) {
      if (typeof e.data == "string") {
        //appendConsole("Text message received: " + e.data);
        //process_message(e.data);
        handle_message(e.data);
      } else {
        var arr = new Uint8Array(e.data);
        appendConsole("Binary message received: " + decodeBinaryMsg(arr));
      }
   }
   socket.onclose = function(e) {
      turnOnGameRoomUI(false);
      var msg = '';
      if (current_cmd == "login") { msg = 'Login failed.'; }
      else { msg = 'Connection is closed.'; }

      appendConsole(msg);
      showInfo(msg, 'error');
      
      socket = null;
      isopen = false;
   }
};

