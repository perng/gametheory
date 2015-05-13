// 
// From: http://www.scriptcam.com/demo_1.cfm
//

var use_html5_video;
var localMediaStream;

document.addEventListener('DOMContentLoaded', function(){
    html5_video = document.getElementById('videoElement');
    html5_canvas = document.getElementById('canvas');
    html5_context = canvas.getContext('2d');
    html5_w = canvas.width;
    html5_h = canvas.height;

},false);

// uploadImage: upload.gif, hide it for now.
function init_vid() {
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || 
        navigator.mozGetUserMedia || navigator.msGetUserMedia || navigator.oGetUserMedia;

    if (navigator.getUserMedia) {      
        use_html5_video = true;
        localMediaStream = navigator.getUserMedia({video: true}, handleVideo, videoError);
    }
    else { // fall back to flash.
        $('#video_container').hide(); // hide html5 video container.
        $('#vids').css('top', '0px'); // move div vids up so there is no space in between.
        use_html5_video = false;
        init_vid_flash();
    }
}

function handleVideo(stream) { // if found attach feed to video element
    videoGood();
    var video = document.querySelector("#videoElement");
    video.src = window.URL.createObjectURL(stream);
}

function videoGood() {
    $("#div_noCamMsg").hide();
    $("#btnRecord").show();
}
 
function videoError(e) { // no webcam found 
    $("#div_noCamMsg").show();
    $("#btnRecord").hide();
}

function getVideoURI() {
    if(html5_video.paused || html5_video.ended) return false; // if no video, exit here
    html5_context.drawImage(html5_video,0,0,html5_w,html5_h); // draw video feed to canvas
    var uri = canvas.toDataURL("image/jpeg", 0.8); // 2nd param is for quality.
    //imgtag.src = uri; // add URI to IMG tag src
    return uri;
}

function onUploadImg() {
    $("#fileselect").trigger('click');
}

function uploadImg() {
    var sel = document.getElementById('fileselect');
    var f = sel.files[0]; // get selected file (camera capture)
   
    var fr = new FileReader();
    fr.onload = function() {
        var v = fr.result;
        sendVid(v);
    }

    fr.readAsDataURL(f); // get captured image as data URI
}

function init_vid_flash() {
    $("#webcam").scriptcam({
        showMicrophoneErrors:false,
        onError:onError,
        cornerRadius:0 /*20*/,
        disableHardwareAcceleration:1,
        cornerColor:'e3e5e2',
        onWebcamReady:onWebcamReady,
        uploadImage:'../js/video/upload.gif',
        zoom:0.75,
        onPictureAsBase64:base64_tofield_and_image
    });
}

function base64_tofield() {
    $('#formfield').val($.scriptcam.getFrameAsBase64());
}

function base64_toimage() {
    //$('#image').attr("src","data:image/png;base64,"+$.scriptcam.getFrameAsBase64());
    var v;

    if (use_html5_video) {
        v = getVideoURI();
    } else {
        v = "data:image/png;base64," + $.scriptcam.getFrameAsBase64();
    }
    sendVid(v);
}

function sendVid(v) {
    $("#vid_image").attr('src', v); // echo to self.

    var data = '{"cmd":"speak", "room_name":"' + current_room +
                          '", "msg":"' + v +
                          '", "meta":"' + 'vid' +
                          '", "tracker":"' + current_tid + '"}';
    send_data(data);
}


var stream = null;
function record(o) {
    if (stream == null) {
        //html5_video.play();
        o.title = 'Stop Video';
        $('#btnRecordImg').attr('src', '../images/stop.png');
        $('#btnUploadImg').hide();
        stream = setInterval(base64_toimage, 150);
    }
    else {
        clearInterval(stream);
        stream = null;
        o.title = 'Start Video';
        $('#btnRecordImg').attr('src', '../images/start.png');
        $('#btnUploadImg').show();
    }
}
function record_stop() {
    if (stream != null) {
        //html5_video.stop();
        localMediaStream.stop();
        clearInterval(stream);
        stream = null;
        //$('#btnRecord').val('Start Record');
    }
}

/*
// Use immediate function to wrap variable "stream" so it's not in global scope.
var record = (function() {
    var stream = null;

    function record(o) {
        if (stream == null) {
            o.value = 'Stop Recording';
            stream = setInterval(base64_toimage, 100);
        }
        else {
            clearInterval(stream);
            stream = null;
            o.value = 'Start Recording';
        }
    }

    return record;
}());
*/

function base64_tofield_and_image(b64) {
    //$('#formfield').val(b64);
    //$('#image').attr("src","data:image/png;base64,"+b64);

    var v = "data:image/png;base64,"+b64;
    var data = '{"cmd":"speak", "room_name":"' + current_room +
                          '", "msg":"' + v +
                          '", "meta":"' + 'vid' +
                          '", "tracker":"' + current_tid + '"}';
    send_data(data);
};
function changeCamera() {
    $.scriptcam.changeCamera($('#cameraNames').val());
}
function onError(errorId,errorMsg) {
    //$( "#btn1" ).attr( "disabled", true );
    //$( "#btn2" ).attr( "disabled", true );
    alert(errorMsg);
}               
function onWebcamReady(cameraNames,camera,microphoneNames,microphone,volume) {
    /*
    $.each(cameraNames, function(index, text) {
        $('#cameraNames').append( $('<option></option>').val(index).html(text) )
    }); 
    $('#cameraNames').val(camera);
    */
}

