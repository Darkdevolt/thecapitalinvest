#!/usr/bin/env python3
"""
Lecture automatique des Bulletins Officiels de la Cote (BOC) de la BRVM.

Le BOC du jour (bfin.brvm.org/boc/boc_jour.aspx) reproduit en annexe les
publications des émetteurs : rapports d'activités, états financiers
semestriels / annuels… La plupart de ces pages sont des scans : on lit le
texte quand il existe, sinon on passe l'image à l'OCR (RapidOCR).

Ce script ne fait QUE repérer les tableaux de résultats et en extraire les
valeurs brutes (par colonne datée). Il n'écrit rien en base : il envoie ses
candidats à l'API (/api/process-brvm, scope « boc_extract »), qui décide —
unité, recoupement avec l'exercice précédent déjà en base, statut
« validé » / « à vérifier » — et insère sans jamais écraser.

Authentification : jeton OIDC GitHub Actions (aucun secret à stocker).

Usage :
  python3 scripts/boc_extract.py                  # BOC en attente (GitHub Actions)
  python3 scripts/boc_extract.py --pdf f.pdf --date 2026-09-24 --dry-run
"""
import argparse
import json
import os
import re
import sys
import tempfile
import time
import unicodedata
import urllib.request

API_URL = os.environ.get('TC_API_URL', 'https://thecapitalinvest.vercel.app/api/process-brvm')
AUDIENCE = 'thecapitalinvest-boc'

# Libellés (forme compacte : minuscules, sans accents, lettres seules).
LABELS = {
    'chiffre_affaires': ['produitnetbancaire', 'chiffredaffaires', 'chiffresdaffaires',
                         'produitsdesactivitesordinaires', 'revenusdesactivitesordinaires'],
    'rbe': ['resultatbrutdexploitation', 'excedentbrutdexploitation'],
    'resultat_exploitation': ['resultatdexploitation'],
    'resultat_activites_ordinaires': ['resultatdesactivitesordinaires'],
    'resultat_net': ['resultatnet', 'beneficenet'],
    'total_actif': ['totalactif', 'totaldelactif', 'totalbilan', 'totaldubilan'],
    'capitaux_propres': ['capitauxpropres'],
}
# Un libellé précédé de ces mots n'est pas l'agrégat lui-même.
LABEL_EXCLUDE = ('variation', 'evolution', 'part', 'hors', 'avant', 'impot', 'taux', 'marge')

MONTHS = {'janv': 1, 'jan': 1, 'fevr': 2, 'fev': 2, 'mars': 3, 'mar': 3, 'avr': 4, 'mai': 5,
          'juin': 6, 'juil': 7, 'aout': 8, 'sept': 9, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12}


def compact(s):
    s = unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z]', '', s)


def parse_num(t):
    """« 1 318,3 » -> 1318.3 ; « (4 525) » / « -4 525 » -> -4525 ; sinon None."""
    s = str(t).strip().replace('−', '-').replace('–', '-').replace(' ', ' ')
    if '%' in s or '/' in s or re.search(r'[A-Za-z_]', s):
        return None
    neg = s.startswith('(') and s.endswith(')')
    s = s.strip('()').replace(' ', '').replace('+', '')
    if s.startswith('-'):
        neg, s = True, s[1:]
    if not re.fullmatch(r'\d{1,3}(?:[. ]\d{3})+(?:,\d+)?|\d+(?:,\d+)?', s):
        return None
    s = s.replace('.', '').replace(' ', '').replace(',', '.')
    v = float(s)
    return -v if neg else v


def column_date(text):
    """Date d'une en-tête de colonne -> (année, mois|None)."""
    t = str(text).lower()
    m = re.search(r'(\d{1,2})[/.-](\d{1,2})[/.-](20\d{2})', t)
    if m:
        return int(m.group(3)), int(m.group(2))
    m = re.search(r'(janv|jan|fevr|fev|févr|fév|mars|mar|avr|mai|juin|juil|aout|août|sept|sep|oct|nov|dec|déc)[a-zéû]*\.?[\s-]*(20\d{2}|\d{2})\b', t)
    if m:
        k = compact(m.group(1))
        y = int(m.group(2))
        return (y if y > 1900 else 2000 + y), MONTHS.get(k[:4], MONTHS.get(k[:3]))
    m = re.fullmatch(r'\s*(?:exercice\s*|au\s*)?(20[12]\d)\s*', t)
    if m:
        return int(m.group(1)), None
    return None


# ── Lecture d'une page : liste d'éléments (x0, y0, x1, y1, texte) ──────────

