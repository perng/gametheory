// 
// From: http://www.scriptcam.com/demo_1.cfm
//

function init_vid() {
    $("#webcam").scriptcam({
        showMicrophoneErrors:false,
        onError:onError,
        cornerRadius:20,
        disableHardwareAcceleration:1,
        cornerColor:'e3e5e2',
        onWebcamReady:onWebcamReady,
        uploadImage:'upload.gif',
        onPictureAsBase64:base64_tofield_and_image
    });
}

function base64_tofield() {
    $('#formfield').val($.scriptcam.getFrameAsBase64());
};
function base64_toimage() {
    //$('#image').attr("src","data:image/png;base64,"+$.scriptcam.getFrameAsBase64());

    var v = "data:image/png;base64,"+$.scriptcam.getFrameAsBase64();
    var data = '{"cmd":"speak", "room_name":"' + current_room +
                          '", "msg":"' + v +
                          '", "meta":"' + 'vid' +
                          '", "tracker":"' + current_tid + '"}';
    send_data(data);
};

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
    $.each(cameraNames, function(index, text) {
        $('#cameraNames').append( $('<option></option>').val(index).html(text) )
    }); 
    $('#cameraNames').val(camera);
}
