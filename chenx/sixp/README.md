
<h1>Six Piece Chess</h1>

By: X. Chen  
Created on: 3/24/2015  
Last modified: 3/25/2015

To add remote human/human play feature.


<h3>Workflow</h3>

- Register
- Login
- Invite player
- start game
  - specify black/white
- moves
- end game
- For now, just support 1 game per player


<h3>Issues</h3>

As of 3/25/2015, a few quick comments on the API are:

- Can sys_cmd be combined with cmd?
  - sometimes cmd and sys_cmd are redundant and can be confusing.
  - now sys_cmd.player_joined and cmd.PLAYING, cmd.WAITING messages are confusing and not easy
    to implement right, their order matters, and player_id information dispersed.
- In one room can have multiple tables? is this a bug?
- no logout yet. so now I use refresh page to fake logout (which just breaks the connection).
  In the long run you want to keep the state when refreshing page.
- There should be a invite mechanism


<h3>To Do</h3>

- Update stats at the end of game
- During game, should the options/re-start buttons be disabled?
- keep states of login/room information during inter-play in local storage.
- keep states when page refreshes.
- Invite mechanism


<h3>Change Log</h3>

-- 3/25/2015
* Made it work: login/choose room/start game/inter-play

-- 3/24/2015
Creation