def page_items_text(page):
    words = page.get_text('words')  # x0, y0, x1, y1, word, block, line, wno
    items = []
    # Regroupe les mots d'une même ligne de texte (bloc, ligne) en segments,
    # coupés sur les grands blancs : « 1 318,3 » reste un seul nombre.
    lines = {}
    for w in words:
        lines.setdefault((w[5], w[6]), []).append(w)
    for ws in lines.values():
        ws.sort(key=lambda w: w[0])
        seg = [ws[0]]
        for w in ws[1:]:
            gap = w[0] - seg[-1][2]
            h = seg[-1][3] - seg[-1][1]
            if gap > h * 0.9:
                items.append(_merge(seg))
                seg = [w]
            else:
                seg.append(w)
        items.append(_merge(seg))
    return items


def _merge(seg):
    return (seg[0][0], min(w[1] for w in seg), seg[-1][2], max(w[3] for w in seg), ' '.join(w[4] for w in seg))


_ocr = None


def page_items_ocr(page, dpi=170):
    global _ocr
    if _ocr is None:
        from rapidocr_onnxruntime import RapidOCR
        _ocr = RapidOCR()
    fd, path = tempfile.mkstemp(suffix='.png')
    os.close(fd)
    try:
        page.get_pixmap(dpi=dpi).save(path)
        res, _ = _ocr(path)
    finally:
        os.unlink(path)
    items = []
    for box, text, _score in res or []:
        xs = [p[0] for p in box]
        ys = [p[1] for p in box]
        items.append((min(xs), min(ys), max(xs), max(ys), text))
    return items


def split_numeric_tokens(items):
    """Un élément OCR « 30171 38124 » ou « 823 897 768 574 » est découpé en nombres."""
    out = []
    for x0, y0, x1, y1, t in items:
        if parse_num(t) is not None or not re.fullmatch(r'[\d\s,.()+\-−]+', t.strip()):
            out.append((x0, y0, x1, y1, t))
            continue
        parts = re.findall(r'[(\-−]?\d{1,3}(?:[  ]\d{3})*(?:,\d+)?\)?', t)
        if len(parts) <= 1:
            out.append((x0, y0, x1, y1, t))
            continue
        w = (x1 - x0) / max(1, len(t))
        pos = 0
        for p in parts:
            i = t.find(p, pos)
            pos = i + len(p)
            out.append((x0 + i * w, y0, x0 + pos * w, y1, p))
    return out


# ── Analyse d'une page ─────────────────────────────────────────────────────

def find_label(text):
    c = compact(text)
    for field, pats in LABELS.items():
        for p in pats:
            i = c.find(p)
            if i < 0 or i > 12:
                continue
            if any(e in c[:i] for e in LABEL_EXCLUDE):
                continue
            # « résultat net » ne doit pas capter « résultat net bancaire » etc.
            if field == 'resultat_exploitation' and 'brut' in c[:i + 10]:
                continue
            return field
    return None


