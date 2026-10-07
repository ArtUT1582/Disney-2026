"""Regression checks for schedule anchors, stable activity data and local links.
Run with Python; standard library only. Estimates remain planning assumptions.
"""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import importlib.util
import json
import re
import unittest

ROOT = Path(__file__).resolve().parent

class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.stops, self.ids, self.links = {}, [], []
        self.day, self.lists, self.main = None, [], 0
        self.invalid_list = []
        self.feed(text)

    def handle_starttag(self, tag, items):
        attrs = dict(items)
        if attrs.get('id'): self.ids.append(attrs['id'])
        if tag == 'main': self.main += 1
        if tag == 'article' and attrs.get('id', '').startswith('day-'):
            self.day = attrs['id']
            self.stops[self.day] = []
        if tag == 'li' and 'ed-ev' in attrs.get('class', '').split():
            self.stops[self.day].append(attrs)
        if tag == 'h3' and self.lists: self.invalid_list.append(self.day)
        if tag in ('ol', 'ul'): self.lists.append(tag)
        for attr in ('href', 'src'):
            if attrs.get(attr): self.links.append(attrs[attr])

    def handle_endtag(self, tag):
        if tag == 'article': self.day = None
        if tag in ('ol', 'ul') and self.lists: self.lists.pop()

class ItineraryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.page = Page((ROOT / 'index.html').read_text(encoding='utf8'))
        raw = (ROOT / 'day-metrics.js').read_text(encoding='utf8')
        cls.metrics = json.loads(raw.split('window.DAY_METRICS=', 1)[1].split(';\n', 1)[0])

    def test_stable_mapping_and_optional_exclusion(self):
        for day, stops in self.page.stops.items():
            metrics = self.metrics[day]
            self.assertEqual(set(metrics['stops']), {s['data-stop-id'] for s in stops})
            core = []
            for order, stop in enumerate(stops, 1):
                data = metrics['stops'][stop['data-stop-id']]
                self.assertEqual((data['n'], data['w'], data['e'], data['k'], data['alt']),
                    (order, int(stop['data-wait']), int(stop['data-experience']),
                     stop['data-kind'], stop['data-optional'] == 'true'))
                if not data['alt']: core.append(data)
            self.assertEqual(metrics['waitMin'], sum(s['w'] for s in core))
            self.assertEqual(metrics['expMin'], sum(s['e'] for s in core))
            self.assertTrue(all(not metrics['stops'][p['id']]['alt'] for p in metrics['route']))

    def test_core_clock_blocks_do_not_overlap(self):
        for day, stops in self.page.stops.items():
            previous_end = None
            previous_id = None
            for stop in stops:
                if stop['data-optional'] == 'true' or 'data-start' not in stop: continue
                start = int(stop['data-start'])
                if previous_end is not None:
                    self.assertGreaterEqual(start, previous_end, (day, previous_id, stop['data-stop-id']))
                previous_end = start + int(stop['data-wait']) + int(stop['data-experience'])
                previous_id = stop['data-stop-id']

    def test_booked_windows_and_arrival_before_show(self):
        by_id = {s['data-stop-id']: s for stops in self.page.stops.values() for s in stops}
        windows = {'ak-lionking':(570,590),'ak-safaris':(645,705),'ak-navi':(810,870),
                   'hs-tower':(695,755),'hs-mania':(840,900),'hs-slinky':(950,1010),
                   'mk-haunted':(490,550),'mk-jungle':(555,615),'mk-pirates':(615,675)}
        for ident,(first,last) in windows.items():
            self.assertLessEqual(first,int(by_id[ident]['data-start']))
            self.assertLessEqual(int(by_id[ident]['data-start']),last)
        self.assertEqual(int(by_id['ak-lionking']['data-start']) + int(by_id['ak-lionking']['data-wait']), 600)
        self.assertEqual(int(by_id['hs-fantasmic']['data-start']) + int(by_id['hs-fantasmic']['data-wait']), 1200)
        self.assertEqual(int(by_id['mk-castle']['data-start']) + int(by_id['mk-castle']['data-wait']), 675)
        self.assertEqual(int(by_id['mk-boutique']['data-start']) + int(by_id['mk-boutique']['data-wait']), 1000)

    def test_landmarks_lists_ids_and_local_files(self):
        self.assertEqual(self.page.main,1)
        self.assertEqual(len(self.page.ids),len(set(self.page.ids)))
        self.assertFalse(self.page.invalid_list)
        missing=[]
        for link in self.page.links:
            parsed=urlsplit(link)
            if parsed.scheme or parsed.netloc or not parsed.path: continue
            if not (ROOT / unquote(parsed.path)).exists(): missing.append(link)
        self.assertFalse(missing,missing)
        self.assertIn('boutique.ics',self.page.links)

    def test_calendar_times(self):
        self.assertIn('DTSTART:20261014T151500Z',(ROOT/'cinderellas-royal-table.ics').read_text())
        self.assertIn('DTSTART:20261014T204000Z',(ROOT/'boutique.ics').read_text())

    def test_park_cards_match_core_metrics(self):
        text = (ROOT/'index.html').read_text(encoding='utf8')
        for day, metrics in self.metrics.items():
            core = sum(not stop['alt'] for stop in metrics['stops'].values())
            self.assertIn('<span class="pk-meta">%d core stops</span>' % core,text)
            for ident, stop in metrics['stops'].items():
                pattern = r'<li\b[^>]*data-stop-id="%s"[^>]*>\s*<span class="ed-num"[^>]*>(\d+)</span>' % re.escape(ident)
                self.assertEqual(int(re.search(pattern,text).group(1)),stop['n'])

    def test_parser_reordering_keeps_identity(self):
        spec=importlib.util.spec_from_file_location('metrics_builder', ROOT/'build-day-metrics.py')
        module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        parser=module.ItineraryParser()
        parser.feed('<article id="day-eu"><li class="ed-ev" data-stop-id="lunch" data-wait="20" data-experience="50" data-kind="meal" data-optional="false"></li><li class="ed-ev" data-stop-id="ride" data-wait="10" data-experience="5" data-kind="ride" data-optional="true"></li></article>')
        self.assertEqual(parser.days['day-eu']['stops']['lunch']['k'],'meal')
        self.assertEqual(parser.days['day-eu']['stops']['ride']['e'],5)
        with self.assertRaises(ValueError):
            parser.feed('<article id="day-ak"><li class="ed-ev" data-stop-id="ride" data-wait="0" data-experience="0" data-kind="walk" data-optional="false">')

    def test_gate_anchors_stay_inside_the_park_mapping_bounds(self):
        spec=importlib.util.spec_from_file_location('metrics_builder',ROOT/'build-day-metrics.py')
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        spec=importlib.util.spec_from_file_location('map_fetcher',ROOT/'fetch-park-maps.py')
        maps=importlib.util.module_from_spec(spec);spec.loader.exec_module(maps)
        for park,(lat,lon) in module.GATES.items():
            south,west,north,east=maps.BBOX[park]
            self.assertTrue(south<=lat<=north and west<=lon<=east,(park,lat,lon))

if __name__ == '__main__': unittest.main()
