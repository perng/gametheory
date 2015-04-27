#!/usr/bin/python

import json, sys, re

def isHTMLColor(str):
    color_pattern = re.compile("^#[0-9a-fA-F]{6}$")
    return True if color_pattern.match(str) else False

def isInt(s):
    print str(s)
    try:
        return str(s) == str(int(s))
    except:
        return False


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

    print isHTMLColor('1')
    print isHTMLColor('#923423')
    print isHTMLColor('#abcdef')
    print isHTMLColor('#abcdef1')
    print isHTMLColor('#abcdeF')
    print isHTMLColor('#abcdeG')
    print isHTMLColor('#abcde')

    print ''

    print isInt(1)
    print isInt('a')
    print isInt('2')
    print isInt(1.2)
    print isInt(1232387429749987)
    print isInt('23947294872934829347s8')
    print isInt('a2')
    print isInt('2a')
