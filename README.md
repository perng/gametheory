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
* No operation (testing):
  * request: {"cmd":"noop"}
  * response: {"status": "ok", "msg": "No operation", "reply_cmd": "noop"}

# Player API
* Registration: for first-time registration, or rename. Client should save 'player_id' for later communication
  * requet: {"cmd": "register", "player_name": "Charles Perng", "uuid": "bcde", "uuid_type": "FB"}
  * response: {"player_id": 2, "status": "ok", "reply_cmd": "register", "msg": "New user registered", "player.score": 1200}
  
* Login: need to be called after connected
  * request: {"cmd":"login", "player_id":2}
  * response: {"status": "ok", "player_name": "Charles Perng", "level": 1, "reply_cmd": "login", "msg": "", "score": 1200, "player_id": 2, "xp": 0}
  * 

* Get game names 
  * request: 