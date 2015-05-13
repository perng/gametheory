
  function __log(e, data) {
    appendConsole(e + " " + (data || ''));
  }

  var audio_context;
  var recorder;
  var input; // this must be global, so firefox won't garbage collect it and lose sharing of audio.

  function startUserMedia(stream) {
    //document.getElementById('btnRecordSound').disabled = false;
    input = audio_context.createMediaStreamSource(stream);
    __log('Media stream created.' );
    __log("input sample rate " +input.context.sampleRate);
    
    input.connect(audio_context.destination);
    __log('Input connected to audio context destination.');
    
    recorder = new Recorder(input);
    recorder && recorder.setExportMaxCT(10);
    __log('Recorder initialised.');
  }

  function recordSound(btn) {
    if (btn.title == 'Start Sound') {
        startRecording();
        document.getElementById('btnRecordSoundImg').src = '../images/sound_on.png';
        btn.title = 'Stop Sound';
    } else {
        stopRecording();
        document.getElementById('btnRecordSoundImg').src = '../images/sound_off.png';
        btn.title = 'Start Sound';
    }
  }

  function startRecording() {
    __log('\nstart recording...');

    //document.getElementById('btnRecordSound').disabled = true;
    //document.getElementById('btnStop').disabled = false;

    //var max_ct = 10; // 10: ~ 1 second per chunk.
    recorder && recorder.setExportMaxCT(10);
    recorder && recorder.record();
  }

  function stopRecording() {
    __log('Stopped recording.');

    //document.getElementById('btnRecordSound').disabled = false;
    //document.getElementById('btnStop').disabled = true;

    recorder && recorder.stop();
    recorder.exportWAV(function(blob){}); // this may be not decodable.
    recorder.clear();
  }

  function init_audio() {
    try { // webkit shim
      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      navigator.getUserMedia = ( navigator.getUserMedia ||
                       navigator.webkitGetUserMedia ||
                       navigator.mozGetUserMedia ||
                       navigator.msGetUserMedia);
      window.URL = window.URL || window.webkitURL;
      
      audio_context = new AudioContext;
      __log('Audio context set up.');
      __log('navigator.getUserMedia ' + (navigator.getUserMedia ? 'available.' : 'not present!'));
    } catch (e) {
      alert('No web audio support in this browser!');
    }
    
    navigator.getUserMedia({audio: true}, startUserMedia, function(e) {
      __log('No live audio input: ' + e);
    });
  };

