/*!
 * Sixp JavaScript Library v1.0
 *
 * Copyright 2011, Xin Chen
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Date: Sat Aug 06 15:43:00 2011 -0400
 */
//
// @By: XC
// @Date: 6/14/2011 - 8/4/2011
//

if (typeof (Chess6p) == "undefined") {

    var Chess6p = function() {
        this.DEBUG = false;  //false;
        this.DEBUG_UI = false;
        this.useBackgroundImage = true;
        this.useSoundMov = true;
        this.autoMoveLoopForever = false;
        this.onStart = true;

        this.Board;
        this.ColorW = "#ffffff";
        this.ColorB = "#000000";
        this.ColorBoard = "#cccccc";

        this.context;
        this.contextSelect;
        this.selectCanvasInitiated = false;
        this.vSelect = false;

        this.selectedIndex = -1; // 0 - 15.

        this.remotePlay;
        this.currentSelectedSide;
        this.currentMoveSide = 1; // The side to move in the next step. Black by default.

        this.autoMoveSide = 1; // The side to move automatically. 1: B, -1: W, 0: Neither. 2 - both.

        this.doExplosion;
        this.doExplosionPos = [];
        this.explosionSteps = 20;
        this.explosionInterval = 20; // ms

        this.stepCount = 0;
        this.bestScore;

        this.endGameMsg = '';
        this.inGameOverStatus = false;

        this.vLog = document.getElementById("log");
        this.vMsg = document.getElementById("gameMsg");
        this.vBoard = document.getElementById("map");
        this.vSelectCanvas = document.getElementById("selectCanvas");
        this.vMoveHistory = document.getElementById("divMoveHistory");
        this.vToolbar = document.getElementById("Toolbar");
        this.vOptionTable = document.getElementById("OptionTable");
        this.vHelp = document.getElementById("divHelpPanel");
        this.vDebug = document.getElementById('debug');
        this.helpOn = false;

        // Set game board size here. Other sizes will be calculated in proportion.
        var D=navigator.userAgent.toLowerCase();
        var x=(D.indexOf("android")!=-1)||(D.indexOf("iphone")!=-1);//||(D.indexOf("ipad")!=-1);
        //this.w0 = x ? (window.innerWidth - 20) : 320;
        this.w0 = x ? 300 : 320;
        this.h0 = this.w0; 
        this.vBoard.setAttribute('width', this.w0); //
        this.vBoard.setAttribute('height', this.h0);
        this.vToolbar.setAttribute('width', this.w0);
        this.vOptionTable.setAttribute('width', this.w0);
        this.vHelp.setAttribute('width', this.w0);

        this.edgeX = this.w0 / 3;
        this.edgeY = this.h0 / 3;
        this.w = this.w0 - this.edgeX;
        this.h = this.h0 - this.edgeY;
        this.R = (this.w0 < this.h0 ? this.w0 : this.h0) / 11; // radius of circle.

        this.endGameMsgFontSize = 44 * (this.w0 / 500); ///

        this.CIRCLE_MOVE_STEP = x ? 10 : 20; // how many intermediate states to draw when moving a piece.
        this.CIRCLE_MOVE_INT = 20; // interval between drawing a step when moving a piece. in ms.

        this.initSelectEventListener(this);
        if (!this.selectCanvasInitiated) {
            this.updateSelectCanvasPosition(null, this);
            this.selectCanvasInitiated = true;
        }
        var p = this;
        window.addEventListener('resize', function(e) { p.updateSelectCanvasPosition(e, p); }, true);

        var w = this.w;
        var h = this.h;
        // cross positions.
        this.Pos = [
            [0, 0], [w / 3, 0], [2 * w / 3, 0], [w, 0],
            [0, h / 3], [w / 3, h / 3], [2 * w / 3, h / 3], [w, h / 3],
            [0, 2 * h / 3], [w / 3, 2 * h / 3], [2 * w / 3, 2 * h / 3], [w, 2 * h / 3],
            [0, h], [w / 3, h], [2 * w / 3, h], [w, h]
        ];

        this.BoardLen = 16;  //this.Board.length;
        this.BoardX = 4;
        this.BoardY = 4;

        // draw grid.
        this.context = this.vBoard.getContext('2d');
        this.context.lineWidth = 1;

        this.contextSelect = this.vSelectCanvas.getContext('2d');
        this.contextSelect.lineWidth = 5;

        this.inMovingCircle = false;

        this.MOVE_INTERVAL = 1000; // ms
        this.gameCount = 1;
        this.gameLevel = 1; // 1 - beginner, 2 - intermediate, 3 - advanced.
        this.useCenterHeuristic = false;
        this.useMobilityHeuristic = false;

        this.requestRecoverBoard = false;
        this.showAlert = false;

        this.autoSaveRecover = false;

        //
        this.setBgImg(bgImg);
        this.recoverConfig();
        this.updateConfig();
        if (this.autoSaveRecover) { this.requestRecoverBoard = true; }
        if (! this.supports_html5_storage()) { 
            document.getElementById("divBoardPosition").style.display = "none";
        }
        this.reset();
    }
    
    Chess6p.prototype.setBgImg = function(v) {
        this.bgImg = v;
    }

    Chess6p.prototype.setUseSoundMov = function(v) {
        this.useSoundMov = v;
    }

    // v: The side to move automatically. 1: B, -1: W, 0: Neither.
    Chess6p.prototype.setAutoMoveSide = function(v) {
        this.autoMoveSide = v;
    }

    // 1 - beginner, 2 - intermediate, 3 - advanced.
    Chess6p.prototype.setGameLevel = function(v) {
        this.gameLevel = v;
    }

    // true - loop forever, false - play once only.
    Chess6p.prototype.setAutoMoveLoopForever = function(v) {
        this.autoMoveLoopForever = v;
    }

    Chess6p.prototype.setAutoSaveRecover = function(v) {
        this.autoSaveRecover = v;
    }

    Chess6p.prototype.remoteGameStarted = function() {
        // if this.remotePlay is off, this always return true.
        if (! this.remotePlay) return true;

        //appendConsole('remoteGameStart: ' + remote_game_started);
        return remote_game_started && ! remote_game_broken;
    }

    Chess6p.prototype.reset = function() {
        this.countW = 6;
        this.countB = 6;

        this.Board = [
         1, 2, 3, 4,
         5, 0, 0, 6,
        -5, 0, 0, -6,
        -1, -2, -3, -4
        ];
        /*this.Board = [
        1, 2, 3, 0,
        4, -1, 5, 6,
        -2, 0, -3, -4,
        -5,0,0,-6
        ];*/
        //test if (this.heuristicsMobility(Board, -currentMoveSide) == 0) { k = 1000; }
        /*this.Board = [
        0, -2, 0, 0,
        0, 1, 5, 0,
        0, 2, 3, 0,
        0, -4, 0, 0
        ];
        this.countW = 2;*/
        /*
        this.Board = [
        0,-5,2,3
        ,0,-2,5,-6
        ,-1,0,-4,0
        ,0,0,-3,0
        ];*/
        // test mobility.
        /*this.Board = [
        0, -2, 0, 0,
        1, 0, 5, 0,
        0, 2, 3, 0,
        -4, 0, 0, 0
        ];
        this.countW = 2; this.countB = 4;*/// test end game.
        //this.drawGameOver("Black win", 10); return;

        if (this.timeoutNextMove) { clearTimeout(this.timeoutNextMove); }
        if (this.timeout2) { clearTimeout(this.timeout2); }
        if (this.timeout3) { clearTimeout(this.timeout3); }
        if (this.timeout4) { clearTimeout(this.timeout4); }
        if (this.timeout5) { clearTimeout(this.timeout5); }
        
        this.remotePlay = document.getElementById("cbRemote").checked;

        this.inGameOverStatus = false;
        this.currentMoveSide = 1; // Black
        this.stepCount = 0;
        this.clearMoveHistory();
        this.clearSelectCanvas();

        if (this.requestRecoverBoard) {
            this.doRecoverBoard();
            this.requestRecoverBoard = false;
        }

        this.drawStep();
        this.vMsg.innerHTML += "&nbsp;&nbsp;<font color='red'>" + langWords[0] + "</font>";
        this.vDebug.innerHTML = '';
    }

    //
    // find absolute position of an element on screen.
    // http://www.quirksmode.org/js/findpos.html
    //
    Chess6p.prototype.findPos = function(obj) {
        var curleft = curtop = 0;
        if (obj.offsetParent) {
            do {
                curleft += obj.offsetLeft;
                curtop += obj.offsetTop;
            } while (obj = obj.offsetParent);
        }
        return [curleft, curtop];
    }

    Chess6p.prototype.updateSelectCanvasPosition = function(e, p) {
        if (!p || !p.vBoard || !p.vSelectCanvas) { return; }

        var a = p.findPos(p.vBoard);
        p.vSelectCanvas.style.left = a[0] + 'px';
        p.vSelectCanvas.style.top = a[1] + 'px';
        p.vSelectCanvas.width = p.vBoard.width;
        p.vSelectCanvas.height = p.vBoard.height;

        this.contextSelect = this.vSelectCanvas.getContext('2d');
        this.contextSelect.lineWidth = 5;

        if (this.inGameOverStatus && this.endGameMsg != '') {
            this.drawGameOverMsg(this.endGameMsgFontSize); 
        }

        // for help panel.
        p.vHelp.style.left = (1+a[0]) + 'px';
        p.vHelp.style.top = (1+a[1]) + 'px';
        p.vHelp.style.width = (p.vBoard.width - 10) + 'px';
        p.vHelp.style.height = (p.vBoard.height - 10) + 'px';
    }

    Chess6p.prototype.drawBoard = function() {
        var w0 = this.w0, h0 = this.h0, w = this.w, h = this.h;
        var context = this.context;

        // clear board.
        context.fillStyle = this.ColorBoard;
        context.fillRect(0, 0, w0, h0);

        if (this.useBackgroundImage) { 
            context.drawImage(this.bgImg, 0, 0, this.w0, this.h0); 
        }

        // redraw board.
        this.drawLine(context, 0, 0, w, 0);
        this.drawLine(context, 0, h, w, h);
        this.drawLine(context, 0, 0, 0, h);
        this.drawLine(context, w, 0, w, h);
        this.drawLine(context, w / 3, 0, w / 3, h);
        this.drawLine(context, 2 * w / 3, 0, 2 * w / 3, h);
        this.drawLine(context, 0, h / 3, w, h / 3);
        this.drawLine(context, 0, 2 * h / 3, w, 2 * h / 3);
    }

    Chess6p.prototype.drawChessBoard = function() {
        this.drawBoard();

        var i, v;
        for (i = 0; i < this.BoardLen; i++) {
            v = this.Board[i];
            if (v == 0) {
                continue;
            } else if (v > 0) {
                this.drawCircle(this.context, v, this.Pos[i], this.ColorB);
            } else {
                this.drawCircle(this.context, -v, this.Pos[i], this.ColorW);
            }
        }
    }
  
    // Game ends, no more move.
    Chess6p.prototype.endGame = function() {
        this.inGameOverStatus = true;
        if (this.remotePlay) { remote_game_started = false; } // game ends, so no longer started.
        var msg = (this.currentMoveSide == 1) ? langWords[1] : langWords[2]; // "White Win!" : "Black Win!";

        this.vMsg.innerHTML = msg;

        if (this.autoMoveSide == 2) {
            //toggleBtnReset(false);
            if (this.autoMoveLoopForever) {
                this.gameCount++;
                reset(); // restart game automatically.
            }
        }

        if (this.autoMoveSide != 2 || !this.autoMoveLoopForever) {
            if (this.autoMoveSide == 1 || this.autoMoveSide == -1) {
                msg = (this.autoMoveSide == this.currentMoveSide) ? langWords[4] : langWords[5];
            }
            this.endGameMsg = msg;

            var me = this;
            // use interval to let explosion drawing finish.
            var timewait = me.explosionSteps * this.explosionInterval + 1000;
            me.timeout4 = setTimeout(function() { me.drawGameOver(10); }, timewait);
            return;
        }
    }

    Chess6p.prototype.drawGameOver = function(step) {
        if (step > 0) {
            this.drawGameOverMsg(this.endGameMsgFontSize / step);

            var me = this;
            me.timeout5 = setTimeout(function() { me.drawGameOver(step - 1) }, 20);
        }
    }

    Chess6p.prototype.drawGameOverMsg = function(fontSize) {
        var context = this.contextSelect;
        context.clearRect(0, 0, this.w0, this.h0);
        context.save();
        context.shadowOffsetX = 5;
        context.shadowOffsetY = 5;
        context.shadowBlur = 4;
        context.shadowColor = '#666699';
        context.fillStyle = '#33ff33';

        context.font = fontSize + "px sans-serif bold";
        context.fillText(langWords[3] + this.endGameMsg,
          (this.w0 / 2 - 200 * (this.w0 / 500) * (fontSize / this.endGameMsgFontSize)),
          (this.h0 / 2 ));

        context.restore();
    }

    Chess6p.prototype.drawStep = function() {
        if (this.DEBUG) this.setDebug('in drawStep.. game ' + this.gameCount);

        if (this.autoSaveRecover) { this.saveBoard(); }

        this.drawChessBoard();

        this.stepCount += 1;

        if (this.currentMoveSide == 1) {
            this.vMsg.innerHTML = "<span style='font-size: 20px;'>&#9679;</span>";
        } else {
            this.vMsg.innerHTML = "<span style='font-size: 20px; '>&#9675;</span>";
        }

        // need remoteGameStarted() here to prevent show the wait circle at start.
        if ((this.autoMoveSide == this.currentMoveSide || this.autoMoveSide == 2)
            && this.remoteGameStarted() 
            /* || (this.remotePlay && this.remoteGameStarted()) */
        ) {
            this.vMsg.innerHTML += "&nbsp;<img src='image/wait.gif' style='vertical-align:middle; height:18px;' title='Please wait...'>"; 
        }

        if (this.countB <= 1 || this.countW <= 1) { this.endGame(); return; }
        //if (this.heuristicsMobility(this.Board, this.currentMoveSide) == 0) {
        if (this.hasMobility(this.Board, this.currentMoveSide) == 0) {
            this.endGame();
            return;
        }

        if (this.remotePlay) { return; }

        // first step is always black.
        if (this.stepCount == 1 && this.currentMoveSide == -1) { return; }
        if (this.currentMoveSide == this.autoMoveSide || this.autoMoveSide == 2) {
            var me = this;
            me.timeoutNextMove = setTimeout(function() { me.autoMove(me); }, me.MOVE_INTERVAL);
        }
    }

    Chess6p.prototype.drawLine = function(context, x1, y1, x2, y2) {
        x1 += this.edgeX / 2;
        y1 += this.edgeY / 2;
        x2 += this.edgeX / 2;
        y2 += this.edgeY / 2;

        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        context.stroke();
    }

    // arc(x, y, radius, startAngle, endAngle, anticlockwise)
    Chess6p.prototype.drawCircle = function(context, index, p, fillColor) {
        var x = p[0] + this.edgeX / 2;
        var y = p[1] + this.edgeY / 2;

        context.save();

        context.beginPath();
        context.arc(x, y, this.R, 0, Math.PI * 2, true);

        context.shadowOffsetX = 5;
        context.shadowOffsetY = 5;
        context.shadowBlur = 4;
        context.shadowColor = '#666699';//rgba(255, 0, 0, 0.5)';

        context.fillStyle = fillColor;
        context.fill();

        context.restore();

        // draw index
        context.font = "16px sans-serif";
        context.fillStyle = '#ff0000';
        context.fillText(index, x - 5, y + 5);
    }

    Chess6p.prototype.appendLog = function(msg) {
        if (this.vLog == null || !this.DEBUG) return;
        this.vLog.innerHTML += msg + '<br>';
    }
    
    Chess6p.prototype.setLog = function(msg) {
        if (this.vLog == null || !this.DEBUG) return;
        this.vLog.innerHTML = msg;
    }

    Chess6p.prototype.getLoc = function(e) {
        if (! this.vBoard) { return ""; }
        return " [x,y]:[" + (e.pageX - this.vBoard.offsetLeft) + "," +
                      (e.pageY - this.vBoard.offsetTop) + "]";
    }

    Chess6p.prototype.showLoc = function(msg) {
        this.setLog(msg);
    }
    
    
    Chess6p.prototype.getCurrentButton = function(x, y) {
        // need this to prevent selecting buttons in black play.
        if (! this.remoteGameStarted()) return; 

        if (this.countW <= 1 
            || this.countB <= 1 
            || this.autoMoveSide == this.currentMoveSide 
            || this.autoMoveSide == 2 
            || this.inGameOverStatus) { return; }

        x -= this.edgeX / 2;
        y -= this.edgeY / 2;

        this.selectedIndex = -1;

        var i, v;
        for (i = 0; i < this.BoardLen; i++) {
            v = this.Board[i];
            if (v == 0) { continue; }

            var P = this.Pos[i];
            if (!this.inCircle(x, y, P[0], P[1])) { continue; }

            this.selectedIndex = i;
            if (v > 0) {
                this.currentSelectedSide = 1; // Black
                if (!this.isCurrentMoveSide()) { return false; }

                this.highlightCircle(P[0], P[1]);
                if (this.DEBUG_UI) this.appendLog(" in Black Side: " + this.Board[i]);
            } else {
                this.currentSelectedSide = -1; // White
                if (!this.isCurrentMoveSide()) { return false; }

                this.highlightCircle(P[0], P[1]);
                if (this.DEBUG_UI) this.appendLog(" in White Side: " + (-this.Board[i]));
            }

            this.selectedIndex = i;
            return true;
        }

        var context = this.contextSelect;
        context.clearRect(0, 0, this.w0, this.h0);

        return false;
    }

    Chess6p.prototype.inCircle = function(x, y, cx, cy) {
        var delta_x = x - cx;
        var delta_y = y - cy;
        if (delta_x * delta_x + delta_y * delta_y < this.R * this.R) return true;
        return false;
    }


    // select canvas event listener
    Chess6p.prototype.initSelectEventListener = function(me) {
        me.vSelectCanvas.addEventListener('mousedown', function(e) {
            if (e.which == 3) { return; } // do nothing for right mouse button.
            if (this.DEBUG_UI) {
                var loc = me.getLoc(e);
                me.showLoc(loc);
            }

            var mouse_x = e.pageX - this.offsetLeft,
                mouse_y = e.pageY - this.offsetTop;

            if (me.getCurrentButton(mouse_x, mouse_y) == true) { me.vSelect = true; }
            else { me.vSelect = false; }

        }, false);

        me.vSelectCanvas.addEventListener('touchstart', function(e) {
            if (e.touches.length == 1) {
                e.preventDefault();
                var mouse_x = e.touches[0].pageX - this.offsetLeft,
                    mouse_y = e.touches[0].pageY - this.offsetTop;

                if (me.getCurrentButton(mouse_x, mouse_y) == true) { me.vSelect = true; }
                else { me.vSelect = false; }
            }
        }, false);


        me.vSelectCanvas.addEventListener('mousemove', function(e) {
            // don't capture event if is moving circle now.
            if (me.inMovingCircle) { return; }

            if (this.DEBUG_UI) {
                var loc = me.getLoc(e);
                me.showLoc(loc);
            }

            var mouse_x = e.pageX - this.offsetLeft,
                mouse_y = e.pageY - this.offsetTop;

            if (me.vSelect) { me.redrawSelectedCircle(mouse_x, mouse_y); }
            else { me.getCurrentButton(mouse_x, mouse_y); }

        }, false);

        me.vSelectCanvas.addEventListener('touchmove', function(e) {
            // don't capture event if is moving circle now.
            if (me.inMovingCircle) { return; }

            if (e.touches.length == 1) {
                e.preventDefault();
                me.mouse_x = e.touches[0].pageX - this.offsetLeft;
                me.mouse_y = e.touches[0].pageY - this.offsetTop;
                if (me.vSelect) { me.redrawSelectedCircle(me.mouse_x, me.mouse_y); }
                else { me.getCurrentButton(me.mouse_x, me.mouse_y); }
            }
        }, false);


        me.vSelectCanvas.addEventListener('mouseup', function(e) {
            if (this.DEBUG_UI) {
                var loc = me.getLoc(e);
                me.showLoc(loc);
            }

            if (me.vSelect) {
                me.vSelect = false;

                var mouse_x0 = e.pageX - this.offsetLeft,
                    mouse_y0 = e.pageY - this.offsetTop;
                me.moveCircle(mouse_x0, mouse_y0);
            }
        }, false);

        me.vSelectCanvas.addEventListener('touchend', function(e) {
            if (me.vSelect) {
                me.clearSelectCanvas();
                me.vSelect = false;
                me.moveCircle(me.mouse_x, me.mouse_y);
            }
        }, false);


        me.vSelectCanvas.addEventListener('mouseout', function(e) {
            if (this.DEBUG_UI) me.showLoc("");
            me.vSelect = false;
        }, false);
    }


    Chess6p.prototype.highlightCircle = function(x, y) {
        var context = this.contextSelect;
        context.clearRect(0, 0, this.w0, this.h0);

        x += this.edgeX / 2;
        y += this.edgeY / 2;
        
        context.strokeStyle = '#00ff00';
        context.beginPath();
        context.arc(x, y, this.R, 0, Math.PI * 2, true);
        context.stroke();
    }

    Chess6p.prototype.toggleHelp = function() {
        if (this.helpOn) {
            this.clearSelectCanvas();
            this.helpOn = false;
        } else {
            var context = this.contextSelect;
            context.fillStyle = "#ffffff";
            context.beginPath();
            context.rect(1, 1, this.w0, this.h0);
            context.fill();

            this.helpOn = true;
        }
    }

    Chess6p.prototype.clearSelectCanvas = function() {
        var context = this.contextSelect;
        context.clearRect(0, 0, this.w0, this.h0);

        // dynamic effect of explosion.
        if (this.doExplosion > 0) { this.drawExplosions(); }
    }

    Chess6p.prototype.redrawSelectedCircle = function(x, y) {
        this.clearSelectCanvas();
        
        var context = this.contextSelect;
        context.strokeStyle = '#00ff00';
        context.beginPath();
        context.arc(x, y, this.R, 0, Math.PI * 2, true);
        context.stroke();
    }

    Chess6p.prototype.moveCircle = function(x, y) {
        if (this.DEBUG) this.setDebug('in moveCircle..');
        x -= this.edgeX / 2;
        y -= this.edgeY / 2;

        var i, len = this.Pos.length, dstIndex = 0, distMin = this.w0 * this.w0, dist;
        var delta_x, delta_y;
        for (i = 0; i < len; i++) {
            delta_x = x - this.Pos[i][0];
            delta_y = y - this.Pos[i][1];
            dist = delta_x * delta_x + delta_y * delta_y;
            if (dist < distMin) {
                distMin = dist;
                dstIndex = i;
            }
        }

        // check constrain of current selected circle and the drop position.
        var curIndex = this.selectedIndex;
        if (dstIndex == curIndex) { return; } // no change

        if (this.checkMoveConstraint(dstIndex, curIndex) == false) {
            msg = ' CANNOT Drop here: Pos[' + dstIndex + ']';
            if (this.DEBUG_UI) this.appendLog(msg);
            return;
        }

        if (this.isCurrentMoveSide() && 
            this.remotePlay && this.remoteGameStarted()) {
            send_msg_move(curIndex, dstIndex);
        }
               
        this.recordMoveHistory(this.currentMoveSide, curIndex, dstIndex);

        if (this.DEBUG_UI) this.appendLog(' Drop to: Pos[' + dstIndex + ']');
        
        ///this.Board[dstIndex] = this.Board[this.selectedIndex];
        this.selectedPiece = this.Board[this.selectedIndex];
        this.Board[this.selectedIndex] = 0;
        this.drawChessBoard();

        if (this.useSoundMov) { playSoundMov(); }
        this.drawMoveCircle(this.selectedIndex, dstIndex, this.currentMoveSide);

        // check if the other side's circle is 'eaten'
        //this.eat(dstIndex);
        //this.currentMoveSide = -this.currentMoveSide;
        //this.drawStep();
        //this.clearSelectCanvas();
    }

    Chess6p.prototype.recordMoveHistory = function(moveSide, srcIndex, dstIndex) {
        if (!this.vMoveHistory) { return; }
        if (this.vMoveHistory.value != '') this.vMoveHistory.value += '\n';
        //if (this.stepCount % 2 == 1 && this.stepCount > 1) this.vMoveHistory.value += "\n";
        var side = (this.currentMoveSide == 1) ? 'B' : 'W'; //'&#9679;' : '&#9675;'; //'B' : 'W';
        this.vMoveHistory.value += side + '[' + this.getPosLoc(srcIndex) + ' -> ' + this.getPosLoc(dstIndex) + ']';
    }

    Chess6p.prototype.getPosLoc = function(index) {
        //return '' + (index + 1);
        var row = ['a', 'b', 'c', 'd'];
        var n = row[Math.floor(index / 4)] + '' + (index % 4 + 1);
        return '' + n;
    }
    
    Chess6p.prototype.clearMoveHistory = function() {
        if (!this.vMoveHistory) { return; }
        this.vMoveHistory.value = '';
    }

    Chess6p.prototype.drawMoveCircle = function(src, dst, moveSide) {
        this.inMovingCircle = true;
        this.drawMoveCircleHelper(src, dst, moveSide, this.CIRCLE_MOVE_STEP);
    }

    Chess6p.prototype.drawMoveCircleHelper = function(src, dst, moveSide, step) {
    var x = this.Pos[dst][0] + (this.Pos[src][0] - this.Pos[dst][0]) * step / this.CIRCLE_MOVE_STEP;
    var y = this.Pos[dst][1] + (this.Pos[src][1] - this.Pos[dst][1]) * step / this.CIRCLE_MOVE_STEP;

        var fillColor = '#000000', index = this.selectedPiece;
        if (moveSide == -1) {
            fillColor = '#ffffff';
            index = -index;
        }

        this.clearSelectCanvas();
        this.drawCircle(this.contextSelect, index, [x, y], fillColor);

        if (step > 0) {
            var me = this;
            me.timeout2 = setTimeout(function() { me.drawMoveCircleHelper(src, dst, moveSide, step - 1); }, 
                       this.CIRCLE_MOVE_INT);
        } else {
            this.inMovingCircle = false;
            this.Board[dst] = this.selectedPiece;
            this.eat(dst);
            this.currentMoveSide = -this.currentMoveSide;
            this.drawStep();
            this.clearSelectCanvas();
        }
    }

    // two indices must be ajacent to each other to be valid.
    // preassumption:
    // 1) both index and index2 are in the range of [0, 15].
    // 2) index != index2 (already satisfied by the judgement before this).
    Chess6p.prototype.checkMoveConstraint = function(newIndex, curIndex) {
        var i;
        for (i = 0; i < this.BoardLen; i++) {
            if (this.Board[newIndex] != 0) return false;
        }
        
        /*if (! this.isCurrentMoveSide()) {
        var msg = ' The other side should move for this step'
        this.appendLog(msg);
        alert(msg);
        return false;
        }*/

        var d = newIndex - curIndex;

        if (d == 1  && ! this.onBoardLeftEdge(newIndex)) return true;  // same row, move right.
        if (d == -1 && ! this.onBoardRightEdge(newIndex)) return true; // same row, move left.
        if (d ==  this.BoardY) return true;  // same column, move down.
        if (d == -this.BoardY) return true; // same column, move up.

        return false;
    }
    
    Chess6p.prototype.isCurrentMoveSide = function() {
        return this.currentMoveSide == this.currentSelectedSide;
    }

    // check the row/coloum the targetIndex is in.
    // if all 4 positions are occupied, return false.
    // if current side has 2 adjacent positions occupied, eat the other side's circle.
    // return: number of successful eat.
    Chess6p.prototype.eat = function(targetIndex) {
        var x = targetIndex;

        // if all 4 positions are occupied, return false.
        // row: check [start ... start + 3], where start = 4 * floor(x/4).
        start = 4 * Math.floor(x / 4.0);
        if (this.isOccupied(start) && this.isOccupied(start + 1) &&
            this.isOccupied(start + 2) && this.isOccupied(start + 3)) {
            // do nothing.
        } else {
            // check row.
            this.doEat(x, x + 1, x + 2, x);
            this.doEat(x - 1, x, x + 1, x);
            this.doEat(x - 2, x - 1, x, x);
        }

        // column: check [start, start + 4, start + 8, start + 12], where start = x % 4.
        start = x % 4;
        if (this.isOccupied(start) && this.isOccupied(start + 4) &&
            this.isOccupied(start + 8) && this.isOccupied(start + 12)) {
            // do nothing.
        } else {
            // check column.
            this.doEat(x, x + 4, x + 8, x);
            this.doEat(x - 4, x, x + 4, x);
            this.doEat(x - 8, x - 4, x, x);
        }
    }
    
    Chess6p.prototype.doEat = function(a, b, c, targetIndex) {
        if (a < 0 || a > this.BoardLen - 1) return;
        if (b < 0 || b > this.BoardLen - 1) return;
        if (c < 0 || c > this.BoardLen - 1) return;
        if (this.Board[a] == 0 || this.Board[b] == 0 || this.Board[c] == 0) return;

        // a,b,c is on a row, b is on edge, this can't eat anything.
        if (b - a == 1 && (this.onBoardLeftEdge(b) || this.onBoardRightEdge(b))) return;

        if (this.Board[a] * this.Board[b] > 0 && this.Board[c] * this.Board[b] < 0 &&
                c != targetIndex) {
            this.decreaseCount(this.Board[c]);
            this.Board[c] = 0;

            this.doExplosion = this.explosionSteps;
            this.doExplosionPos.push(c);
        }
        else if (this.Board[a] * this.Board[b] < 0 && this.Board[c] * this.Board[b] > 0 &&
                a != targetIndex) {
            this.decreaseCount(this.Board[a]);
            this.Board[a] = 0;

            this.doExplosion = this.explosionSteps;
            this.doExplosionPos.push(a);
        }
    }

    Chess6p.prototype.drawExplosions = function() {
        var context = this.contextSelect;
        context.clearRect(0, 0, this.w0, this.h0);
        
        var i;
        for (i = 0; i < this.doExplosionPos.length; i++) {
            this.drawExplosion(context, this.doExplosionPos[i]);
        }

        this.doExplosion--;

        if (this.doExplosion > 0) {
            var me = this;
            me.timeout3 = setTimeout('c.drawExplosions()', this.explosionInterval);
        }
        else {
            this.doExplosionPos.length = 0; // = []; // clear position array.
        }
    }

    Chess6p.prototype.drawExplosion = function(context, index) {
        if (this.doExplosion <= 1) return;
        
        var P = this.Pos[index];
        var x = P[0] + this.edgeX / 2;
        var y = P[1] + this.edgeY / 2;

        context.save();

        context.fillStyle = '#000000';
        if (this.currentMoveSide == -1) { context.fillStyle = '#ffffff'; }

        context.beginPath();
        var r = this.R * ((this.doExplosion - 1) / this.explosionSteps);
        context.arc(x, y, r, 0, Math.PI * 2, true);

        context.shadowOffsetX = 5;
        context.shadowOffsetY = 5;
        context.shadowBlur = 4;
        context.shadowColor = '#666699'; //rgba(255, 0, 0, 0.5)';

        context.fill();

        context.restore();
    }

    Chess6p.prototype.decreaseCount = function(v) {
        if (v > 0) this.countB--;
        else this.countW--;
        if (this.useSoundMov) { playSoundEat(); } // play sound.
    }

    Chess6p.prototype.isOccupied = function(index) {
        return this.Board[index] != 0;
    }

    Chess6p.prototype.onBoardLeftEdge = function(index) {
        return index % this.BoardX == 0;
    }

    Chess6p.prototype.onBoardRightEdge = function(index) {
        return index % this.BoardX == this.BoardX - 1;
    }

    Chess6p.prototype.onBoardTopEdge = function(index) {
        return index < 4; //this.BoardX;
    }

    Chess6p.prototype.onBoardBottomEdge = function(index) {
        return index >= 12; //this.BoardX * (this.BoardY - 1);
    }

    Chess6p.prototype.onBoardEdge = function(index) {
        return index % this.BoardX == 0 ||
               index % this.BoardX == this.BoardX - 1 ||
               index < this.BoardX ||
               index >= 12; //this.BoardX * (this.BoardY - 1);
    }

    Chess6p.prototype.isOccupied2 = function(Board, index) {
        if (index < 0 || index >= Board.length) return 1;
        return Board[index] != 0;
    }

   
    //////////////////////////////////////////////////////////////
    // AI part.
    //////////////////////////////////////////////////////////////

    // assume white is automove side.
    Chess6p.prototype.autoMove = function(me) {
        if (this.DEBUG) this.setDebug('in autoMove..');

        // construct ajax url.
        var i, url = "sixp.php?b=" + this.Board[0];
        for (i = 1; i < this.BoardLen; i++) { url += "," + this.Board[i]; }
        url += "&s=" + this.currentMoveSide + "&l=" + this.gameLevel;
        //alert(url);

        $.get(url, function(data) {
            var me = c; // c is global variable defined in index.html
            //alert(":" + data);
            if (data == '') {
                if (me.DEBUG) {
                    me.setDebug('in move.length == 0. hasMobility=' + me.hasMobility(me.Board, me.currentMoveSide));
                    me.addDebug('<br>this.currentMoveSide=' + me.currentMoveSide + '<br>');
                    me.addDebug(me.dumpArray(me.Board));
                }
                me.endGame();
                return;
            }

            var move = data.split("/");
            if (move.length != 2) {
                me.setDebug("error: invalid move data: " + data);
                return;
            }

            me.selectedIndex = move[0]; // source position.
            var P = me.Pos[move[1]]; // target position.

            me.moveCircle(P[0] + me.edgeX / 2, P[1] + me.edgeY / 2);
        });
    }

    Chess6p.prototype.remoteMove = function(data) {
        var me = c; // c is global variable defined in index.html
        var move = data.split("/");
        if (move.length != 2) {
            me.setDebug("error: invalid move data: " + data);
            return;
        }

        me.selectedIndex = move[0]; // source position.
        var P = me.Pos[move[1]]; // target position.

        me.moveCircle(P[0] + me.edgeX / 2, P[1] + me.edgeY / 2);
    }

    Chess6p.prototype.addDebug = function(msg) {
        var d = document.getElementById('debug');
        if (d == null) return;
        d.innerHTML += msg;
    }
    Chess6p.prototype.setDebug = function(msg) {
        var d = document.getElementById('debug');
        if (d == null) return;
        d.innerHTML = msg;
    }

    // return 1 if has mobility, 0 if not.
    Chess6p.prototype.hasMobility = function(a, side) {
        var i, len = a.length, n = 0;
        for (i = 0; i < len; i++) {
            if (a[i] * side > 0) {
                if (!this.onBoardLeftEdge(i) && !this.isOccupied2(a, i - 1)) return 1;
                if (!this.onBoardRightEdge(i) && !this.isOccupied2(a, i + 1)) return 1;
                if (!this.isOccupied2(a, i - 4)) return 1;
                if (!this.isOccupied2(a, i + 4)) return 1;
            }
        }
        return 0;
    }
    

    Chess6p.prototype.dumpArray2 = function(a) {
        var s = '', i, len = a.length;
        if (! a || a.length == 0) return;
        s = a[0] + "->" + a[1] + "<br>";

        for (i = 2; i < len; i ++) { 
            s += ',' + a[i]; 
            if (i % 4 == 1) s += '<br>';
        }
        return s;
    }

    Chess6p.prototype.dumpArray = function(a) {
        var s = '', i, len = a.length;
        if (! a || a.length == 0) return;
        s = a[0];
        for (i = 1; i < len; i ++) { 
            s += ',' + a[i]; 
            if (i % 4 == 3) s += '<br>';
        }
        return s;
    }

    /////////////////////////////////////////////////////
    // Functions for local storage - save/recover board
    /////////////////////////////////////////////////////

    // from: http://blog.csdn.net/dojotoolkit/article/details/6614883
    Chess6p.prototype.supports_html5_storage = function() {  
      try {  
        return 'localStorage' in window && window['localStorage'] !== null;  
      } catch (e) {  
        return false;  
      }  
    }  
    
    Chess6p.prototype.saveBoard = function() {
        if (! this.supports_html5_storage()) { return; }
        var b = this.Board[0];
        for (i = 1; i < this.BoardLen; i++) { b += "," + this.Board[i]; }
        try {
            localStorage["sixp.b"] = b;
            localStorage["sixp.s"] = this.currentMoveSide;
            localStorage["sixp.l"] = this.gameLevel;
            localStorage["sixp.a"] = this.autoMoveSide;
            localStorage["sixp.c"] = this.stepCount;
            localStorage["sixp.h"] = document.getElementById("divMoveHistory").value; 
            //alert("Board has been saved.");
        } catch (err) {
            if (this.showAlert) {
                alert("Save board position error: " + err.description);
            }
        }
    }

    Chess6p.prototype.recoverBoard = function() {
        if (! this.supports_html5_storage()) { return; }
        this.requestRecoverBoard = true;
        this.reset();        
    }

    Chess6p.prototype.doRecoverBoard = function() {
        if (! this.supports_html5_storage()) { return; }

        try {
            var bStr = localStorage["sixp.b"];
            if (bStr == null) { return; }
            b = bStr.split(",");
            if (b.length != this.BoardLen) {
                if (this.showAlert) {
                    alert("Open saved board position error: board length is not " + this.BoardLen);
                }
                return;
            } 

            this.countW = 0;
            this.countB = 0;
            for (i = 0; i < this.BoardLen; i ++) {
                this.Board[i] = b[i];
                if (b[i] > 0) { this.countB ++; }
                if (b[i] < 0) { this.countW ++; }
            }
            this.currentMoveSide = localStorage["sixp.s"];
            this.gameLevel = localStorage["sixp.l"];
            this.autoMoveSide = localStorage["sixp.a"];
            this.stepCount = localStorage["sixp.c"];

            this.setUIValue("divMoveHistory", localStorage["sixp.h"]);
            this.setUIValue("comSide", this.autoMoveSide);
            this.setUIValue("gameLevel", this.gameLevel);
        } catch (err) {
            if (this.showAlert) {
                alert("Open saved board position error: " + err.description);
            }
        }
    }

    /////////////////////////////////////////////////////
    // Functions for local storage - save/recover config
    /////////////////////////////////////////////////////

    Chess6p.prototype.saveConfig = function() {
        if (! this.supports_html5_storage()) { return; }

        localStorage["sixp.config.l"] = document.getElementById('gameLevel').value;
        localStorage["sixp.config.a"] = document.getElementById('comSide').value;
        localStorage["sixp.config.r"] = 
            (document.getElementById('cbRemote').checked ? 1 : 0);
        localStorage["sixp.config.m"] = this.getPlayMusicId();
        localStorage["sixp.config.s"] = this.getPlaySoundId();
        localStorage["sixp.config.autoSaveRecover"] = 
            (document.getElementById('idAutoSaveRecover').checked ? 1 : 0);

        showLoginForm( document.getElementById('cbRemote').checked );
    }

    Chess6p.prototype.recoverConfig = function() {
        if (! this.supports_html5_storage()) { return; }

        if (localStorage["sixp.config.a"] == null) { return; } // First use, no data set yet.

        this.setUIValue("comSide", localStorage["sixp.config.a"]);
        this.setUIValue("gameLevel", localStorage["sixp.config.l"]);
        document.getElementById('cbRemote').checked = 
            (localStorage["sixp.config.r"] == 1) ? true : false;
        this.setPlayMusicTitle(localStorage["sixp.config.m"]);
        this.setPlaySoundTitle(localStorage["sixp.config.s"]);
        document.getElementById('idAutoSaveRecover').checked = 
            (localStorage["sixp.config.autoSaveRecover"] == 1) ? true : false;

        showLoginForm( document.getElementById('cbRemote').checked );
    }

    Chess6p.prototype.updateConfig = function() {
        this.setAutoMoveSide(document.getElementById('comSide').value);
        this.setGameLevel(document.getElementById('gameLevel').value);
        this.setAutoSaveRecover(document.getElementById('idAutoSaveRecover').checked);
    }

    /////////////////////////////////////////////////////
    // Private helper functions
    /////////////////////////////////////////////////////

    Chess6p.prototype.setUIValue = function(elemID, val) {
        if (val == null) return;
        var e = document.getElementById(elemID);
        if (e == null) return;
        e.value = val;
    }

    Chess6p.prototype.getPlayMusicId = function() {
        return (document.getElementById('idSound').title == langWords[6]) ? 0 : 1;
    }

    Chess6p.prototype.setPlayMusicTitle = function(v) {
        document.getElementById('idSound').title = (v == 1) ? langWords[6] : langWords[7];
    }

    Chess6p.prototype.getPlaySoundId = function() {
        return (document.getElementById('idToggleSoundMov').title == langWords[8]) ? 0 : 1;
    }

    Chess6p.prototype.setPlaySoundTitle = function(v) {
        document.getElementById('idToggleSoundMov').title = (v == 1) ? langWords[8] : langWords[9];
    }

}


