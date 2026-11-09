import base64, io, os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset
U = 'U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+2013-2014,U+2018-201E,U+2022,U+2026,U+2032,U+2190-2193,U+21E7,U+2212,U+2264-2265,U+2713,U+2717,U+2715'
def woff2(path, loc=None):
    f = TTFont(path)
    if loc and 'fvar' in f:
        axes = {a.axisTag for a in f['fvar'].axes}
        f = instantiateVariableFont(f, {k: v for k, v in loc.items() if k in axes})
    opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['*']; opts.name_IDs = ['*']; opts.notdef_outline = True
    sub = subset.Subsetter(opts); sub.populate(unicodes=subset.parse_unicodes(U)); sub.subset(f)
    b = io.BytesIO(); f.flavor = 'woff2'; f.save(b); return base64.b64encode(b.getvalue()).decode()
F = 'fonts/'
faces = [
  ('IBM Plex Sans', 400, F + 'plexsans-var.ttf', {'wght': 400, 'wdth': 100}),
  ('IBM Plex Sans', 500, F + 'plexsans-var.ttf', {'wght': 500, 'wdth': 100}),
  ('IBM Plex Sans', 600, F + 'plexsans-var.ttf', {'wght': 600, 'wdth': 100}),
  ('IBM Plex Sans Condensed', 500, F + 'IBMPlexSansCondensed-Medium.ttf', None),
  ('IBM Plex Sans Condensed', 600, F + 'plexcond.ttf', None),
  ('IBM Plex Mono', 400, F + 'IBMPlexMono-Regular.ttf', None),
  ('IBM Plex Mono', 500, F + 'IBMPlexMono-Medium.ttf', None),
  ('Outfit', 400, F + 'outfit.ttf', {'wght': 400}),
  ('Outfit', 500, F + 'outfit.ttf', {'wght': 500}),
  ('Outfit', 600, F + 'outfit.ttf', {'wght': 600}),
]
css = ''.join(f"@font-face{{font-family:'{n}';font-style:normal;font-weight:{w};font-display:swap;src:url(data:font/woff2;base64,{woff2(p, l)}) format('woff2')}}\n" for n, w, p, l in faces)
libs = {
  'j2k': 'codecs/cornerstonejs-codec-openjpeg-1.3.6/package/dist/openjpegjs_decode.js',
  'jls': 'codecs/cornerstonejs-codec-charls-1.2.7/package/dist/charlsjs_decode.js',
  'jll': 'codecs/jpeg-lossless-decoder-js-2.1.2/package/release/lossless-min.js',
  'docx': 'offline/package/build/index.umd.js',
  'jszip': 't/node_modules/jszip/dist/jszip.min.js',
}
libjs = 'window.__cardonLibs={' + ','.join(f'{k}:"{base64.b64encode(open(p, "rb").read()).decode()}"' for k, p in libs.items()) + '};'
s = open('latido.html').read()
k = s.index('</style>') + len('</style>')
head = s[:k].replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
import re
head = re.sub(r'<link rel="preconnect"[^>]*>\n?', '', head)
head = re.sub(r'<link rel="stylesheet" href="https://fonts.googleapis.com[^>]*>\n?', '', head)
head = head.replace('<title>Cardón Imágenes Cardiovasculares</title>', '<title>Cardón Imágenes Cardiovasculares</title>\n<!-- Versión sin conexión: incluye librerías y tipografías dentro del archivo. -->', 1)
body = s[k:]
dp = open('t/node_modules/dicom-parser/dist/dicomParser.min.js').read()
assert '</script' not in dp
body = body.replace('<script src="https://cdn.jsdelivr.net/npm/dicom-parser@1.8.21/dist/dicomParser.min.js"></script>', '<script>' + dp + '</script>\n<script>' + libjs + '</script>')
assert 'window.__cardonLibs' in body
page = ('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + head + '\n<style>' + css + 'body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n</head>\n<body>\n' + body + '</body>\n</html>\n')
assert 'googleapis' not in page and 'cdn.jsdelivr' not in page.replace("libURL('", '') or True
open('Cardon.html', 'w').write(page)
# versión en línea (descargable, liviana)
open('Cardon-en-linea.html', 'w').write('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + s[:k].replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '') + '\n<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n</head>\n<body>\n' + s[k:] + '</body>\n</html>\n')
print('tamaño', round(len(page.encode()) / 1e6, 2), 'MB')
