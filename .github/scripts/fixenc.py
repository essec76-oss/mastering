import glob

CP1252 = {
    0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026,
    0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160,
    0x8B: 0x2039, 0x8C: 0x0152, 0x8E: 0x017D, 0x91: 0x2018, 0x92: 0x2019,
    0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
    0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A, 0x9C: 0x0153,
    0x9E: 0x017E, 0x9F: 0x0178,
}

def build_map():
    m = {}
    for b in range(0x80, 0x100):
        m[chr(b)] = b
    for b, cp in CP1252.items():
        m.setdefault(chr(cp), b)
    return m

M = build_map()

def fix_text(text):
    out = []
    i, n = 0, len(text)
    while i < n:
        ch = text[i]
        if ord(ch) >= 0x80 and ch in M:
            j = i
            while j < n and ord(text[j]) >= 0x80 and text[j] in M:
                j += 1
            run = text[i:j]
            bs = bytes(M[c] for c in run)
            try:
                out.append(bs.decode('utf-8'))
            except UnicodeDecodeError:
                out.append(run)
            i = j
        else:
            out.append(ch)
            i += 1
    return ''.join(out)

def process(path):
    with open(path, encoding='utf-8') as f:
        orig = f.read()
    cur = orig
    for _ in range(3):
        new = fix_text(cur)
        if new == cur:
            break
        cur = new
    if cur != orig:
        with open(path, 'w', encoding='utf-8', newline='') as f:
            f.write(cur)
        print('fixed: ' + path)

for p in ['index.html'] + sorted(glob.glob('js/*.js')):
    process(p)
