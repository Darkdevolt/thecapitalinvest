#!/usr/bin/env python3
"""
Lecture du tableau des obligations du BOC (Bulletin Officiel de la Cote).

Pour chaque ligne du marché obligataire (obligations d'États, d'institutions
régionales, d'entreprises, GSS, FCTC, sukuk), le BOC publie à chaque séance :
valeur nominale restante (capital restant dû par titre), cours précédent /
du jour / de référence, volume et valeur échangés, coupon couru, périodicité
des coupons (A/S/T), montant net du prochain coupon, date de ce coupon et type
d'amortissement (IF, AC, AD, ACD).

Ces pages sont du texte (pas de scan) : chaque cellule est une ligne de texte,
dans l'ordre des colonnes. Une ligne commence par le symbole (ex. « TPCI.O64 »).

Usage autonome :  python3 scripts/boc_bonds.py BOC.pdf [--json]
"""
import json
import re
import sys
import unicodedata

SYMBOL = re.compile(r'^[A-Z][A-Z0-9_]{1,14}\.[OS]\d{1,3}$')
PERIODS = {'A': 1, 'S': 2, 'T': 4, 'M': 12}
AMORT = {'IF', 'AC', 'AD', 'ACD'}
MONTHS = {'janv': 1, 'jan': 1, 'fevr': 2, 'fev': 2, 'mars': 3, 'mar': 3, 'avr': 4, 'mai': 5, 'juin': 6,
          'juil': 7, 'aout': 8, 'sept': 9, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12}
DATE = re.compile(r'^(\d{1,2})-([a-zéèêûô]+)\.?-(\d{2,4})$', re.I)
NUM = re.compile(r'^-?[\d\s  ]+(?:[.,]\d+)?$')


def strip_accents(s):
    return ''.join(c for c in unicodedata.normalize('NFKD', s) if not unicodedata.combining(c))


def parse_num(t):
    t = str(t).strip().replace(' ', ' ').replace(' ', ' ')
    if not t or not NUM.match(t):
        return None
    t = t.replace(' ', '')
    # « 2 698.23 » (point décimal) et « 20,68 » (virgule décimale) coexistent.
    if ',' in t and '.' in t:
        t = t.replace('.', '').replace(',', '.')
    else:
        t = t.replace(',', '.')
    try:
        return float(t)
    except ValueError:
        return None


def parse_date(t):
    m = DATE.match(t.strip())
    if not m:
        return None
    mon = MONTHS.get(strip_accents(m.group(2).lower()).rstrip('.'))
    if not mon:
        return None
    y = int(m.group(3))
    y = y + 2000 if y < 100 else y
    return f'{y:04d}-{mon:02d}-{int(m.group(1)):02d}'


def category_of(line):
    s = strip_accents(line).upper()
    # Un en-tête de section ne porte pas de taux (« FCTC BOAD 6,10% … » est un titre).
    if '%' in s or not (s.startswith('OBLIGATIONS') or s.startswith('FCTC') or s.startswith('SUKUK')):
        return None
    if 'FCTC' in s:
        return 'fctc'
    if 'SUKUK' in s:
        return 'sukuk'
    gss = 'GSS' in s
    if 'ETAT' in s or 'SOUVERAIN' in s or 'PUBLIQUE' in s:
        return 'etat_gss' if gss else 'etat'
    if 'INSTITUTIONS' in s or 'REGIONALES' in s:
        return 'regional_gss' if gss else 'regional'
    if 'ENTREPRISES' in s:
        return 'entreprise_gss' if gss else 'entreprise'
    return None


