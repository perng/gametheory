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

def BroadCast(sockets, msg):
    for socket in sockets:
        socket.sendMessage(json.dumps(msg).encode('utf8'), False)