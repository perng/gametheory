
<h1>Six Piece Chess</h1>

By: X. Chen  
Created on: 3/24/2015  
Last modified: 3/25/2015

To add remote human/human play feature.


<h2>Workflow</h2>

- Register
- Login
- Invite player
- start game
  - specify black/white
- moves
- end game
- For now, just support 1 game per player


<h2>Issues</h2>

As of 3/25/2015, a few quick comments on the API are:

- Can sys_cmd be combined with cmd?
  - sometimes cmd and sys_cmd are redundant and can be confusing.
  - now sys_cmd.player_joined and cmd.PLAYING, cmd.WAITING messages are confusing and not easy
    to implement right, their order matters, and player_id information dispersed.
- In one room can have multiple tables? is this a bug?
- no logout yet. so now I use refresh page to fake logout (which just breaks the connection).
  In the long run you want to keep the state when refreshing page.
- There should be a invite mechanism
- If the other side is disconnected (e.g., close browser), the server should remove the side's
  information from connected users. Otherwise local side will continue to show game started
  when I get in, but the other side is no longer on line.


<h2>To Do</h2>

- Register new player
- Update stats at the end of game
- During game, should the options/re-start buttons be disabled?
- keep states of login/room information during inter-play in local storage.
- keep states when page refreshes.
- Invite mechanism


<h2>Change Log</h2>

-- 3/29/2015

- when click on "Leave", give a warning the game will be abandoned.
  - if leave, then the other side will be notified that game is abandoned.
- updated UI, on the format of div_players that were done yesterday.
- added a both_sides_connected variable, this is useful when restart game.
- reset game
  - for reset game when a game is not finished, could do this way:
    send a msg to other side to get consent.
  - for reset game when a game is ended, and both sides still connected,
    also send a msg to other side to get consent, then restart game.
    if other side does not agree, reset board must leave room first.
  - actually, both are the same: to reset to a status that a new game can be started.
     so these 2 can be comebined. (done)
- added register function (done)
  - need a register icon with transparent background.

-- 3/27/2015

* Added 5 open issues to gamethoery API repos
* Solved bgImg preload issue.
* Minor adjustment to UI on width.

-- 3/25/2015
* Made it work: login/choose room/start game/inter-play

-- 3/24/2015
* Creation
