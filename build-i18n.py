"""List the page's English strings that i18n-es.js does not translate yet.

Feed it the RENDERED page, so text the scripts generate is included:
  chrome --headless=new --virtual-time-budget=15000 --dump-dom URL > dom.html
  python build-i18n.py dom.html [more.html]          # prints missing strings
  python build-i18n.py dom.html --json out.json      # writes them for translation
  python build-i18n.py dom.html --lang fr            # check i18n-fr.js instead of i18n-es.js
  python build-i18n.py --selftest
Matching mirrors i18n.js: whitespace collapsed, trimmed, exact text."""
import html.parser, json, re, sys

ATTRS = ('aria-label', 'title', 'alt', 'placeholder')
SKIP = {'script', 'style', 'noscript', 'code'}
WORD = re.compile(r'[A-Za-z]{2}')
# Times, counts and names-only stay English; nothing to translate in them.
PLAIN = re.compile(r'^[\d\s:.,·–—\-+~%$/()#&]*(AM|PM|am|pm|min|m|h|mi|°F|F)?[\d\s:.,·–—\-+~%$/()]*$')


def norm(s):
    return re.sub(r'\s+', ' ', s).strip()


def wanted(s):
    return bool(s) and bool(WORD.search(s)) and not PLAIN.match(s)


class Grab(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.skip = {}, 0

    def add(self, s, where):
        s = norm(s)
        if wanted(s):
            self.out.setdefault(s, where)

    def handle_starttag(self, tag, attrs):
        if tag in SKIP:
            self.skip += 1
        for k, v in attrs:
            if k in ATTRS and v:
                self.add(v, '@' + k)

    def handle_endtag(self, tag):
        if tag in SKIP and self.skip:
            self.skip -= 1

    def handle_data(self, data):
        if not self.skip:
            self.add(data, 'text')


def strings(paths):
    g = Grab()
    for p in paths:
        g.feed(open(p, encoding='utf-8').read())
    return g.out


def known(path='i18n-es.js'):
    src = open(path, encoding='utf-8').read()
    body = src[src.index('{'):src.index('}; // end I18N_') + 1]
    return json.loads(body)


def selftest():
    g = Grab()
    g.feed('<p>  Check\n in <b>10:55</b> </p><script>x="Nope"</script>'
           '<i aria-label="Close menu"></i><span>8:30 AM</span><span>45 min</span>')
    assert list(g.out) == ['Check in', 'Close menu'], g.out
    assert norm('\xa0a  b ') == 'a b'
    print('selftest OK')


if __name__ == '__main__':
    a = sys.argv[1:]
    if '--selftest' in a:
        selftest(); sys.exit()
    out = None
    if '--json' in a:
        out = a[a.index('--json') + 1]
        a = [x for x in a if x not in ('--json', out)]
    lang = 'es'
    if '--lang' in a:
        lang = a[a.index('--lang') + 1]
        a = [x for x in a if x not in ('--lang', lang)]
    have = known('i18n-%s.js' % lang)
    miss = {s: w for s, w in strings(a).items() if s not in have}
    if out:
        json.dump(list(miss), open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    else:
        for s in miss:
            print(s)
    print('%d untranslated' % len(miss), file=sys.stderr)
