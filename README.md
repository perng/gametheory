# Testing Tool
websocket client chrome extension:  https://chrome.google.com/webstore/detail/simple-websocket-client/pfdhoblngboilpfeibdedpjgfnlcodoo  


# Server Address
* websocket server  ws://gametheory.olidu.com:80

# Operation Model
Each client/app starts by establishing a websocket connection with the server. All activities are done sequentially in
this connection. Websocket is bi-directional, either side can initiate a "dialog". 

Currently, all communication is in Json (In future, we may consider using Protocol Buffer if data size getting big. Also ProtoBuf is 
faster to encode/decode). 

We assume the app can obtain an unique identifier from the user or the device. Ideally, we'd like to use Facebook or other social network
 authentication so we can get their friends. The UUID would be transfered to server for registration. 

The services serve many game at the same type. Each game need to be specified first, through a separated Web interface(not in websocket). 
A GameSpec include parameters like the min/max number of players of a game, initial score, etc. 

Each game contains at least one GameRoom. For example, a poker or black jack game can have multiple GameRoom each with different min/max bet. 

A typical app connection cycle is (using regex notation):
Connect, login, get_my_stats, (find_match,  (play a game with the group)+, exit_game_room)*,    disconnect. 

The server does not judge win/lose or whether a move is legal. The app should have the game logic. Each client shuld be able to judge the outcome. 

In some games, a *leader* is needed. For example, card shuffling should be done in only one client and then broadcast to other clients.  The server can choose a leader from the clients and broadcast the outcome of the selection. 

Each player, for each of the game she ever played, a set of Stats is stored in the server. Currently, the stats are Score, XP, Level, Gem. It's possible to store more custom data. Since the server does not have game logic, the clients (or just the leader) have to request player stats change after each game. 

The result of each round of game is recorded. 


# Security assumptions (Strong assumptions, may lift in the future)
  # No client/app is compromised. 
  # Communication is secure, data integrity is guaranteed. 
  # Basically, we're assuming no adversary 

# General API usage
  # Each request from client should contain a "cmd" field to indicate the type of request. Optionally, a "_tracker" field can be added to associate a request with its response, it can be any string. 
  # For each request from client, the server always return a response which always contain the following fields
    # status: "ok" or "error" 
    # reply_cmd: same as "cmd" in the request. 
    # msg: debugging info, not to be displayed in client. 
    # (optional) _tracker :  return the same _tracker value as in the request. 



# Test API 
* noop: No operation (testing): (done)
  * request: {"_tracker": 0, "cmd": "noop"}    
  * response: {"status": "ok", "msg": "No operation", "reply_cmd": "noop", "_tracker": 0}

# Player API
* register_by_password  -- if successful, no need to login. If called with same player_name and password as before, it's equivalent to login_by_password
  * request: {"cmd":"register_by_password", "player_name":"charles", "password": "abcde"}
  * response:{"status": "ok", "player_name": "charles", "reply_cmd": "register_by_password", "msg": "New user registered", "player_id": 1, "ip_address": "127.0.0.1"}

* login_by_password
  * request: {"cmd":"login_by_password", "player_name":"charles", "password": "abcde"}
  * response: {"status": "ok", "player_name": "charles", "reply_cmd": "login_by_password", "msg": "", "player_id": 1, "ip_address": "127.0.0.1"}

* register_by_uuid -- if successful, no need to login. If called with same uuid and uuid_type as before, it's equivalent to login_by_uuid
  * request: {"cmd":"register_by_uuid", "player_name": "david", "uuid": "xidkeu", "uuid_type": "MAC"}
  * response: {"status": "ok", "player_name": "david", "reply_cmd": "register_by_uuid", "msg": "New user registered", "player_id": 2, "ip_address": "127.0.0.1"}

*login_by_uuid
  * request: {"cmd":"login_by_uuid", "player_name": "david", "uuid": "xidkeu", "uuid_type": "MAC"}
  * response:{"status": "ok", "player_name": "david", "reply_cmd": "login_by_uuid", "msg": "", "player_id": 2, "ip_address": "127.0.0.1"}

