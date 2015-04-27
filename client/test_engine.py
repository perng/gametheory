from server.utils import *

global_tracker = 0

class Action:
    def __init__(self, cmd, settings={}, out_attrs=[], keep_attrs=[], delete_attrs=[],
                 extract_attrs={}, conditions = {}):
        '''
        :param cmd: the command
        :param settings: The key-values to be added to state
        :param out_attrs: Attributes to be encoded to message ('cmd' and '_tracker' will be added)
        :param keep_attrs: Attributes to be stored in state from the response
        :param delete_attrs: Attributes to be deleted from the state
        :param extract_attrs: Attributes that require extractor (a function) to extract and keep. The function is of
          form func(state, message)
        :return:
        '''
        global global_tracker
        self.cmd = cmd
        self.settings = settings
        self.out_attrs = out_attrs + settings.keys()
        self.keep_attrs = keep_attrs
        self.delete_attrs = delete_attrs
        self.extract_attrs = extract_attrs
        self.conditions = conditions
        if cmd:
            self.conditions['cmd'] = cmd

        self.next = None
        global_tracker += 1
        self.tracker = cmd + '_'+ str(global_tracker)
    def emit(self, state):
        state.update(self.settings)
        msg = {'cmd': self.cmd, '_tracker': self.tracker}
        for attr in self.out_attrs:
            msg[attr] = state[attr]
        print 'action', self.cmd, ' emit', msg
        print '************************'
        return msg
    def receive(self, message, state):
        if not self.conditions:
            assert message['status'] == OK

        for attr in self.keep_attrs:
            state[attr] = message[attr]
        for attr in self.delete_attrs:
            del state[attr]

        for attr in self.extract_attrs:
            state[attr] = self.extract_attrs[attr](state, message)
        if self.next:
            print '************************'
            return self.next.emit(state)
        print '************************'
        return None
    def __str__(self):
        return "(Action:"+self.conditions['cmd']+")"
    def __repr__(self):
        return self.__str__()

class Wait(Action):
    def __init__(self, settings={}, out_attrs=[], keep_attrs=[], delete_attrs=[],
                 extract_attrs={}, conditions = {}):
        Action.__init__(self, '', settings, out_attrs, keep_attrs, delete_attrs,
                 extract_attrs, conditions)

    def satisfy(self, message):
        for k in self.conditions:
            if k not in message or self.conditions[k] != message[k]:
                print '***mismatch on:', k
                return False
        return True

    def __str__(self):
        return "(Wait:"+str(self.conditions)+")"
    def __repr__(self):
        return self.__str__()


class Actions:
    def __init__(self):
        self.first = self.last = None
        self.actions = {}
        self.waits = []
    def add(self, action, start_over = False):
        self.actions[action.tracker] = action
        if not self.first:
            self.first = self.last = action
        else:
            if not start_over:
                self.last.next = action
            self.last = action
    def add_wait(self, wait):
        assert wait.__class__== Wait
        assert len(wait.conditions)>0
        self.waits.append(wait)
        print '*** added:', wait, str(self.waits)
    def get(self, tracker):
        return self.actions[tracker]

    def __str__(self):
        result = "Actions:"
        for a in self.actions:
            result +=  str(a) +"\t"
        result += "\n"

        result += "Waits:"
        for a in self.waits:
            result +=  str(a) +"\t"
        result += "\n"
        return result

