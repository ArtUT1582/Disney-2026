# -*- coding: utf-8 -*-
"""Sync the Disney working folder into this repo, redact, commit and push.

Why this exists: the working folder
    .../Desktop/Claude/Disney
is NOT a git repo, and for a while the only clone of this repository lived in a
Windows temp directory that was 60 commits behind. There was no reliable path
from "edited the dashboard" to "the site is updated". This is that path.

REDACTION: Disney confirmation numbers are stripped before publishing. The site
is public; a name plus a confirmation number is enough to look up or alter a
prepaid reservation. They stay intact in the local working copy, which is where
they are actually useful.

Usage:  python publish.py            # dry run, shows what would change
        python publish.py --push     # sync, commit and push
"""
import filecmp
import hashlib
import os
import re
import shutil
import subprocess
import sys

REPO = os.path.dirname(os.path.abspath(__file__))
WORK = r"C:\Users\ArtemioGarcia\OneDrive - Ambassador Services\Desktop\Claude\Disney"

# files carried from the working folder to the site
FILES = [
    "index.html",
    "BBB-BUDGET.html",
    "PHARMACY.html",
    "sections/assets/eu-bg-snw.jpg",
]

# (pattern, replacement) applied to every .html before it is written to the repo
REDACTIONS = [
    (re.compile(r"conf\s*#\s*356226800617", re.I), "conf on file"),
    (re.compile(r"conf\s*#\s*356224683345", re.I), "conf on file"),
    (re.compile(r"\b356226800617\b"), "\u00b7\u00b7\u00b7\u00b7 0617"),
    (re.compile(r"\b356224683345\b"), "\u00b7\u00b7\u00b7\u00b7 3345"),
]


def redact(text):
    hits = 0
    for pat, rep in REDACTIONS:
        text, n = pat.subn(rep, text)
        hits += n
    return text, hits


def digest(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()[:12] if os.path.exists(path) else None


def main():
    push = "--push" in sys.argv
    changed, total_redactions = [], 0

    for rel in FILES:
        src = os.path.join(WORK, rel.replace("/", os.sep))
        dst = os.path.join(REPO, rel.replace("/", os.sep))
        if not os.path.exists(src):
            print("  SKIP (missing in working folder): %s" % rel)
            continue
        os.makedirs(os.path.dirname(dst), exist_ok=True)

        if rel.lower().endswith(".html"):
            text = open(src, encoding="utf-8").read()
            text, n = redact(text)
            total_redactions += n
            before = digest(dst)
            tmp = dst + ".tmp"
            open(tmp, "w", encoding="utf-8").write(text)
            if before != digest(tmp):
                os.replace(tmp, dst)
                changed.append("%s (%d redactions)" % (rel, n))
            else:
                os.remove(tmp)
        else:
            if not (os.path.exists(dst) and filecmp.cmp(src, dst, shallow=False)):
                shutil.copy2(src, dst)
                changed.append(rel)

    if changed:
        print("synced:")
        for c in changed:
            print("   " + c)
        print("redactions applied: %d" % total_redactions)
    else:
        print("working folder already matches the repo files")

    # Decide on git's view, not on whether THIS invocation copied anything - a
    # previous dry run may already have written the files, leaving them staged
    # but never committed. That is exactly how the site went stale before.
    pending = subprocess.run(["git", "-C", REPO, "status", "--porcelain"],
                             capture_output=True, text=True).stdout.strip()
    if not pending:
        print("nothing to commit - the site is already up to date")
        return
    print("\nuncommitted in repo:")
    for line in pending.splitlines():
        print("   " + line)

    if not push:
        print("\ndry run. re-run with --push to commit and deploy.")
        return

    subprocess.run(["git", "-C", REPO, "add", "-A"], check=True)
    msg = "Transport: replace rental-car/Uber assumptions with FS Premier legs; Express already purchased; EPA not available; fix Sat alarm to 2:45 AM"
    subprocess.run(["git", "-C", REPO, "commit", "-m", msg], check=True)
    subprocess.run(["git", "-C", REPO, "push", "origin", "main"], check=True)
    print("\npushed. GitHub Pages usually redeploys within a minute or two.")


if __name__ == "__main__":
    main()
