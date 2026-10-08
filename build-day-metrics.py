#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Build day-metrics.js: per-stop wait/experience minutes and walking distance.

Coordinates come from the public themeparks.wiki entity API (cached in
cache/*.json). Distances use cached OpenStreetMap paths where connected, with a flagged
straight-line fallback where path coverage is incomplete.

    python build-day-metrics.py            # rebuild day-metrics.js
    python build-day-metrics.py --selftest # check the maths

Activity identities, estimates and map anchors come directly from index.html;
reordering a stop cannot attach another activity’s data to it.
"""
import json
import math
import os
import re
import sys
import urllib.request

import parkmap

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")
OUT = os.path.join(HERE, "day-metrics.js")

# Fallback only. Legs are normally measured along the real OpenStreetMap
# walkway network; this factor is used only when two stops cannot be connected
# on that network, and any such leg is flagged in the output.
PATH_FACTOR = 1.35

# A real walk between two attractions is longer than the straight line, but not
# by much more than double. When the router returns far more than that it has
# not found a clever detour - it has failed to find the path that actually
# exists, because OSM's walkway coverage inside the newer lands is patchy, and
# it has looped around the outside instead. Those legs fall back to the
# straight-line estimate and are counted in estimatedLegs.
MAX_DETOUR = 2.2
# Average adult stride. A family pace with a four-year-old is shorter, but the
# adults carry the distance, so this stays the honest middle.
STRIDE_M = 0.72

PARKS = {
    "ak": "1c84a229-8862-4648-9c71-378ddd2c7693",
    "hs": "288747d1-8b4f-4a64-867e-ea7c9b27bad8",
    "mk": "75ea578a-adc8-4116-a54d-dccb60765ef9",
    "usf": "eb3f4560-2383-4a36-9152-6b3e5ed6bc57",
    "eu": "12dbb85b-265f-44e6-bccf-f1faa17211fc",
}

# Park gates / off-map anchors that the API does not publish as entities.
GATES = {
    "ak": (28.35478, -81.58989),    # Oasis entry plaza
    "hs": (28.35570, -81.55957),    # Hollywood Blvd entrance
    "mk": (28.41571, -81.58109),    # Main Street train station
    "usf": (28.47470, -81.46760),   # USF front gates / CityWalk
    "eu": (28.43915, -81.44612),    # Chronos Portal; cached OSM way 1369684711
}

# The HTML is the single source for activity identity, estimates and anchors.
from html.parser import HTMLParser

DAY_INFO = {
    "day-ak": ("ak", "Animal Kingdom", "Mon 12 Oct"),
    "day-hs": ("hs", "Hollywood Studios", "Tue 13 Oct"),
    "day-mk": ("mk", "Magic Kingdom", "Wed 14 Oct"),
    "day-hhn": ("usf", "HHN 35", "Thu 15 Oct"),
    "day-eu": ("eu", "Epic Universe", "Fri 16 Oct"),
}

class ItineraryParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.day = None
        self.days = {}
        self.ids = set()

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == "article" and attrs.get("id") in DAY_INFO:
            self.day = attrs["id"]
            park, label, date = DAY_INFO[self.day]
            self.days[self.day] = dict(park=park, label=label, date=date, stops={})
        if tag != "li" or "ed-ev" not in attrs.get("class", "").split():
            return
        if not self.day:
            raise ValueError("Activity outside a known day")
        ident = attrs["data-stop-id"]
        if ident in self.ids:
            raise ValueError("Duplicate activity: " + ident)
        self.ids.add(ident)
        wait, exp = int(attrs["data-wait"]), int(attrs["data-experience"])
        kind = attrs["data-kind"]
        if min(wait, exp) < 0 or kind not in ("ride", "show", "meet", "appointment", "meal", "walk", "transit", "app", "rest"):
            raise ValueError("Invalid estimate: " + ident)
        if attrs["data-optional"] not in ("true", "false"):
            raise ValueError("Invalid optional status: " + ident)
        stops = self.days[self.day]["stops"]
        stops[ident] = dict(n=len(stops)+1, w=wait, e=exp, k=kind,
                            alt=attrs["data-optional"] == "true",
                            anchor=attrs.get("data-anchor"))

    def handle_endtag(self, tag):
        if tag == "article":
            self.day = None

def read_days():
    parser = ItineraryParser()
    with open(os.path.join(HERE, "index.html"), encoding="utf-8") as source:
        parser.feed(source.read())
    if set(parser.days) != set(DAY_INFO) or any(not d["stops"] for d in parser.days.values()):
        raise ValueError("Missing park day or activities")
    return parser.days

DAYS = read_days()


def haversine_m(a, b):
    """Great-circle distance in metres between two (lat, lon) pairs."""
    r = 6371000.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp = p2 - p1
    dl = math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def walk_m(a, b):
    return haversine_m(a, b) * PATH_FACTOR


def steps_for(metres):
    return int(round(metres / STRIDE_M))


def load_park(key):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, "ch_%s.json" % key)
    if not os.path.exists(path):
        url = "https://api.themeparks.wiki/v1/entity/%s/children" % PARKS[key]
        with urllib.request.urlopen(url, timeout=30) as r:
            open(path, "wb").write(r.read())
    data = json.load(open(path, encoding="utf-8"))
    out = {}
    for c in data["children"]:
        loc = c.get("location") or {}
        if loc.get("latitude") is not None:
            out[c["name"]] = (loc["latitude"], loc["longitude"])
    return out


GRAPHS = {}


def _park_assets(park):
    """Walkway graph for a park, loaded once."""
    if park not in GRAPHS:
        try:
            GRAPHS[park] = parkmap.Graph(park)
        except FileNotFoundError as e:
            print("  %s" % e, file=sys.stderr)
            GRAPHS[park] = None
    return GRAPHS[park]


def build():
    result = {}
    missing = []
    for day_id, day in DAYS.items():
        coords = load_park(day["park"])
        gate = GATES[day["park"]]
        stops = []
        for ident, activity in day["stops"].items():
            n = activity["n"]
            wait, exp, kind = activity["w"], activity["e"], activity["k"]
            alt = activity["alt"]
            name = activity["anchor"]
            if name == "GATE":
                pt = gate
            elif name:
                pt = coords.get(name)
                if pt is None:
                    missing.append("%s #%d: %s" % (day_id, n, name))
            else:
                pt = None
            stops.append({"id": ident, "n": n, "w": wait, "e": exp, "k": kind,
                          "alt": alt, "pt": pt})

        # Route: the mappable stops in order. Each leg is walked along the real
        # OSM footpath network, so the line on the map is the line you walk and
        # the distance is measured rather than guessed.
        graph = _park_assets(day["park"])
        route, prev, prev_node, total_m = [], None, None, 0.0
        estimated = 0
        for s in stops:
            if not s["pt"] or s["alt"]:
                continue
            node = graph.nearest(s["pt"]) if graph else None
            leg_m, line = 0.0, []
            if prev is not None:
                r = graph.route(prev_node, node) if (graph and node and prev_node) else None
                straight = haversine_m(prev, s["pt"])
                if r and (straight < 15 or r[1] <= straight * MAX_DETOUR):
                    line, leg_m = r[0], r[1]
                else:
                    # Either no walkable connection at all, or one so long it
                    # is plainly an artefact of missing path data. Fall back to
                    # the straight-line estimate and say so.
                    line, leg_m = [prev, s["pt"]], walk_m(prev, s["pt"])
                    estimated += 1
            total_m += leg_m
            route.append({"id": s["id"], "n": s["n"], "lat": round(s["pt"][0], 6),
                          "lon": round(s["pt"][1], 6),
                          "leg": int(round(leg_m)), "cum": int(round(total_m))})
            prev, prev_node = s["pt"], node or prev_node

        counted = [s for s in stops if not s["alt"]]
        # "Rides and shows" means exactly that. A 90-minute castle lunch and a
        # 70-minute bus are real time but they are not the ride you queued for,
        # so they are counted separately instead of inflating the headline.
        ON_RIDE = ("ride", "show", "meet")
        result[day_id] = {
            "label": day["label"], "date": day["date"],
            "waitMin": sum(s["w"] for s in counted),
            "expMin": sum(s["e"] for s in counted),
            "rideShowMin": sum(s["e"] for s in counted if s["k"] in ON_RIDE),
            "otherMin": sum(s["e"] for s in counted if s["k"] not in ON_RIDE),
            "metres": int(round(total_m)),
            "steps": steps_for(total_m),
            "estimatedLegs": estimated,
            "stops": {s["id"]: {"n": s["n"], "w": s["w"], "e": s["e"], "k": s["k"],
                                    "alt": s["alt"]} for s in stops},
            "route": route,
        }

    if missing:
        print("UNMATCHED ANCHORS (fix data-anchor in index.html):", file=sys.stderr)
        for m in missing:
            print("  " + m, file=sys.stderr)
        return None
    return result


def selftest():
    # One degree of latitude is ~111.2 km.
    d = haversine_m((28.0, -81.0), (29.0, -81.0))
    assert 110000 < d < 112000, d
    # Zero distance stays zero.
    assert haversine_m((28.3, -81.5), (28.3, -81.5)) == 0.0
    # A known short hop: Na'vi River Journey to Flight of Passage, ~60 m apart.
    d = haversine_m((28.355257, -81.591641), (28.355554, -81.592147))
    assert 40 < d < 90, d
    # Steps convert at the declared stride.
    assert steps_for(720.0) == 1000, steps_for(720.0)
    assert steps_for(0.0) == 0
    # The walkway factor always lengthens the straight line.
    assert walk_m((28.0, -81.0), (28.001, -81.0)) > haversine_m((28.0, -81.0), (28.001, -81.0))
    print("selftest OK")


def update_park_cards(data):
    """Keep the static jump cards accurate even before JavaScript loads."""
    page = os.path.join(HERE, "index.html")
    with open(page, encoding="utf-8") as source:
        text = source.read()
    for day, metrics in data.items():
        core = sum(not stop["alt"] for stop in metrics["stops"].values())
        # ponytail: stop-to-stop distance undercounts a real park day ~5x, so cards show no step figure
        summary = "%d core stops" % core
        pattern = r'(<a class="pk-card" href="#%s">.*?<span class="pk-meta">).*?(</span>)' % re.escape(day)
        text, matches = re.subn(pattern, lambda m: m.group(1) + summary + m.group(2), text, flags=re.S)
        if matches != 1:
            raise ValueError("Missing or duplicate park card: " + day)
        optional = len(metrics["stops"]) - core
        pattern = r'(<article\b[^>]*id="%s".*?<span><i>Core / optional</i>).*?(</span>)' % re.escape(day)
        text, matches = re.subn(pattern, lambda m: m.group(1) + "%d / %d" % (core, optional) + m.group(2), text, flags=re.S)
        if matches != 1:
            raise ValueError("Missing or duplicate day totals: " + day)
        for ident, stop in metrics["stops"].items():
            pattern = r'(<li\b[^>]*data-stop-id="%s"[^>]*>\s*<span class="ed-num"[^>]*>).*?(</span>)' % re.escape(ident)
            text, matches = re.subn(pattern, lambda m: m.group(1) + str(stop["n"]) + m.group(2), text, flags=re.S)
            if matches != 1:
                raise ValueError("Missing or duplicate numbered activity: " + ident)
    with open(page, "w", encoding="utf-8", newline="\n") as target:
        target.write(text)


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest()
        raise SystemExit(0)
    data = build()
    if data is None:
        raise SystemExit(1)
    update_park_cards(data)
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    open(OUT, "w", encoding="utf-8", newline="\n").write(
        "/* generated by build-day-metrics.py - do not hand-edit */\n"
        "window.DAY_METRICS=%s;\n"
        "window.DAY_METRICS_META={pathFactor:%s,strideM:%s,"
        "source:'themeparks.wiki entity API'};\n" % (body, PATH_FACTOR, STRIDE_M))
    for k, v in data.items():
        print("%-9s line %4dm  ride/show %4dm  other %4dm  walk %5dm  %6d steps  %2d mapped"
              % (k, v["waitMin"], v["rideShowMin"], v["otherMin"], v["metres"],
                 v["steps"], len(v["route"])))
    print("wrote", OUT)
