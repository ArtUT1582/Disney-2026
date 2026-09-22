#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Build day-metrics.js: per-stop wait/experience minutes and a GPS route trace.

Coordinates come from the public themeparks.wiki entity API (cached in
cache/*.json). Distances are straight-line haversine multiplied by a walkway
factor, because park paths are not straight lines.

    python build-day-metrics.py            # rebuild day-metrics.js
    python build-day-metrics.py --selftest # check the maths

ponytail: one script, one generated file. The stop tables below are hand-kept
on purpose -- there is no machine-readable source for "which stop is which
attraction", and a wrong guess is worse than a hand-written line.
"""
import json
import math
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")
OUT = os.path.join(HERE, "day-metrics.js")

# Walkways wind; a straight line between two attractions understates the walk.
# 1.35 is the usual planning factor for theme-park path distance.
PATH_FACTOR = 1.35
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
    "eu": (28.41060, -81.44380),    # Epic Universe entry portal
}

# stop number -> (wait minutes, experience minutes, kind, map anchor)
# kind: ride show meet meal walk transit app rest
# anchor: entity name in that park's API, or None (no map point).
# Transit legs (bus, Skyliner, car service) carry no anchor on purpose: the
# step count measures feet on park pavement, not miles covered in a vehicle.
# A leading "~" on the anchor means the stop is an alternative and is excluded
# from the day totals so nothing is double counted.
DAYS = {
    "day-ak": {
        "park": "ak", "label": "Animal Kingdom", "date": "Mon 12 Oct",
        "stops": {
            1:  (0, 55, "transit", None),
            2:  (0, 5,  "app", None),
            3:  (10, 5, "ride", "Na'vi River Journey"),
            4:  (20, 18, "ride", "Kilimanjaro Safaris"),
            5:  (0, 25, "walk", "Gorilla Falls Exploration Trail"),
            6:  (20, 45, "ride", "Bluey's Wild World at Conservation Station"),
            7:  (20, 8,  "meet", "Meet Favorite Disney Pals at Adventurers Outpost"),
            8:  (15, 13, "show", "Zootopia: Better Zoogether!"),
            9:  (10, 45, "meal", "Satu'li Canteen"),
            10: (20, 5,  "ride", "Avatar Flight of Passage"),
            11: (25, 30, "show", "Festival of the Lion King"),
            12: (25, 28, "walk", "Maharajah Jungle Trek"),
            13: (0, 30,  "walk", "Na'vi River Journey"),
            14: (0, 25,  "walk", "Discovery Island Trails"),
            15: (0, 20,  "walk", "The Oasis Exhibits"),
        },
    },
    "day-hs": {
        "park": "hs", "label": "Hollywood Studios", "date": "Tue 13 Oct",
        "stops": {
            1:  (0, 5,  "app", None),
            2:  (0, 45, "transit", None),
            3:  (20, 2, "ride", "Slinky Dog Dash"),
            4:  (40, 8, "ride", "Alien Swirling Saucers"),
            5:  (25, 10, "meet", "Meet the Toys in Toy Story Land"),
            6:  (15, 5, "ride", "Millennium Falcon: Smugglers Run"),
            7:  (10, 45, "meal", "Docking Bay 7 Food and Cargo"),
            8:  (20, 18, "ride", "Star Wars: Rise of the Resistance"),
            9:  (15, 5, "ride", "Mickey & Minnie's Runaway Railway"),
            10: (20, 22, "show", "Disney Jr. Mickey Mouse Clubhouse Live!"),
            11: (25, 30, "show", "For the First Time in Forever: A Frozen Sing-Along Celebration"),
            12: (45, 7, "ride", "The Twilight Zone™ Tower of Terror"),
            13: (0, 60, "rest", None),
            14: (15, 45, "meal", "Woody's Lunch Box"),
            15: (0, 40, "walk", "Oga's Cantina"),
            16: (45, 26, "show", "Fantasmic!"),
            17: (0, 35, "transit", None),
        },
    },
    "day-mk": {
        "park": "mk", "label": "Magic Kingdom", "date": "Wed 14 Oct",
        "stops": {
            1:  (0, 70, "transit", None),
            2:  (0, 5,  "app", None),
            3:  (20, 3, "ride", "Peter Pan's Flight"),
            4:  (20, 3, "ride", "Seven Dwarfs Mine Train"),
            5:  (20, 3, "ride", "Dumbo the Flying Elephant"),
            6:  (30, 12, "meet", "Meet Princess Tiana and a Visiting Princess at Princess Fairytale Hall"),
            7:  (10, 10, "walk", "Cinderella Castle"),
            8:  (15, 90, "meal", "Cinderella's Royal Table"),
            9:  (15, 60, "meal", "~Columbia Harbour House"),
            10: (20, 20, "show", "Enchanted Tales with Belle"),
            11: (0, 45, "rest", "Columbia Harbour House"),
            12: (20, 11, "ride", "Tiana's Bayou Adventure"),
            13: (15, 4, "ride", "Big Thunder Mountain Railroad"),
            14: (10, 90, "meet", "Prince Charming Regal Carrousel"),
            15: (10, 20, "walk", "Cinderella Castle"),
            16: (15, 45, "meal", "Pinocchio Village Haus"),
            17: (25, 10, "ride", "Jungle Cruise"),
            18: (20, 12, "ride", "~Tomorrowland Transit Authority PeopleMover"),
            19: (30, 0, "walk", "Casey's Corner"),
            20: (0, 18, "show", "Happily Ever After"),
            21: (0, 40, "transit", None),
        },
    },
    "day-hhn": {
        "park": "usf", "label": "HHN 35", "date": "Thu 15 Oct",
        "stops": {
            1:  (15, 75, "meal", None),
            2:  (0, 150, "rest", None),
            3:  (0, 15, "rest", None),
            4:  (0, 35, "transit", None),
            5:  (25, 5, "transit", None),
            6:  (25, 0, "walk", "Infernal Carnival of Nightmares"),
            7:  (25, 6, "show", "Stranger Things 5"),
            8:  (20, 5, "show", "Hellraiser"),
            9:  (20, 5, "show", "Jack & Oddfellow: Chaos & Control"),
            10: (15, 40, "meal", "Louie's Italian Restaurant™"),
            11: (20, 5, "show", "Sinners"),
            12: (20, 5, "show", "Ozzy Osbourne: Prince of Darkness"),
            13: (20, 5, "show", "Evil Dead Burn"),
            14: (20, 12, "show", "Stranger Things: Return to Hawkins"),
            15: (20, 5, "show", "H.R. Bloodengutz Presents: A Halloween Fright-Tacular!"),
            16: (20, 5, "show", "Cybergoria"),
            17: (0, 45, "walk", "Infernal Carnival of Nightmares"),
            18: (20, 5, "show", "MADLANDS: Caged Cannibals"),
            19: (20, 5, "show", "INVASION: Alien Abduction"),
            20: (15, 25, "show", "Nightmare Fuel: Blood Noir"),
            21: (0, 45, "transit", None),
        },
    },
    "day-eu": {
        "park": "eu", "label": "Epic Universe", "date": "Fri 16 Oct",
        "stops": {
            1:  (0, 10, "app", None),
            2:  (0, 60, "transit", None),
            3:  (20, 5, "ride", "Mario Kart™: Bowser's Challenge"),
            4:  (15, 5, "ride", "Yoshi's Adventure™"),
            5:  (25, 3, "ride", "Mine-Cart Madness™"),
            6:  (0, 45, "walk", "Bowser Jr. Challenge"),
            7:  (25, 45, "meal", "Toadstool Cafe™"),
            8:  (15, 2, "ride", "Curse of the Werewolf"),
            9:  (15, 6, "ride", "Monsters Unchained: The Frankenstein Experiment"),
            10: (15, 2, "ride", "Hiccup's Wing Gliders"),
            11: (30, 2, "ride", "Dragon Racer's Rally"),
            12: (35, 6, "meet", "Meet Toothless and Friends"),
            13: (25, 6, "ride", "Harry Potter and the Battle at the Ministry™"),
            14: (15, 25, "meal", "Le Gobelet Noir™"),
            15: (0, 30, "walk", "Le Cirque Arcanus™"),
            16: (15, 45, "meal", "The Oak & Star Tavern"),
            17: (15, 3, "ride", "Constellation Carousel"),
            18: (20, 2, "ride", "Stardust Racers"),
            19: (0, 20, "walk", "The Cosmos Fountain"),
            20: (0, 25, "walk", "~Meet Mario and Luigi"),
            21: (0, 55, "transit", None),
        },
    },
}


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


def build():
    result = {}
    missing = []
    for day_id, day in DAYS.items():
        coords = load_park(day["park"])
        gate = GATES[day["park"]]
        stops = []
        for n in sorted(day["stops"]):
            wait, exp, kind, anchor = day["stops"][n]
            alt = bool(anchor and anchor.startswith("~"))
            name = anchor[1:] if alt else anchor
            if name == "GATE":
                pt = gate
            elif name:
                pt = coords.get(name)
                if pt is None:
                    missing.append("%s #%d: %s" % (day_id, n, name))
            else:
                pt = None
            stops.append({"n": n, "w": wait, "e": exp, "k": kind,
                          "alt": alt, "pt": pt})

        # Route: the mappable stops in order, with cumulative walking distance.
        route, prev, total_m = [], None, 0.0
        for s in stops:
            if not s["pt"] or s["alt"]:
                continue
            leg = walk_m(prev, s["pt"]) if prev else 0.0
            total_m += leg
            route.append({"n": s["n"], "lat": round(s["pt"][0], 6),
                          "lon": round(s["pt"][1], 6),
                          "leg": int(round(leg)), "cum": int(round(total_m))})
            prev = s["pt"]

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
            "stops": {str(s["n"]): {"w": s["w"], "e": s["e"], "k": s["k"],
                                    "alt": s["alt"]} for s in stops},
            "route": route,
        }

    if missing:
        print("UNMATCHED ANCHORS (fix the name in DAYS):", file=sys.stderr)
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


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest()
        raise SystemExit(0)
    data = build()
    if data is None:
        raise SystemExit(1)
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
