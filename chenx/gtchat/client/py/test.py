#!/usr/bin/python

#
# usage: test.py [test_filename]
#
# This script reads from given test file.
# The test file contains a series of test cases. 
#
# The lines in the test file are defined as:
# - Blank lines are ignored.
# - If a line starts with "#", then it's a comment line, and will be printed as is.
# - If a line starts with "#" and then only "blank" after this, it will print
#   an empty line. There can be spaces between "#" and "blank".
# - If a line starts with "out:", then it's a test case expected output.
# - Otherwise, it is a test case input to be sent to server as a command.
# - The number of test cases input and output must equal.
#
# The command lines will be sent to server as test cases, response will be read from
# server, and compared to expected output. In the end, a summary will be printed about
# the testing.
#
# By: X. Chen
# Created on: 3/20/2015
# Last modified: 3/20/2015
#
# Asynchronous non-blocking read from another process stdout: 
# http://eyalarubas.com/python-subproc-nonblock.html
#

import json, sys
from subprocess import Popen, PIPE
from time import sleep
from fcntl import fcntl, F_GETFL, F_SETFL
from os import O_NONBLOCK, read


# verbose levels
VERBOSE_None = 0
VERBOSE_All  = 15
VERBOSE_Fail = 1  # show details of failed test cases only


class Test():

    def __init__(self, test_file, verbose):
        print "start testing .."
        self.test_file = test_file
        self.test_cases = []
        self.test_cases_out = []  # output of test case.
        self.test_no = 0
        self.test_file_line = 0
        self.test_file_last_input_line = 0  # used in print_stdout_fail().
        self.test_case_count = 0
        self.verbose = verbose


    def read_test_cases(self):
        print "read test cases .."
        with open(self.test_file) as f:
            for line in f:
                line = line.strip()
                if line != "":  # ignore empty lines.
                    #self.test_cases.append(line)
                    #print " --- another line: " + line
                    if line.startswith("#"):       # comment line.
                        self.test_cases.append(line)
                    elif line.startswith("out:"):  # test output. 
                        self.test_cases_out.append(line[4:].strip())
                        #print "output: " + line[4:].strip() 
                    else:   
                        self.test_cases.append(line)
                        self.test_case_count += 1

        if len(self.test_cases) == 0:
            print "there is no content in test file. stop."
            return False

        if self.test_case_count != len(self.test_cases_out):
            print "number of test cases input and output do not match. stop."
            return False

        print "number of test cases: " + str(self.test_case_count) + "\n"

        return True


    def print_stdout(self, msg):
        if self.verbose == VERBOSE_None:
            return
        if self.verbose == VERBOSE_All:
            print msg


    def print_stdout_fail(self, output, expect):
        print "input: " + self.test_cases[self.test_file_last_input_line] 
        print output
        print expect


    def send_command(self, writer):
        n = self.test_file_line
        cmd = self.test_cases[n]

        if cmd.startswith("#"):  # comment line.
            if cmd[1:].strip() == "blank":  # the line string after "#' is "blank".
                self.print_stdout("")
            else:
                self.print_stdout(cmd)
        else:
            self.print_stdout("")
            print("==>test(" + str(self.test_no + 1) + ")"),
            self.print_stdout(": " + cmd)
            #self.print_stdout("==>test(" + str(self.test_no + 1) + "): " + cmd)

            writer(cmd + '\n')
            self.test_no += 1
            self.test_file_last_input_line = self.test_file_line

            # let the shell output the result
            sleep(1)

        self.test_file_line += 1


    def do_test(self):
        if not self.read_test_cases(): 
            return

        proc = Popen(['python', 'client.py', 'ws://localhost:9001'], \
                   stdin=PIPE, stdout=PIPE, stderr=PIPE, shell=False)

        # set the O_NONBLOCK flag of p.stdout file descriptor:
        flags = fcntl(proc.stdout, F_GETFL) # get current p.stdout flags
        fcntl(proc.stdout, F_SETFL, flags | O_NONBLOCK)

        # client.py output starts with this. Need to remove this before comparison
        # with expected output.
        response_header = "Text message received:"
        response_header_len = len(response_header)

        pass_count = 0

        # issue command:
        self.send_command(proc.stdin.write)

        while True:
            try:
                msg = read(proc.stdout.fileno(), 1024)
                msg = msg.replace(">>> ", "").strip()
                if msg != "": 
                    self.print_stdout(msg)

                    msg = msg[response_header_len:].strip()
                    expected_out = self.test_cases_out[self.test_no - 1]
                    if msg == expected_out:
                        print "... pass"
                        pass_count += 1
                    else:
                        print "... fail"
                        self.print_stdout("expected: " + expected_out) 
                        if self.verbose == VERBOSE_Fail:
                            self.print_stdout_fail( \
                                "output: " + msg, \
                                "expected: " + expected_out)

            except OSError:
                # the os throws an exception if there is no data
                if self.test_file_line >= len(self.test_cases):
                    print '\n[End of Test]'

                    # print result.
                    print "total test cases: " + str(self.test_case_count)
                    print "passed: " + str(pass_count)
                    print "failed: " + str(self.test_case_count - pass_count)

                    proc.stdin.write('exit\n')  # shutdown client.py
                    proc.terminate()  # unregister this client on server side.
                    break
                else:
                    self.send_command(proc.stdin.write)


if __name__ == '__main__':

    argc = len(sys.argv)

    if argc < 2:
        #print("Need the WebSocket server address, i.e. ws://localhost:9001")
        print "usage: test.py {test_filename} [-v|-f]"
        print "-v: show all details, -f show failed test cases only"
        sys.exit(1)

    test_filename = sys.argv[1]

    # get verbose level
    # default: do not show any details of test cases.
    verbose = VERBOSE_None  
    if argc >= 3:
        if sys.argv[2] == "-v":
           verbose = VERBOSE_All  # show details of all test cases.
        elif sys.argv[2] == "-f":
           verbose = VERBOSE_Fail  # show details of failed test cases only.

    Test(test_filename, verbose).do_test()



##############
# testing code
##############

"""
from subprocess import Popen, PIPE
from time import sleep
from nbstreamreader import NonBlockingStreamReader as NBSR

# run the shell as a subprocess:
p = Popen(['python', 'client.py', 'ws://localhost:9000'],
        stdin = PIPE, stdout = PIPE, stderr = PIPE, shell = False)
# wrap p.stdout with a NonBlockingStreamReader object:
nbsr = NBSR(p.stdout)
# issue command:
p.stdin.write('command\n')
sleep(1)
# get the output
while True:
    output = nbsr.readline(0.1)
    # 0.1 secs to let the shell output the result
    if not output:
        print '[No more data]'
        break
    print output
"""

"""
#
# http://eyalarubas.com/python-subproc-nonblock.html
#
from subprocess import Popen, PIPE
from time import sleep
from fcntl import fcntl, F_GETFL, F_SETFL
from os import O_NONBLOCK, read

# run the shell as a subprocess:
p = Popen(['python', 'client.py', 'ws://localhost:9000'],
        stdin = PIPE, stdout = PIPE, stderr = PIPE, shell = False)

# set the O_NONBLOCK flag of p.stdout file descriptor:
flags = fcntl(p.stdout, F_GETFL) # get current p.stdout flags
fcntl(p.stdout, F_SETFL, flags | O_NONBLOCK)

# issue command:
p.stdin.write('command\n')
# let the shell output the result:
sleep(1)
# get the output
while True:
    try:
        print read(p.stdout.fileno(), 1024),
    except OSError:
        # the os throws an exception if there is no data
        print '[No more data]'
        break
"""

