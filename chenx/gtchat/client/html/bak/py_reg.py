#!/usr/bin/python

import json, sys, re


if __name__ == '__main__':

    print 'hi'
    """
    To escape back slash \, MUST put it at the end of pattern as: [...\\\]
    """
    #pattern = re.compile("^[a-zA-Z0-9_`'~!@#\$%\^&\*_\+\-=\[\];<>\./\?)\{\}]+$")

    # special chars: `~!@#$%^&*()_+-={}[]|\:;"'<,>.?/
    pattern = re.compile("[`'~!@#\$%\^&\*\+\-=\[\];<>\./\?)\{\}:,\|\"\(\\\]")
    #pattern = re.compile("^[a-zA-Z0-9_`'~!@#\$%\^&\*_\+]+$")
    #pattern = re.compile("[:,\|\"\(\\\]")
    #pattern = re.compile("[b\\\]")
    if pattern.search("a/b"):
       print 'matched'
    else:
       print 'NOT matched'

    a = "\r"
    a = a.replace('\\', '\\\\')
    print a
