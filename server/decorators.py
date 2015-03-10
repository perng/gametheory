from utils import *

class required_params(object):
    def __init__(self, *args):
        self.required = args

    def __call__(self, f):
        def wrapped_f(socket, params):
            missing = [p for p in self.required if p not in params]
            if missing:
                msg = 'parameters ' + ','.join(missing) + ' are missing.'
                return JsonResponse(socket, params, {}, ERROR, msg)
            return f(socket, params)
        return wrapped_f

class required_one_param(object):
    def __init__(self, *args):
        self.required = args

    def __call__(self, f):
        def wrapped_f(socket, params):
            common = [p for p in self.required if p in params]
            if common:
                return f(socket, params)
            return JsonResponse(socket, params, {}, ERROR, 'require at least one of '+self.required)
        return wrapped_f


def login_required(func):
    def wrapped_f(socket, params):
        if socket.player:
            return func(socket, params)
        msg = 'login required'
        return JsonResponse(socket, params, {}, ERROR, msg)

    return wrapped_f