* logout 
  * request: {"cmd":"logout"}
  * response: {"status": "ok", "msg": "", "reply_cmd": "logout"}

* change_password
  * request: {"cmd":"change_password", "player_name":"charles", "new_password": "12345"}
  * response: {"status": "ok", "msg": "Password changed.", "reply_cmd": "change_password"}

* get_my_stats : Get the stats of the logged-in user for a particular game
  * request: {"_tracker": 5, "cmd": "get_my_stats", "game_name": "Game Theory"}
  * response: {"status": "ok", "level": 11, "reply_cmd": "get_my_stats", "msg": "", "score": 2430, "player_id": 3, "_tracker": 5, "xp": 0, "gem": 0}
  
* get_player_stats : Get the stats of another player for a particular game
  * request: {"player_id": 3, "_tracker": 6, "cmd": "get_player_stats", "game_name": "Game Theory"}
  * response:{"status": "ok", "level": 11, "reply_cmd": "get_player_stats", "msg": "", "score": 2430, "player_id": 3, "_tracker": 6, "xp": 0, "gem": 0}
* update_stats: Update the state for a player. This is usually called after a round of game, to increase or descrease each item. The values in the message are the delta. Send in negative value to decrease stats. 
  * request: {"level": 1, "cmd": "update_stats", "score": 123, "game_name": "Game Theory", "player_id": 3, "_tracker": 7, "gem": -1}
  * response: {"status": "ok", "level": 12, "reply_cmd": "update_stats", "msg": "", "score": 2553, "player_id": 3, "_tracker": 7, "xp": 0, "gem": -1}

* unicast
  * request: {"cmd":"unicast", "receiver_id": 1, "message": "Hello!"}
  * response: {"status": "ok", "msg": "", "reply_cmd": "unicast"}
  * The receiver receive: {"sender_name": "david", "message": "Hello!", "cmd": "unicast", "sender_id": 2}

# Game API
* get_games : Get game information of all games.
  * request: {"_tracker": 1, "cmd": "get_games"}
  * response: {"status": "ok", "msg": "", "reply_cmd": "get_games", "games": [{"game_id": 1, "game_name": "Game Theory"}], "_tracker": 1}

* get_game_rooms : Get the list of game room of a game
  * request: {"_tracker": 2, "cmd": "get_game_rooms", "game_name": "Game Theory"}
  * response: {"status": "ok", "game_rooms": [{"room_id": 1, "room_name": "Room 1"}, {"room_id": 2, "room_name": "Room 2"}], "_tracker": 2, "reply_cmd": "get_game_rooms", "msg": ""}

* sit_for_auto_match_game : Request to sit and play in a game room
  * request: {"_tracker": 8, "cmd": "sit_for_auto_match_game", "room_id": 1}
  * response (waiting for player): {"status": "ok", "reply_cmd": "sit_for_auto_match_game", "game_status": "WAITING", "table_id": 3, "msg": "", "_tracker": 8}
  * Once enough players have joine, server send msg like {"players": [2, 3], "table_id": 3, "msg_type": "game_start"}

* get_leaders : If a game requires a client serves as a leader, send this command to get an ordered list for leaders
  * request: {"_tracker": 9, "cmd": "get_leaders", "table_id": 1}
  * response:  {"status": "ok", "msg": "", "reply_cmd": "get_leaders", "leaders": [2, 3], "_tracker": 9}

* broadcast_in_table: Send a message to everyone sitting on the table
  * request: {"_tracker": 10, "message": "Message from player 3: messages  can be any format encoded as string.", "cmd": "broadcast_in_table", "table_id": 1}
  * all playerre receive: {"sys_cmd": "peer_message", "message": "Message from player 3: messages  can be any format encoded as string.", "sender_id": 3}
  
* leave_table
  * request: {"_tracker": 11, "cmd": "leave_table", "table_id": 1}
  * response: {u'status': u'ok', u'msg': u'', u'reply_cmd': u'leave_table', u'_tracker': 11}
  
  