def parse_record(sym, toks, cat):
    """toks : cellules qui suivent le symbole jusqu'au symbole suivant."""
    # Repère la périodicité (A/S/T/M) : coupon couru avant, puis montant net, date, type.
    idx = None
    for i, t in enumerate(toks):
        if t in PERIODS and i >= 2:
            idx = i
    if idx is None:
        return None
    rec = {'symbole': sym, 'categorie': cat, 'periodicite': PERIODS[toks[idx]]}
    rec['coupon_couru'] = parse_num(toks[idx - 1])
    tail = toks[idx + 1:]
    rec['coupon_net'] = parse_num(tail[0]) if tail else None
    rec['echeance_coupon'] = parse_date(tail[1]) if len(tail) > 1 else None
    rec['type_amort'] = tail[2] if len(tail) > 2 and tail[2] in AMORT else None
    head = toks[:idx - 1]
    # Colonnes numériques de cotation en fin de « head » : 4 (non coté : VN, préc., NC, réf.)
    # ou 6 (coté : VN, préc., jour, réf., volume, valeur).
    def numlike(t):
        return t in ('NC', 'SP') or parse_num(t) is not None
    # Titre : cellules jusqu'au premier nombre « de cotation » ; une année seule (« 2030 »)
    # en fin de titre coupé fait encore partie du titre.
    k = 0
    while k < len(head) and not (numlike(head[k]) and not re.fullmatch(r'-?(19|20)\d{2}', head[k].strip())):
        k += 1
    cols = head[k:]
    if not cols or not all(numlike(t) for t in cols):
        return None
    rec['titre'] = re.sub(r'\s+', ' ', ' '.join(head[:k])).strip()
    rec['suspendu'] = 'SP' in cols
    nums = [parse_num(t) for t in cols]
    rec['valeur_nominale'] = nums[0]
    if len(cols) == 5:
        # Pas de cours précédent (première cotation) : VN, jour, référence, volume, valeur.
        rec['cours_precedent'] = None
        rec['cours_jour'] = None if cols[1] in ('NC', 'SP') else nums[1]
        rec['cours_reference'], rec['volume'], rec['valeur'] = nums[2], nums[3], nums[4]
    elif len(cols) >= 4:
        rec['cours_precedent'] = nums[1]
        rec['cours_jour'] = None if cols[2] in ('NC', 'SP') else nums[2]
        rec['cours_reference'] = nums[3]
        rec['volume'] = nums[4] if len(cols) >= 6 else None
        rec['valeur'] = nums[5] if len(cols) >= 6 else None
        # Variante sans cours de référence ni valeur : « VN, préc., jour, volume ».
        ref = rec['cours_reference']
        if rec['cours_jour'] and ref is not None and ref < 0.2 * (rec['valeur_nominale'] or 1) and len(cols) == 4:
            rec['volume'], rec['cours_reference'] = ref, rec['cours_jour']
    else:
        # Colonnes de cotation incomplètes : nominal restant et dernier cours connu.
        known = [v for v in nums[1:] if v is not None]
        rec['cours_precedent'] = known[0] if known else None
        rec['cours_jour'] = None
        rec['cours_reference'] = known[-1] if known else nums[0]
        rec['volume'] = rec['valeur'] = None
    m = re.search(r'(\d{1,2}(?:[.,]\d+)?)\s*%', rec['titre'])
    rec['taux'] = float(m.group(1).replace(',', '.')) if m else None
    yrs = re.findall(r'(20\d{2}|19\d{2})', rec['titre'])
    rec['annee_echeance'] = int(yrs[-1]) if yrs else None
    rec['categorie'] = category_of_symbol(sym) or cat
    return rec if rec['valeur_nominale'] and rec['valeur_nominale'] > 0 else None


def category_of_symbol(sym):
    """Le BOC ne répète pas l'en-tête de section en haut de page : le symbole est plus sûr."""
    s = sym.upper()
    if re.match(r'^(TP|EO)[A-Z]{1,3}\.', s):
        return 'etat'
    if re.match(r'^(BIDC|BOAD|CRRH|EBID)\.', s):
        return 'regional'
    if re.match(r'^F[A-Z]{2,8}\.O', s):
        return 'fctc'
    return None


def extract_bonds(doc, max_pages=14):
    """doc : document pymupdf. Renvoie la liste des lignes obligataires."""
    out, seen = [], set()
    for p in range(min(max_pages, len(doc))):
        lines = [l.strip() for l in doc[p].get_text().split('\n')]
        lines = [l for l in lines if l]
        # Les pages de suite d'un tableau ne répètent pas son titre : on lit toutes les
        # pages de cotation et on ne garde que les lignes qui ont la forme attendue.
        cat, cur, toks = None, None, []

        def flush():
            if cur and cur not in seen:
                r = parse_record(cur, toks, cat)
                if r:
                    r['page'] = p + 1
                    out.append(r)
                    seen.add(cur)
        for l in lines:
            # Juste après un symbole, c'est le titre (« FCTC CROISSANCE ATLANTIQUE »), pas un en-tête.
            c = None if (cur and not toks) else category_of(l)
            if SYMBOL.match(l):
                flush()
                cur, toks = l, []
            elif l.upper().startswith('TOTAL') or c:
                flush()
                cur, toks = None, []
                if c:
                    cat = c
            elif cur:
                toks.append(l)
        flush()
    return out


if __name__ == '__main__':
    import pymupdf
    rows = extract_bonds(pymupdf.open(sys.argv[1]))
    if '--json' in sys.argv:
        print(json.dumps(rows, ensure_ascii=False, indent=1))
    else:
        for r in rows:
            print(f"{r['symbole']:<12} {r['categorie'] or '?':<14} VN={r['valeur_nominale']:<8} ref={r['cours_reference']} "
                  f"cc={r['coupon_couru']} per={r['periodicite']} net={r['coupon_net']} ech={r['echeance_coupon']} {r['type_amort']} | {r['titre'][:40]}")
        print(len(rows), 'lignes')
