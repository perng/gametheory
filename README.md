# gametheory

## REST calls  (returns JSON) 
* http://gametheory.olidu.com/reguster/[player_name]/[uuid> 
    * This should be called for first time registration or rename. [uuid> is the actual identifier of the user, it can be mac address or other unique id. To rename the user, send the new [player_name> and the same [uuid>. 
    * return {status:"ok", player_id:[player_id>, score:[score>}  where [player_id> is an integer from internal database row number. 

## Get Player Stats
* http://gametheory.olidu.com/get_player_stats_by_id/[player_id> 
    * return {status:"ok", player_id:[player_id>, score:[score>}

* http://gametheory.olidu.com/get_player_stats_by_uuid/[player_uuid> 
    * return {status:"ok", player_id:[player_id>, score:[score>}

## Start Game
* http://gametheory.olidu.com/start_game/[player_id>  
    * If fails to find an opponent, return {status:"queued"},  Client should shows “waiting for opponent”.  Issue same request after a few seconds. 
    * If found an opponent, return {status:"ok", game_id:[game_id>, oppenent_id:[opp_id>, oppenent_name:[opp_name>, opponent_score:[opp_score>},  client shows game screen with a timer count down. 

## Submit Decision
* http://gametheory.olidu.com/player_cheat/[player_id>/[game_id>  
    * if opponent not submit yet, return {status:"waiting"},  submit the same after a few seconds
    * if opponent submitted, return {status:"ok", opponent_cheat:[True|Fase>, gain:[gain>, new_score:[new_score>}. Game over. 
    * If opponent timed out, returns {status:"opponent_timed_out",  gain:[gain>, new_score:[new_score>}

* http://gametheory.olidu.com/player_split/[player_id>/[game_id> return game result

## Player Timed-out
* http://gametheory.olidu.com/player_timed_out/[player_id>/[game_id>  
    * send when the client decided the player has timed out (or quit the app)
    * return {status:"timed_out", gain:[penalty>, new_score:[new_score>}  where penalty is a negative number. 
    * The other party will receive {status:"opponent_timed_out"},  no gain or loss if opponent timed_out 

## Leader Board
All leader board calls return up to 20 top players with scores from high to low. 
* http://gametheory.olidu.com/leaders_overall  
    * Return overall top players
    * Sample output {"status": "ok", "players": [{"score": 1200, "player_name": "perng"}, {"score": 1200, "player_name": "chung"}]}

* http://gametheory.olidu.com/leaders_country/[player_id]
    * Return top players of the same country as the player
    * Same output format as leaders_overall

* http://gametheory.olidu.com/leaders_state/[player_id]
    * Return top players of the same state as the player
    * Same output format as leaders_overall

* http://gametheory.olidu.com/leaders_city/[player_id]
    * Return top players of the same city as the player
    * Same output format as leaders_overall

## Player rank 
* http://gametheory.olidu.com/rank_overall/[player_id]
* http://gametheory.olidu.com/rank_country/[player_id]
* http://gametheory.olidu.com/rank_state/[player_id]
* http://gametheory.olidu.com/rank_city/[player_id]
    * Sample result {"status": "ok", "rank": 1}

