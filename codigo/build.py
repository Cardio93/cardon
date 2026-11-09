# Compila src/ en latido.html (versión en línea) y, con --offline, también Cardon.html (todo incluido)
import sys, subprocess
shell = open('src/index.html', encoding='utf8').read()
css = open('src/css/app.css', encoding='utf8').read()
order = [l.strip() for l in open('src/js/ORDEN.txt', encoding='utf8') if l.strip()]
js = '\n'.join(open('src/js/' + f, encoding='utf8').read() for f in order)
out = shell.replace('/*@CSS*/', css, 1).replace('/*@JS*/', js, 1)
open('latido.html', 'w', encoding='utf8').write(out)
print('latido.html', round(len(out.encode()) / 1e3), 'kB ·', len(order), 'módulos')
if '--offline' in sys.argv: subprocess.run([sys.executable, 'build_offline.py'], check=True)
