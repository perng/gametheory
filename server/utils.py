import json

OK = 'ok'
ERROR = 'error'
WAITING = 'waiting'

def JsonResponse(socket, params, result, status=OK, msg=''):
    print 'result=', result
    result["status"] = status
    result["msg"] = msg
    result["reply_cmd"] = params['cmd']
    if '_tracker' in params:
        result['_tracker'] = params['_tracker']
    socket.sendMessage(json.dumps(result).encode('utf8'), False)


def SendMessage(socket, msg):
    socket.sendMessage(json.dumps(msg).encode('utf8'), False)

def BroadCast(sender_id, sockets, msg, attach_sender_id=True):
    print 'BoradCast', msg, 'from', sender_id
    if attach_sender_id:
        msg['sender_id'] = sender_id
    for socket in sockets:
        if sender_id != socket.player.id:
            socket.sendMessage(json.dumps(msg).encode('utf8'), False)