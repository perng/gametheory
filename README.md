# gametheory

* websocket client chrome extension:  https://chrome.google.com/webstore/detail/simple-websocket-client/pfdhoblngboilpfeibdedpjgfnlcodoo
* websocket server  ws://gametheory.olidu.com:80

* No operation (testing):
  * request: {"cmd":"noop"}
  * response: {"status": "ok", "msg": "No operation", "reply_cmd": "noop"}
* Registration: for first-time registration, or rename. Client should save 'player_id' for later communication
  * requet: {"cmd": "register", "player_name": "Charles Perng", "uuid": "bcde", "uuid_type": "fb"}
  * response: {"player_id": 2, "status": "ok", "reply_cmd": "register", "msg": "New user registered", "player.score": 1200}
* Login: need to be called after connected
  * request: {"cmd":"login", "player_id":2}
  * response: {"status": "ok", "player_name": "Charles Perng", "level": 1, "reply_cmd": "login", "msg": "", "score": 1200, "player_id": 2, "xp": 0}
  * 
