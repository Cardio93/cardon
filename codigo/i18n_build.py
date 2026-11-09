import json, re, glob, sys
EN = {}
for f in sorted(glob.glob('i18n/*.txt')):
    for ln in open(f, encoding='utf8'):
        ln = ln.rstrip('\n')
        if not ln.strip() or ln.startswith('#'): continue
        if ' ⇒ ' not in ln: print('BAD', f, ln[:80]); continue
        k, v = ln.split(' ⇒ ', 1)
        k = k.replace('\\n', '\n'); v = v.replace('\\n', '\n')
        if k in EN and EN[k] != v: print('DUP', repr(k)[:80])
        EN[k] = v
TOK = json.load(open('i18n/tokens.json', encoding='utf8')) if glob.glob('i18n/tokens.json') else {}
import glob as _g
TARGET = next(f for f in sorted(_g.glob('src/js/*.js')) if '/*EN-DICT*/' in open(f, encoding='utf8').read())
s = open(TARGET, encoding='utf8').read()
s = re.sub(r'/\*EN-DICT\*/.*?/\*EN-DICT-END\*/', lambda m: '/*EN-DICT*/' + json.dumps(EN, ensure_ascii=False, separators=(',', ':')) + '/*EN-DICT-END*/', s, flags=re.S)
s = re.sub(r'/\*EN-TOKENS\*/.*?/\*EN-TOKENS-END\*/', lambda m: '/*EN-TOKENS*/' + json.dumps(TOK, ensure_ascii=False, separators=(',', ':')) + '/*EN-TOKENS-END*/', s, flags=re.S)
open(TARGET, 'w', encoding='utf8').write(s)
import subprocess; subprocess.run([sys.executable, 'build.py'], check=True)
print(len(EN), 'entradas,', len(TOK), 'tokens')