def estimate_offset(items, nums):
    """Scan légèrement penché : les chiffres (à droite) sont décalés en hauteur
    par rapport aux libellés (à gauche). On cherche le décalage vertical qui
    aligne au mieux les libellés sur les lignes de chiffres."""
    if len(nums) < 6:
        return 0.0
    num_x = sorted((it[0] + it[2]) / 2 for it, _ in nums)
    x_split = num_x[len(num_x) // 4]
    labels = [((it[1] + it[3]) / 2, it[3] - it[1]) for it in items
              if parse_num(it[4]) is None and len(compact(it[4])) >= 6 and it[2] < x_split]
    ys = sorted((it[1] + it[3]) / 2 for it, _ in nums)
    if len(labels) < 4:
        return 0.0
    import bisect

    def cost(d):
        tot = 0.0
        for yc, h in labels:
            y = yc + d
            i = bisect.bisect_left(ys, y)
            best = min(abs(ys[j] - y) for j in (i - 1, i) if 0 <= j < len(ys))
            tot += min(best, h * 0.6)
        return tot

    span = max(h for _, h in labels) * 1.2
    steps = [k * 0.5 for k in range(int(-span * 2), int(span * 2) + 1)]
    best = min(steps, key=lambda d: (cost(d), abs(d)))
    return best if cost(best) < cost(0.0) * 0.8 else 0.0


def analyse_page(items, page_text):
    items = split_numeric_tokens(items)
    # Colonnes datées : en-têtes reconnues comme dates, rangées par x.
    cols = []
    for x0, y0, x1, y1, t in items:
        d = column_date(t)
        if d and len(t) <= 24:
            cols.append({'x': (x0 + x1) / 2, 'y': (y0 + y1) / 2, 'year': d[0], 'month': d[1], 'text': t.strip()})
    labels = []
    for it in items:
        f = find_label(it[4])
        if f and parse_num(it[4]) is None:
            labels.append((f, it))
    fields = {f for f, _ in labels}
    # Une page de bilan ne porte souvent qu'un agrégat (total actif, ou
    # capitaux propres côté passif) : acceptée si ses colonnes sont datées.
    single_ok = fields & {'total_actif', 'capitaux_propres'} and len({(c['year'], c['month']) for c in cols}) >= 2
    if len(fields) < 2 and not single_ok:
        return None
    nums = [(it, parse_num(it[4])) for it in items]
    nums = [(it, v) for it, v in nums if v is not None]
    offset = estimate_offset(items, nums)
    out = {}
    for field, (lx0, ly0, lx1, ly1, lt) in labels:
        if field in out:
            continue
        yc, h = (ly0 + ly1) / 2 + offset, max(4.0, ly1 - ly0)
        row = [(it, v) for it, v in nums
               if it[0] > lx1 - 2 and abs((it[1] + it[3]) / 2 - yc) < h * 0.7]
        # OCR : les chiffres d'une ligne sont parfois légèrement décalés en
        # hauteur — on élargit la bande si rien n'est trouvé.
        if not row:
            row = [(it, v) for it, v in nums
                   if it[0] > lx1 - 2 and abs((it[1] + it[3]) / 2 - yc) < h * 1.3]
        if not row:
            continue
        vals = []
        for it, v in row:
            xc = (it[0] + it[2]) / 2
            dy = abs((it[1] + it[3]) / 2 - yc)
            col = None
            cx = None
            if cols:
                # En-tête la plus proche, au-dessus de la ligne.
                above = [c for c in cols if c['y'] < yc + 2]
                if above:
                    c = min(above, key=lambda c: abs(c['x'] - xc))
                    if abs(c['x'] - xc) < 140:
                        col = (c['year'], c['month'])
                        cx = abs(c['x'] - xc)
            vals.append({'x': round(xc, 1), 'v': v, 'col': col, 'dy': dy, 'cx': cx if col else None})
        # Lignes serrées : une seule valeur par colonne, la plus proche du
        # libellé en hauteur ; sans en-tête, la « ligne » la plus proche.
        best = {}
        loose = []
        for d in vals:
            if d['col']:
                k = tuple(d['col'])
                cur = best.get(k)
                if cur is None:
                    best[k] = d
                elif abs(d['dy'] - cur['dy']) > h * 0.4:
                    if d['dy'] < cur['dy']:
                        best[k] = d
                elif d['cx'] < cur['cx']:
                    best[k] = d
            else:
                loose.append(d)
        if loose:
            m = min(d['dy'] for d in loose)
            loose = [d for d in loose if d['dy'] <= m + h * 0.4]
        vals = sorted(list(best.values()) + loose, key=lambda d: d['x'])
        for d in vals:
            d.pop('cx', None)
            d['dy'] = round(d['dy'], 1)
            if d['col']:
                d['col'] = list(d['col'])
        out[field] = {'label': lt.strip()[:80], 'values': vals}
    if len(out) < 2 and not (single_ok and out):
        return None
    c = compact(page_text)
    unit = None
    hits = []
    for key, mult in (('milliardsdefcfa', 1e9), ('milliardsfcfa', 1e9), ('enmilliards', 1e9), ('mdfcfa', 1e9),
                      ('millionsdefcfa', 1e6), ('millionsfcfa', 1e6), ('enmillions', 1e6), ('mfcfa', 1e6), ('mfca', 1e6),
                      ('milliersdefcfa', 1e3), ('enmilliers', 1e3), ('kfcfa', 1e3)):
        i = c.find(key)
        if i >= 0:
            hits.append((i, mult))
    if hits:
        unit = min(hits)[1]
    if unit is None and 'fcfa' in c:
        unit = 1
    period = None
    if 'semestre' in c or 'semestriel' in c:
        period = 'S1'
    elif re.search(r'(premier|1er)trimestre', c):
        period = 'Q1'
    elif re.search(r'(troisieme|3eme|3e)trimestre|neufmois|9mois', c):
        period = '9M'
    elif 'exercice' in c or 'annuel' in c:
        period = 'annuel'
    uniq_cols = sorted({(c_['year'], c_['month']) for c_ in cols}, key=lambda k: (k[0], k[1] or 12))
    return {'indicators': out, 'columns': [list(k) for k in uniq_cols], 'unit_guess': unit, 'period_guess': period}


def read_boc(pdf_path, log=print, cache=None):
    import pymupdf
    doc = pymupdf.open(pdf_path)
    memo = {}
    if cache and os.path.exists(cache):
        memo = json.load(open(cache))
    pages = []
    scanned = 0
    for i, page in enumerate(doc):
        text = page.get_text()
        if len(text.strip()) >= 40:
            items = page_items_text(page)
            src = 'texte'
        else:
            # Les premières pages (cotations) sont toujours du texte : une page
            # vide y est une page blanche, inutile de l'OCRiser.
            if i < 2:
                continue
            items = memo.get(str(i + 1)) or page_items_ocr(page)
            memo[str(i + 1)] = items
            text = ' '.join(it[4] for it in items)
            src = 'ocr'
            scanned += 1
        pages.append({'page': i + 1, 'text': text, 'items': items, 'source': src})
    if cache:
        json.dump(memo, open(cache, 'w'))
    log(f'{len(doc)} pages, {scanned} scannées (OCR)')
    return pages, len(doc), scanned


def extract_candidates(pages):
    cands = []
    for k, p in enumerate(pages):
        a = analyse_page(p['items'], p['text'])
        if not a:
            continue
        # Contexte pour l'émetteur : pages voisines, de la plus proche à la
        # plus lointaine (page de garde, avis BRVM, commentaires qui suivent).
        ctx = []
        for off in (-1, 1, -2, 2, -3, -4):
            j = k + off
            if 0 <= j < len(pages):
                ctx.append({'offset': off, 'text': pages[j]['text'][:4000]})
        a.update({'page': p['page'], 'source': p['source'], 'page_text': p['text'][:4000], 'context': ctx})
        cands.append(a)
    return cands


# ── Échanges avec l'API ────────────────────────────────────────────────────

def oidc_token():
    url = os.environ.get('ACTIONS_ID_TOKEN_REQUEST_URL')
    tok = os.environ.get('ACTIONS_ID_TOKEN_REQUEST_TOKEN')
    if not url or not tok:
        raise SystemExit('Jeton OIDC indisponible (à lancer depuis GitHub Actions avec id-token: write).')
    req = urllib.request.Request(f'{url}&audience={AUDIENCE}', headers={'Authorization': f'bearer {tok}'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)['value']


def api(payload, timeout=90):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(API_URL, data=body, method='POST', headers={
        'Content-Type': 'application/json', 'Authorization': f'Bearer {oidc_token()}'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        raise SystemExit(f'API {e.code} : {e.read()[:500]!r}')


def download(url, path):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 TheCapitalInvest BOC'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=180) as r, open(path, 'wb') as f:
                f.write(r.read())
            return
        except Exception as e:  # noqa: BLE001
            if attempt == 2:
                raise
            print(f'téléchargement {url} : {e} — nouvel essai', file=sys.stderr)
            time.sleep(5 * (attempt + 1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pdf')
    ap.add_argument('--date')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--check', action='store_true', help='indique seulement s\'il y a des BOC à analyser')
    ap.add_argument('--out')
    ap.add_argument('--ocr-cache', help='développement : réutilise l\'OCR déjà fait')
    args = ap.parse_args()

    if args.pdf:
        jobs = [{'date_seance': args.date, 'pdf': args.pdf, 'fichier_url': None}]
    else:
        pending = api({'scope': 'boc_extract', 'action': 'pending'})
        jobs = pending.get('pending', [])
        print(f'{len(jobs)} BOC à analyser : {[j["date_seance"] for j in jobs]}')
        if args.check:
            out = os.environ.get('GITHUB_OUTPUT')
            if out:
                with open(out, 'a') as f:
                    f.write(f'pending={len(jobs)}\n')
            return

    for job in jobs:
        t0 = time.time()
        pdf = job.get('pdf')
        if not pdf:
            fd, pdf = tempfile.mkstemp(suffix='.pdf')
            os.close(fd)
            download(job['fichier_url'], pdf)
        pages, total, scanned = read_boc(pdf, cache=args.ocr_cache)
        cands = extract_candidates(pages)
        print(f"BOC {job['date_seance']} : {len(cands)} tableau(x) de résultats repéré(s) "
              f"({time.time() - t0:.0f} s)")
        for c in cands:
            print(f"  p.{c['page']} [{c['source']}] colonnes={c['columns']} unité={c['unit_guess']} "
                  f"période={c['period_guess']} : " +
                  ', '.join(f"{k}={[v['v'] for v in d['values']]}" for k, d in c['indicators'].items()))
        cands = cands[:60]
        payload = {'scope': 'boc_extract', 'action': 'ingest', 'date_seance': job['date_seance'],
                   'pages_total': total, 'pages_scanned': scanned, 'candidates': cands}
        if args.out:
            json.dump(payload, open(args.out, 'w'), ensure_ascii=False, indent=1)
        if args.dry_run:
            continue
        res = api(payload, timeout=120)
        print(json.dumps(res, ensure_ascii=False, indent=1)[:4000])


if __name__ == '__main__':
    main()
