#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Stamp index.html's asset links with a hash of each file's contents.

A hand-typed ?v=20260922 only busts the cache if you remember to change it.
On 2026-09-22 I did not, and the published page kept serving a stale
day-metrics.js from the browser cache while the server held the new one.
Hashing the file removes the remembering.

    python stamp-assets.py            # rewrite index.html
    python stamp-assets.py --check    # exit 1 if any stamp is stale
    python stamp-assets.py --selftest
"""
import hashlib
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE = os.path.join(HERE, "index.html")

# Local assets whose links carry a ?v= stamp.
ASSETS = ("day-metrics.js", "day-metrics-ui.js", "day-metrics.css",
          "hero.css", "trip-tools.css", "trip-tools.js", "install.js", "weather.js", "day-switch.js",
          "booking-reminder.js")


def digest(path):
    h = hashlib.sha1()
    h.update(open(path, "rb").read())
    return h.hexdigest()[:10]


def stamp(html, name, ver):
    """Replace the ?v=... on this asset, or add one if it has none."""
    pat = re.compile(r'(["\'])((?:[^"\']*/)?%s)(\?v=[^"\']*)?\1'
                     % re.escape(name))
    return pat.sub(lambda m: '%s%s?v=%s%s' % (m.group(1), m.group(2), ver,
                                              m.group(1)), html)


def run(check_only=False):
    html = open(PAGE, encoding="utf-8").read()
    out, stale = html, []
    for name in ASSETS:
        path = os.path.join(HERE, name)
        if not os.path.exists(path):
            continue
        ver = digest(path)
        before = out
        out = stamp(out, name, ver)
        if before != out:
            stale.append(name)
        print("%-22s v=%s" % (name, ver))
    if check_only:
        if stale:
            print("STALE: %s" % ", ".join(stale), file=sys.stderr)
            return 1
        print("all stamps current")
        return 0
    if out != html:
        open(PAGE, "w", encoding="utf-8", newline="").write(out)
        print("index.html updated (%s)" % ", ".join(stale))
    else:
        print("index.html already current")
    return 0


def selftest():
    # Adds a stamp where there is none.
    h = '<script src="day-metrics.js"></script>'
    assert stamp(h, "day-metrics.js", "abc") == \
        '<script src="day-metrics.js?v=abc"></script>'
    # Replaces an existing one.
    h = '<script src="day-metrics.js?v=old"></script>'
    assert stamp(h, "day-metrics.js", "new") == \
        '<script src="day-metrics.js?v=new"></script>'
    # Leaves a different asset alone, and does not match a longer name that
    # merely ends with the same text.
    h = '<link href="other.css?v=1"><script src="vendor/day-metrics.js?v=1">'
    o = stamp(h, "day-metrics.js", "z")
    assert 'other.css?v=1' in o, o
    assert 'vendor/day-metrics.js?v=z' in o, o
    h2 = '<script src="my-day-metrics.js?v=1">'
    assert stamp(h2, "day-metrics.js", "z") == h2, stamp(h2, "day-metrics.js", "z")
    # Single quotes work too.
    h3 = "<script src='day-metrics.js?v=1'>"
    assert stamp(h3, "day-metrics.js", "q") == "<script src='day-metrics.js?v=q'>"
    # Same bytes give the same digest; different bytes do not.
    import tempfile
    a = os.path.join(tempfile.gettempdir(), "_stamp_a")
    b = os.path.join(tempfile.gettempdir(), "_stamp_b")
    open(a, "wb").write(b"hello")
    open(b, "wb").write(b"hello!")
    assert digest(a) == digest(a)
    assert digest(a) != digest(b)
    os.remove(a); os.remove(b)
    print("stamp-assets selftest OK")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest()
        raise SystemExit(0)
    raise SystemExit(run(check_only="--check" in sys.argv))
