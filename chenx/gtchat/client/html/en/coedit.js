"use strict";

if (typeof (CoEdit) == "undefined") {

    var CoEdit = function() {
        this.init();
    }

    CoEdit.prototype.init = function() {
        this.t10 = document.getElementById('t1');
        this.t1 = $('#t1'); 
        this.container1 = document.getElementById('line1_number');

        this.t3 = $('#t3');
        this.container3 = document.getElementById('line3_number');

        this.t_act = $('#t2'); // action textarea.

        this.minRow = 1;
        this.maxRow = 1;

        // for visible port in window of t1.
        this.winMinRow = 1;
        this.winMaxRow = 20;

        this.browser = getBrowser();
        this.browserName = this.browser.browserName.toLowerCase();
        //alert(browser.browserName);

        if (this.browserName == 'chrome') {
            $('.line').css('height', '14.5px');
        }

        this.paste_lock = false; // used by paste function.

        var _this = this;
    
        // Cannot use keydown to handle alphabet input,
        // because charCode will all be capitialized no matter it's lower or upper case.
        this.t1.keydown(function(e) {
            _this.appendAct('keydown: key=' + e.keyCode + ', char=' + e.charCode);
            if (_this.browserName == 'chrome' || _this.browserName == 'safari') {
                _this.handle_chrome_special_char(e);
            }
        });
    
        this.t1.keypress(function(e) {
            _this.appendAct('keypress: key=' + e.keyCode + ', char=' + e.charCode);
            _this.appendDst(e);
            _this.getPos();
        });
    
        this.t1.keyup(function(e) {
            _this.appendAct('keyup: key=' + e.keyCode + ', char=' + e.charCode);
            _this.getPos();
        });
    
        this.t1.mouseup(function(e) {
            _this.getPos();
        });
    
        this.t1.bind('paste', function(e) {
            _this.doOnpaste();
        });
    
        this.t1.bind('cut', function(e) {
            _this.doOncut();
        });
    
        this.t1.bind('drop', function(e) {
            return false; // Disable drop. Note this also disables dragstart/dragend.
        });
    
        this.t1.bind('input', function(e) {
            _this.appendAct('changed ...');
        });
    
    }

    
    // Append user action to middle textarea.
    //function appendAct(v) {
    CoEdit.prototype.appendAct = function(v) {
        var t = this.t_act;
        t.val(t.val() + v + '\n');
        //textarea.scrollTop = textarea.scrollHeight;
        t.scrollTop(t[0].scrollHeight);
    }
    
    CoEdit.prototype.addLineNum = function(container, rowID, hidden) {
        var r = document.createElement('div');
        r.setAttribute('id', rowID);
        r.setAttribute('class', 'line');
    
        if (this.browserName == 'chrome') {
            r.style.height = '14.5px';
        }
    
        if (hidden) r.style.display = 'none';
    
        r.innerHTML = this.maxRow;
        container.appendChild(r);
    }
    
    CoEdit.prototype.delLineNum = function(container, rowID) {
        var r = document.getElementById(rowID);
        container.removeChild(r);
    }
    
    // Get row and column of cursor.
    // Also update position of current row div.
    CoEdit.prototype.getPos = function() {
        var cursor_pos =  this.doGetCaretPosition(this.t10);
        var t1 = this.t1;
        var txt = t1.val().substring(0, cursor_pos);
        var row = txt.split('\n').length;
        var col = cursor_pos - txt.lastIndexOf('\n') - 1;
    
        var txt = t1.val();
        var total_row = txt.split('\n').length;
        var total_char = txt.length;
    
        this.showMsg4('row: ' + row + ' col: ' + col + 
            ', total rows: ' + total_row + ', total char: ' + total_char);
    
        this.moveLineNum(total_row, row);
        this.highlightCurrentRow(row);
    }
    
    
    CoEdit.prototype.highlightCurrentRow = function(row) {
        var r = row - this.winMinRow;
        var top = 15 * r + 3;
    
        if (this.browserName == 'chrome') {
            top = 14.5 * r + 3;
        }
    
        $('#cur_line').css('top', top + 'px').css('display', 'block');
        $('#cur_line3').css('top', top + 'px').css('display', 'block');
    }
    
    
    CoEdit.prototype.moveLineNum = function(total_row, row) {
        // for Enter, Backspace/delete keys.
        // Note it's a combination of adding/remove the last row, plus move cursor.
        if (total_row > this.maxRow) {
            while (this.maxRow < total_row) {
                this.maxRow += 1;
                var hidden =  (this.maxRow > this.winMaxRow);
    
                this.addLineNum(this.container1, 'line1_' + this.maxRow, hidden);
                this.addLineNum(this.container3, 'line3_' + this.maxRow, hidden);
    
                if (row > this.winMaxRow) {
                    document.getElementById('line1_' + (this.winMinRow - 0)).style.display = 'none';
                    document.getElementById('line3_' + (this.winMinRow - 0)).style.display = 'none';
                }
            }
    
            this.moveLineNumForArrow(row);
        }
        else if (total_row < this.maxRow) {
    
            var container = document.getElementById('line_number');
            while (this.maxRow > total_row) {
                this.delLineNum(this.container1, 'line1_' + this.maxRow);
                this.delLineNum(this.container3, 'line3_' + this.maxRow);
                //this.appendAct('delete row ' + this.maxRow + '. winMaxRow = ' + this.winMaxRow);
    
                if ((this.maxRow <= this.winMaxRow) && this.winMaxRow >= 20) { 
                    if (this.winMaxRow > 20) {
                        this.winMaxRow -= 1;
                        this.winMinRow -= 1;
                    }
    
                    document.getElementById('line1_' + (this.winMinRow - 0)).style.display = 'block';
                    document.getElementById('line3_' + (this.winMinRow - 0)).style.display = 'block';
    
                    this.appendAct('show line number ' + this.winMinRow);
                }
    
                this.maxRow -= 1;
            }
    
            //this.moveLineNumForArrow(row);
        }
        else {
            this.moveLineNumForArrow(row);
        }
    
        //this.appendAct('row = ' + row + ', maxRow=' + this.maxRow);
        //this.appendAct('win min/maxRow=' + this.winMinRow + '/' + this.winMaxRow);
    }
    
    
    CoEdit.prototype.moveLineNumForArrow = function(row) {
        // for up/down arrow keys.
        if (row > this.winMaxRow) {
            while (row > this.winMaxRow) {
                this.winMaxRow += 1;
    
                document.getElementById('line1_' + (this.winMinRow)).style.display = 'none';
                document.getElementById('line1_' + (this.winMaxRow)).style.display = 'block';
    
                document.getElementById('line3_' + (this.winMinRow)).style.display = 'none';
                document.getElementById('line3_' + (this.winMaxRow)).style.display = 'block';
    
                this.winMinRow += 1;
                //this.winMaxRow += 1;
            }
        } 
        else if (row < this.winMinRow) {
            while (row < this.winMinRow) {
                this.winMinRow -= 1;
                //this.winMaxRow -= 1;
    
                document.getElementById('line1_' + (this.winMinRow)).style.display = 'block';
                document.getElementById('line1_' + (this.winMaxRow)).style.display = 'none';
    
                document.getElementById('line3_' + (this.winMinRow)).style.display = 'block';
                document.getElementById('line3_' + (this.winMaxRow)).style.display = 'none';
    
                this.winMaxRow -= 1;
            }
        }
    }
    
    // This will be the output function.
    // need to send: 1) cursor_pos, 2) the 3 params below.
    // to-do: 
    // - select text.
    // - copy/paste.
    CoEdit.prototype.appendDst = function(e) {
        var b = this.browser.browserName.toLowerCase();
        if (b == 'chrome' || b == 'safari') this.appendDst_chrome(e);
        else this.appendDst_firefox(e);
    }
    
    
    CoEdit.prototype.setDstVal = function(val) {
        var t3 = this.t3;
        t3.val(val);
        t3.scrollTop(t3[0].scrollHeight);
    }
    
    CoEdit.prototype.setDstVal2 = function(index1, txt, index2) {
        var t3 = this.t3;
        var v = t3.val();
        t3.val(v.substring(0, index1) + txt + v.substring(index2));
        t3.scrollTop(t3[0].scrollHeight);
    }
    
    
    CoEdit.prototype.handle_chrome_special_char = function(e) {
        this.appendAct('Chrome: key:' + e.keyCode + ', char:' + this.getChar(e) + ', meta:' + this.metaChar(e));
    
        var t3 = this.t3;
        var sel = this.GetSelection();
        var cursor_pos = sel.start; //cursor_pos;
        var selectionStart = sel.start, selectionEnd = sel.end, selectionLen = sel.length;
    
        this.showMsg3('selectioin start/end: ' + selectionStart + '/' + selectionEnd);
    
        var keyCode = e.keyCode;
        switch(keyCode) {
            case 8:  // windows, backspace; mac, delete/backspace.
                var txt = t3.val();
                if (selectionLen == 0) {
                    this.setDstVal(txt.substring(0, cursor_pos - 1) + txt.substring(cursor_pos));
                }
                else
                    this.setDstVal(txt.substring(0, selectionStart) + txt.substring(selectionEnd));
                break;
            case 46: // windows, delete
                var txt = t3.val();
                if (selectionLen == 0) {
                    this.setDstVal(txt.substring(0, cursor_pos) + txt.substring(cursor_pos + 1));
                }
                else
                    this.setDstVal(txt.substring(0, selectionStart) + txt.substring(selectionEnd));
                break;
        }
    }
    
    
    CoEdit.prototype.appendDst_chrome = function(e) {
        var scanCode = e.keyCode,
            charCode = this.getChar(e),
            metaCode = this.metaChar(e);
        var t3 = this.t3;
    
        // on Mac, command key pressed, shouldn't enter anything.
        if (metaCode == 'meta') {
            if (metaCode == 'meta') this.showMsg3('metaCode = ' + metaCode);
            return; // don't input anything.
        }
    
        var sel = this.GetSelection();
        var cursor_pos = sel.start; //cursor_pos;
        var selectionStart = sel.start, selectionEnd = sel.end, selectionLen = sel.length;
    
        var msg =('appendDst_chrome: scanCode = ' + scanCode + ', charCode = ' + charCode
            + ', metaCode = ' + metaCode + ', cursor_pos = ' + cursor_pos);
    
        this.appendAct(msg);
        this.showMsg(msg);
        this.showMsg3('selectioin start/end: ' + selectionStart + '/' + selectionEnd);
    
        if (scanCode == 13) {
            var txt = t3.val();
            if (selectionLen == 0) {
                this.setDstVal(txt.substring(0, cursor_pos) + '\n' + txt.substring(cursor_pos));
            }
            else {
                this.setDstVal(txt.substring(0, selectionStart) + '\n' + txt.substring(selectionEnd));
            }
        }
        else if (charCode != '') {  // this includes '\n'.
            var txt = t3.val();
            if (selectionLen == 0)
                this.setDstVal(txt.substring(0, cursor_pos) + charCode + txt.substring(cursor_pos));
            else
                this.setDstVal(txt.substring(0, selectionStart) + charCode + txt.substring(selectionEnd));
        }
    }
    
    
    CoEdit.prototype.appendDst_firefox = function(e) {
        var scanCode = e.keyCode, 
            charCode = this.getChar(e),
            metaCode = this.metaChar(e);
        var t3 = this.t3;
    
        var sel = this.GetSelection();
        var cursor_pos = sel.start; //cursor_pos;
        var selectionStart = sel.start, selectionEnd = sel.end, selectionLen = sel.length;
    
        this.showMsg('scanCode = ' + scanCode + ', charCode = ' + charCode 
            + ', metaCode = ' + metaCode + ', cursor_pos = ' + cursor_pos);
    
        this.showMsg3('selectioin start/end: ' + selectionStart + '/' + selectionEnd);
    
        if (metaCode == 'ctrl' || metaCode == 'meta') {
            if (metaCode == 'meta') this.showMsg3('metaCode = ' + metaCode);
            return; // don't input anything.
        }
    
        if (metaCode == 'alt') {
            return; // don't input anything on firefox.
        }
    
        switch (scanCode) {
            case 0: 
                var txt = t3.val();
                if (selectionLen == 0)
                    this.setDstVal(txt.substring(0, cursor_pos) + charCode + txt.substring(cursor_pos));
                else 
                    this.setDstVal(txt.substring(0, selectionStart) + charCode + txt.substring(selectionEnd));
                break;
            case 8:  // delete, on mac firefox; backspace on windows firefox.
                var txt = t3.val();
                if (selectionLen == 0) {
                    this.setDstVal(txt.substring(0, cursor_pos - 1) + txt.substring(cursor_pos));
                }
                else
                    this.setDstVal(txt.substring(0, selectionStart) + txt.substring(selectionEnd));
                break;
            case 46: // delete, on windows firefox.
                var txt = t3.val();
                if (selectionLen == 0) {
                    this.setDstVal(txt.substring(0, cursor_pos) + txt.substring(cursor_pos + 1));
                }
                else
                    this.setDstVal(txt.substring(0, selectionStart) + txt.substring(selectionEnd));
                break;
            case 13:
                var txt = t3.val();
                if (selectionLen == 0) {
                    this.setDstVal(txt.substring(0, cursor_pos) + '\n' + txt.substring(cursor_pos));
                }
                else {
                    this.setDstVal(txt.substring(0, selectionStart) + '\n' + txt.substring(selectionEnd));
                }
                break;
            default:
                break;
        }
    }
    
    CoEdit.prototype.showMsg = function(msg) {
        $('#msg').html(msg);
    }
    
    CoEdit.prototype.showMsg2 = function(msg) {
        $('#msg2').html(msg);
    }
    
    CoEdit.prototype.showMsg3 = function(msg) {
        $('#msg3').html(msg);
    }
    
    CoEdit.prototype.showMsg4 = function(msg) {
        $('#msg4').html(msg);
    }
    
    CoEdit.prototype.metaChar = function(e) {
        if (e.shiftKey) return "shift";
        else if (e.ctrlKey) return "ctrl";
        else if (e.altKey) return "alt";
        else if (e.metaKey) return "meta"; // 'command' key in mac.
        return '';
    }
    
    CoEdit.prototype.getChar = function(e) {
      //appendAct('getChar: e.which=' + e.which + ', e.charCode=' + e.charCode);
      if (e.which == null) {
        return String.fromCharCode(e.keyCode) // IE
      } else if (e.which!=0) { // && e.charCode!=0) { // e.charCode not work for keyup.
        return String.fromCharCode(e.which)   // the rest
      } else {
        //return null // special key
        return '?';
      }
    }
    
    // get and set cursor position.
    // function GetSelection() also can return this.
    // But this is faster if only caret position is needed.
    CoEdit.prototype.doGetCaretPosition = function(ctrl) {
        var CaretPos = 0;    // IE Support
        if (document.selection) {
            ctrl.focus ();
            var Sel = document.selection.createRange ();
            Sel.moveStart ('character', -ctrl.value.length);
            CaretPos = Sel.text.length;
        }
        // Firefox support
        else if (ctrl.selectionStart || ctrl.selectionStart == '0')
            CaretPos = ctrl.selectionStart;
        return (CaretPos);
    }
    CoEdit.prototype.setCaretPosition = function(ctrl, pos){
        if(ctrl.setSelectionRange)
        {
            ctrl.focus();
            ctrl.setSelectionRange(pos,pos);
        }
        else if (ctrl.createTextRange) {
            var range = ctrl.createTextRange();
            range.collapse(true);
            range.moveEnd('character', pos);
            range.moveStart('character', pos);
            range.select();
        }
    }
    
    
    // @return:
    //   - length: length of selected text
    //   - start: start of selection. This is equal to cursor position.
    //   - end: end of selection
    CoEdit.prototype.GetSelection = function() {
    
        //http://the-stickman.com/web-development/javascript/finding-selection-cursor-position-in-a-textarea-in-internet-explorer/
        if (document.selection) { // IE support.
            var element = this.t10;
        // The current selection
        var range = document.selection.createRange();
        // We'll use this as a 'dummy'
        var stored_range = range.duplicate();
        // Select all text
            range.moveStart ('character', -element.value.length);
            start = range.text.length;
    
            appendAct('start: ' + element.selectionStart + ', end: ' + element.selectionEnd);
    
            return;
            
            //textarea.focus ();
            //var Sel = document.selection.createRange ();
            //Sel.moveStart ('character', -textarea.value.length);
            //var start = Sel.text.length, end = start;
            //return {
            //    start: start,
            //    end: end,
            //    length: end - start,
            //};
            //
        }
    
        // non-IE.
        else {
            var textarea = this.t10;
            var start = textarea.selectionStart, end = textarea.selectionEnd;
    
            return {
                start: start,
                end: end,
                length: end - start,
                //text: textarea.value.slice(start, end)
            };
        }
    }
    
    // 
    // Paste must use a lock variable.
    //
    // Problem: 
    // It is found that, when paste continuously, the destination string is longer than source.
    //
    // Reason:
    // When coninuously paste (hold ctrl, and press v multiple times or continuously),
    // multiple setTimeout events will occur. Say you pasted 3 times before the first timeout
    // fires, then it'll get "val = textarea.val" as the final value with 3 pastes, so the
    // first fired event will paste the new content 3 times. Then the 2nd event is fired and will
    // paste 2 times, and the 3rd event will paste 1 time. In total you got 6 copies instead of 3.
    // You can verify this, by setting the timeout value longer, say 1 second, then paste something
    // 3 times during 1 second.
    //
    // Solution: use a lock variable, lock it so it won't re-enter the function before the first
    // event is fired. This works correctly. You can set the timeout interval larger, say 10 seconds,
    // it'll still paste correctly.
    //
    //var paste_lock = false;
    
    CoEdit.prototype.doOnpaste = function() {
        if (this.paste_lock) return;
        this.paste_lock = true;
    
        var textarea = this.t10;
        var sel = this.GetSelection(); 
        var initialLength = textarea.value.length;
        this.appendAct('paste: cursor_pos:' + sel.start + ', start:' + sel.start + ', end:' + sel.end);
    
        var _this = this;
    
        window.setTimeout(function() {
            var val = textarea.value;
            var pastedTextLength = val.length - (initialLength - sel.length);
            //appendAct('val.len=' + val.length + ', initLen=' + initialLength + ', sel.len=' + sel.length);
            //var end = sel.start + pastedTextLength;
    
            var start = sel.start; // cursor_pos
            var end = start + pastedTextLength;
    
            var txt = val.slice(start, end);
    
            var v = _this.t3.val();
            _this.setDstVal(v.substring(0, start) + txt + v.substring(start + sel.length));
            //this.setDstVal($('#t1').val()); // This works and is accurate. But data is large.
    
            _this.paste_lock = false;
        }, 100);
    }
    
    
    CoEdit.prototype.doOncut = function() {
        var textarea = this.t10;
        var sel = this.GetSelection();
        this.appendAct('cut: cursor_pos:' + sel.start + ', start:' + sel.start + ', end:' + sel.end);
    
        var t3 = this.t3;
        var v = t3.val();
        t3.val(v.substring(0, sel.start) + v.substring(sel.end));
    }

}
