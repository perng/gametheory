(function(window){

  var WORKER_PATH = '../js/recordmp3js/recorderWorker.js';
  var encoderWorker = new Worker('../js/recordmp3js/mp3Worker.js');

  var Recorder = function(source, cfg){
    var config = cfg || {};
    var bufferLen = config.bufferLen || 4096;
    this.context = source.context;
    this.node = (this.context.createScriptProcessor ||
        this.context.createJavaScriptNode).call(this.context,
            bufferLen, 2, 2);
    var worker = new Worker(config.workerPath || WORKER_PATH);
    worker.postMessage({
      command: 'init',
      config: {
      sampleRate: this.context.sampleRate
    }
    });
    var recording = false,
        currCallback;

    var t = get_time();

    var CT = 0; ///XC.
    var MAX_CT = 0; // value of CT when do exportWAV. MAX_CT <= 0 means no exportWAV.
    var _this = this;

    this.setExportMaxCT = function(v) {
        MAX_CT = v;
    }

    this.node.onaudioprocess = function(e){
      if (!recording) return;
      worker.postMessage({
        command: 'record',
        buffer: [
             e.inputBuffer.getChannelData(0),
             //e.inputBuffer.getChannelData(1)
             ]
      });

      //var s = get_time();
      // by XC. To output in chunk instead of at the end.
      // No need to call stop() and record() here.
      if (MAX_CT > 0) {
          CT += 1;
          if (CT >= MAX_CT) { // data size: CT * 4096.
              //_this.stop();
              _this.exportWAV(function(blob) {});
              _this.clear();
              //_this.record();
              CT = 0;

              var t2 = get_time();
              // e.inputBuffer.getChannelData(0).length is always 4096, i.e., buffer length.
              // When MAX_CT = 10, it's 40KB per chunk, takes ~0.93sec on my mac/chrome.
              // console.log('onaudioprocess .. max_ct = ' + MAX_CT + ', delta_t = ' + (t2 - t)/1000 + ' sec');
              __log('onaudioprocess .. max_ct = ' + MAX_CT + ', delta_t = ' + (t2 - t)/1000 + ' sec');
              t = t2;
          }
      }

      // Time elapsed here is 0 when CT < MAX_CT, and ~0.001 or 0.002 when
      // CT >= MAX_CT and do exportWAV. So above process is not interruptive.
      //var s2 = get_time();
      //console.log('time used: ' + (s2-s)/1000 + ' sec'); 
    }

    this.configure = function(cfg){
      for (var prop in cfg){
        if (cfg.hasOwnProperty(prop)){
          config[prop] = cfg[prop];
        }
      }
    }

    this.record = function(){
      recording = true;
    }

    this.stop = function(){
      recording = false;
    }

    this.clear = function(){
      worker.postMessage({ command: 'clear' });
    }

    this.getBuffer = function(cb) {
      currCallback = cb || config.callback;
      worker.postMessage({ command: 'getBuffer' })
    }

    this.exportWAV = function(cb, type){
      currCallback = cb || config.callback;
      type = type || config.type || 'audio/wav';
      if (!currCallback) throw new Error('Callback not set');
      worker.postMessage({
        command: 'exportWAV',
        type: type
      });
    }

    //Mp3 conversion
    worker.onmessage = function(e){
      var blob = e.data;
      var msg = "the blob " + blob + " " + blob.size + " " + blob.type;
      ///console.log(msg);
      __log(msg);

      var arrayBuffer;
      var fileReader = new FileReader();

      fileReader.onload = function(){
        arrayBuffer = this.result;
        var buffer = new Uint8Array(arrayBuffer),
            data = parseWav(buffer);

        var t1 = get_time();
        ///console.log(data);
        ///console.log("Converting to Mp3");
        __log("Converting to Mp3");

        encoderWorker.postMessage({ cmd: 'init', config:{
          mode : 3,
          channels:1,
          samplerate: data.sampleRate,
          bitrate: data.bitsPerSample
        }});

        encoderWorker.postMessage({ cmd: 'encode', buf: Uint8ArrayToFloat32Array(data.samples) });
        encoderWorker.postMessage({ cmd: 'finish'});
        encoderWorker.onmessage = function(e) {
          if (e.data.cmd == 'data') {

            var t2 = get_time();
            var t = (t2 - t1)/1000;
            t1 = t2;
            ///console.log("Done converting to Mp3");
            __log("Done converting to Mp3. t = " + t + " seconds");

            var v = 'data:audio/mp3;base64,' + encode64(e.data.buf);
            sendAudio(v);

            //console.log ("The Mp3 data " + e.data.buf);
            __log("The MP3 data size: " + e.data.buf.length);

            /*
            var mp3Blob = new Blob([new Uint8Array(e.data.buf)], {type: 'audio/mp3'});
            uploadAudio(mp3Blob);
        
            var url = 'data:audio/mp3;base64,' + encode64(e.data.buf);
            var li = document.createElement('li');
            var au = document.createElement('audio');
            var hf = document.createElement('a');
        
            au.controls = true;
            au.src = url;
            hf.href = url;
            hf.download = 'audio_recording_' + new Date().getTime() + '.mp3';
            hf.innerHTML = hf.download;
            li.appendChild(au);
            li.appendChild(hf);
            recordingslist.appendChild(li);
            */
          }
        };
      };

      fileReader.readAsArrayBuffer(blob);

      currCallback(blob);
    }

    function sendAudio(v) {
        //var audio = document.getElementById('idSoundVoice');
        //audio.src = 'data:audio/mp3;base64,' + encode64(e.data.buf);
        //audio.play();
        
        var data = '{"cmd":"speak", "room_name":"' + current_room +
                          '", "msg":"' + v +
                          '", "meta":"' + 'audio' +
                          '", "tracker":"' + current_tid + '"}';
        send_data(data);
    }

    function get_time() {
        var d = new Date();
        return d.getTime();
    }

    function encode64(buffer) {
      var binary = '',
          bytes = new Uint8Array( buffer ),
          len = bytes.byteLength;

      for (var i = 0; i < len; i++) {
        binary += String.fromCharCode( bytes[ i ] );
      }
      return window.btoa( binary );
    }

    function parseWav(wav) {
      function readInt(i, bytes) {
        var ret = 0,
            shft = 0;

        while (bytes) {
          ret += wav[i] << shft;
          shft += 8;
          i++;
          bytes--;
        }
        return ret;
      }
      if (readInt(20, 2) != 1) throw 'Invalid compression code, not PCM';
      if (readInt(22, 2) != 1) throw 'Invalid number of channels, not 1';
      return {
        sampleRate: readInt(24, 4),
        bitsPerSample: readInt(34, 2),
        samples: wav.subarray(44)
      };
    }

    function Uint8ArrayToFloat32Array(u8a){
      var f32Buffer = new Float32Array(u8a.length);
      for (var i = 0; i < u8a.length; i++) {
        var value = u8a[i<<1] + (u8a[(i<<1)+1]<<8);
        if (value >= 0x8000) value |= ~0x7FFF;
        f32Buffer[i] = value / 0x8000;
      }
      return f32Buffer;
    }

    function uploadAudio(mp3Data){
      var reader = new FileReader();
      reader.onload = function(event){
        var fd = new FormData();
        var mp3Name = encodeURIComponent('audio_recording_' + new Date().getTime() + '.mp3');
        ///console.log("mp3name = " + mp3Name);
        __log("mp3name = " + mp3Name);
        fd.append('fname', mp3Name);
        fd.append('data', event.target.result);
        $.ajax({
          type: 'POST',
          url: 'upload.php',
          data: fd,
          processData: false,
          contentType: false
        }).done(function(data) {
          //console.log(data);
          __log("data: " + data);
        });
      };   
      reader.readAsDataURL(mp3Data);
    }

    source.connect(this.node);
    this.node.connect(this.context.destination);  //this should not be necessary
  };

  /*Recorder.forceDownload = function(blob, filename){
  console.log("Force download");
  var url = (window.URL || window.webkitURL).createObjectURL(blob);
  var link = window.document.createElement('a');
  link.href = url;
  link.download = filename || 'output.wav';
  var click = document.createEvent("Event");
  click.initEvent("click", true, true);
  link.dispatchEvent(click);
  }*/

  window.Recorder = Recorder;

})(window);
