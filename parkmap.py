#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Turn an Overpass dump into a drawable basemap plus a routable walkway graph.

Two jobs:

  layers(park)  - water, greenery and buildings as polygons, for drawing.
  Graph         - the footpath network, so a route between two attractions
                  follows real walkways instead of cutting through a building.

Routing along the real network also replaces the old straight-line-times-1.35
distance estimate with a measured one.

    python parkmap.py --selftest

Data (c) OpenStreetMap contributors, ODbL.
"""
import heapq
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")

WALKABLE = {"footway", "path", "pedestrian", "steps", "living_street", "service"}

# Nodes within ~1.1 m of each other are the same junction. OSM ways that meet
# at a corner share a node id, but separately-drawn ways sometimes end a
# hair apart, which would leave the graph disconnected.
SNAP_DP = 5


def haversine_m(a, b):
    r = 6371000.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp = p2 - p1
    dl = math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def _key(lat, lon):
    return (round(lat, SNAP_DP), round(lon, SNAP_DP))


def _load_raw(park):
    path = os.path.join(CACHE, "map_%s.json" % park)
    if not os.path.exists(path):
        raise FileNotFoundError(
            "%s missing - run: python fetch-park-maps.py" % path)
    return json.load(open(path, encoding="utf-8"))


def layers(park, simplify_m=3.0):
    """Drawable polygons, biggest first so small detail lands on top."""
    out = []
    for e in _load_raw(park)["elements"]:
        g = e.get("geometry") or []
        if len(g) < 3:
            continue
        t = e.get("tags", {})
        if t.get("natural") == "water" or t.get("waterway"):
            kind = "water"
        elif t.get("landuse") in ("forest", "grass", "meadow", "recreation_ground") \
                or t.get("leisure") in ("park", "garden", "playground"):
            kind = "green"
        elif t.get("building"):
            kind = "build"
        else:
            continue
        pts = _simplify([(p["lat"], p["lon"]) for p in g], simplify_m)
        if len(pts) >= 3:
            out.append({"kind": kind, "pts": pts, "n": len(pts)})
    order = {"green": 0, "water": 1, "build": 2}
    out.sort(key=lambda d: (order[d["kind"]], -d["n"]))
    return out


def paths(park, simplify_m=2.0):
    """Walkway centrelines, for drawing the path network faintly."""
    out = []
    for e in _load_raw(park)["elements"]:
        t = e.get("tags", {})
        if t.get("highway") not in WALKABLE:
            continue
        g = e.get("geometry") or []
        if len(g) < 2:
            continue
        pts = _simplify([(p["lat"], p["lon"]) for p in g], simplify_m)
        if len(pts) >= 2:
            out.append(pts)
    return out


def _simplify(pts, tol_m):
    """Drop points closer together than tol_m. Keeps the file small without
    changing the shape at the zoom these maps are drawn at."""
    if tol_m <= 0 or len(pts) < 3:
        return pts
    keep = [pts[0]]
    for p in pts[1:-1]:
        if haversine_m(keep[-1], p) >= tol_m:
            keep.append(p)
    keep.append(pts[-1])
    return keep


class Graph(object):
    """Undirected walkway graph with haversine edge weights."""

    def __init__(self, park):
        self.adj = {}
        for e in _load_raw(park)["elements"]:
            t = e.get("tags", {})
            if t.get("highway") not in WALKABLE:
                continue
            g = e.get("geometry") or []
            for i in range(len(g) - 1):
                a = _key(g[i]["lat"], g[i]["lon"])
                b = _key(g[i + 1]["lat"], g[i + 1]["lon"])
                if a == b:
                    continue
                w = haversine_m(a, b)
                self.adj.setdefault(a, {})
                self.adj.setdefault(b, {})
                # keep the shorter edge if a pair is drawn twice
                if w < self.adj[a].get(b, float("inf")):
                    self.adj[a][b] = w
                    self.adj[b][a] = w
        self.nodes = list(self.adj)
        self._grid = {}
        for n in self.nodes:
            self._grid.setdefault(self._cell(n), []).append(n)
        self._stitch()
        self.main = self._largest_component()

    def __len__(self):
        return len(self.nodes)

    # Cells are ~110 m of latitude, wide enough that a 15 m search only ever
    # has to look at the cell and its eight neighbours.
    @staticmethod
    def _cell(pt):
        return (int(pt[0] / 0.001), int(pt[1] / 0.001))

    def _near(self, pt, radius_m):
        cx, cy = self._cell(pt)
        out = []
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for n in self._grid.get((cx + dx, cy + dy), ()):
                    d = haversine_m(pt, n)
                    if d <= radius_m:
                        out.append((d, n))
        out.sort()
        return out

    def _stitch(self, gap_m=8.0):
        """OSM ways that visually meet sometimes end a few metres apart without
        sharing a node, which chops the network into islands a router cannot
        cross. Join anything closer than gap_m.

        8 m is deliberately conservative. It closes drawing gaps without
        bridging paths that are genuinely separated - a wider setting starts
        inventing shortcuts across water and over fences, which would make the
        measured distances read shorter than the walk actually is."""
        added = 0
        for a in self.nodes:
            for d, b in self._near(a, gap_m):
                if b == a or b in self.adj[a] or d == 0:
                    continue
                self.adj[a][b] = d
                self.adj[b][a] = d
                added += 1          # each pair is seen once; the reverse
                                    # visit is skipped by the "already
                                    # adjacent" guard above
        self.stitched = added
        return self.stitched

    def _largest_component(self):
        seen, best = set(), set()
        for start in self.nodes:
            if start in seen:
                continue
            stack, comp = [start], set()
            while stack:
                u = stack.pop()
                if u in comp:
                    continue
                comp.add(u)
                stack.extend(v for v in self.adj[u] if v not in comp)
            seen |= comp
            if len(comp) > len(best):
                best = comp
        return best

    def nearest(self, pt, max_m=160.0, main_only=True):
        """Closest graph node to a coordinate. Prefers the main connected
        network: a node on a stranded fragment is useless for routing."""
        for d, n in self._near(pt, max_m):
            if not main_only or n in self.main:
                return n
        return None

    def route(self, a, b):
        """Dijkstra between two graph nodes -> (points, metres), or None."""
        if a == b:
            return [a], 0.0
        dist = {a: 0.0}
        prev = {}
        seen = set()
        q = [(0.0, a)]
        while q:
            d, u = heapq.heappop(q)
            if u in seen:
                continue
            seen.add(u)
            if u == b:
                break
            for v, w in self.adj[u].items():
                nd = d + w
                if nd < dist.get(v, float("inf")):
                    dist[v] = nd
                    prev[v] = u
                    heapq.heappush(q, (nd, v))
        if b not in dist:
            return None
        path, cur = [b], b
        while cur != a:
            cur = prev[cur]
            path.append(cur)
        path.reverse()
        return path, dist[b]


def selftest():
    a, b = (28.0, -81.0), (29.0, -81.0)
    assert 110000 < haversine_m(a, b) < 112000
    assert haversine_m(a, a) == 0.0

    # _simplify keeps the endpoints and drops only the near-duplicates.
    line = [(28.0, -81.0), (28.000001, -81.0), (28.001, -81.0)]
    s = _simplify(line, 3.0)
    assert s[0] == line[0] and s[-1] == line[-1], s
    assert len(s) == 2, s
    assert _simplify(line, 0) == line

    # A hand-built graph routes the long way when the short way is missing.
    g = Graph.__new__(Graph)
    g.adj = {}
    g._grid = {}
    def link(p, q):
        w = haversine_m(p, q)
        g.adj.setdefault(p, {})[q] = w
        g.adj.setdefault(q, {})[p] = w
    A, B, C = (28.0, -81.0), (28.0, -81.001), (28.001, -81.001)
    link(A, B); link(B, C)
    g.nodes = list(g.adj)
    for n in g.nodes:
        g._grid.setdefault(Graph._cell(n), []).append(n)
    g.main = g._largest_component()
    assert g.main == {A, B, C}, g.main
    pts, m = g.route(A, C)
    assert pts == [A, B, C], pts
    assert abs(m - (haversine_m(A, B) + haversine_m(B, C))) < 1e-6
    assert g.route(A, A) == ([A], 0.0)
    # Disconnected node is unreachable, not a crash.
    D = (28.5, -81.5)
    g.adj[D] = {}
    g.nodes.append(D)
    g._grid.setdefault(Graph._cell(D), []).append(D)
    assert g.route(A, D) is None
    # D is stranded, so nearest() refuses it when asked for the main network.
    assert g.nearest(D, max_m=50) is None
    assert g.nearest(D, max_m=50, main_only=False) == D
    # nearest() respects its radius.
    assert g.nearest((28.0, -81.0000001)) == A
    assert g.nearest((28.9, -81.9), max_m=50) is None
    # _stitch joins a node dropped just short of an existing one.
    E = (28.0, -81.00009)          # ~9 m from A
    g.adj[E] = {}
    g.nodes.append(E)
    g._grid.setdefault(Graph._cell(E), []).append(E)
    assert g._stitch(14.0) >= 1
    assert E in g.adj[A] and A in g.adj[E]
    print("parkmap selftest OK")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest()
        raise SystemExit(0)
    for p in ("ak", "hs", "mk", "usf", "eu"):
        try:
            g = Graph(p)
            print("%-4s graph %5d nodes  main %5d  stitched %4d  layers %4d  paths %4d"
                  % (p, len(g), len(g.main), g.stitched, len(layers(p)), len(paths(p))))
        except FileNotFoundError as e:
            print("%-4s %s" % (p, e))
