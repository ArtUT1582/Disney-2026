#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Fetch a real basemap for each park from OpenStreetMap via Overpass.

Pulls the layers that make a park legible - water, vegetation, buildings - plus
the walkway network, which is what lets the route follow real paths instead of
drawing straight lines through buildings.

    python fetch-park-maps.py          # fetch any park not already cached
    python fetch-park-maps.py --force  # refetch everything

Overpass is rate-limited and frequently returns 504 under load, so every park
is retried across several mirrors with a backoff. Results land in cache/.

Data (c) OpenStreetMap contributors, ODbL.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")

MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

# south, west, north, east - drawn generously so nothing clips at the edge.
BBOX = {
    "ak":  (28.3520, -81.5960, 28.3680, -81.5840),
    "hs":  (28.3515, -81.5650, 28.3630, -81.5555),
    "mk":  (28.4145, -81.5870, 28.4235, -81.5755),
    "usf": (28.4715, -81.4735, 28.4825, -81.4635),
    "eu":  (28.4355, -81.4535, 28.4450, -81.4415),
}

QUERY = """[out:json][timeout:120];
(
  way["natural"="water"]({bbox});
  way["waterway"]({bbox});
  way["landuse"~"forest|grass|meadow|recreation_ground"]({bbox});
  way["leisure"~"park|garden|playground"]({bbox});
  way["building"]({bbox});
  way["highway"~"footway|path|pedestrian|steps|service|living_street"]({bbox});
  way["railway"]({bbox});
);
out geom;
"""


def fetch(park, force=False):
    path = os.path.join(CACHE, "map_%s.json" % park)
    if os.path.exists(path) and not force:
        print("%-4s cached" % park)
        return True
    bbox = "%s,%s,%s,%s" % BBOX[park]
    body = urllib.parse.urlencode({"data": QUERY.format(bbox=bbox)}).encode()
    for attempt in range(6):
        host = MIRRORS[attempt % len(MIRRORS)]
        try:
            req = urllib.request.Request(
                host, data=body,
                headers={"User-Agent": "Disney2026-planner/1.0 (personal trip page)"})
            with urllib.request.urlopen(req, timeout=180) as r:
                raw = r.read()
            data = json.loads(raw)
            if not data.get("elements"):
                raise ValueError("no elements returned")
            os.makedirs(CACHE, exist_ok=True)
            open(path, "wb").write(raw)
            print("%-4s ok  %6d elements  (%s)" % (
                park, len(data["elements"]), host.split("//")[1].split("/")[0]))
            return True
        except Exception as e:  # 504s and transient JSON errors are expected here
            wait = 8 * (attempt + 1)
            print("%-4s attempt %d failed on %s: %s - retrying in %ds"
                  % (park, attempt + 1, host.split("//")[1].split("/")[0],
                     str(e)[:60], wait), file=sys.stderr)
            time.sleep(wait)
    print("%-4s FAILED after 6 attempts" % park, file=sys.stderr)
    return False


if __name__ == "__main__":
    force = "--force" in sys.argv
    ok = all([fetch(p, force) for p in BBOX])
    raise SystemExit(0 if ok else 1)
