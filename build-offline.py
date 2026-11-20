"""Build a self-contained HTML game, with credits and both photographic surfaces."""
import argparse
import base64
import json
import re
from pathlib import Path
from urllib.request import urlopen


def build(output, textures):
    source = Path(__file__).resolve().parent
    images = {}
    for name in ('asphalt_04', 'brown_brick_02'):
        filename = f'{name}_diff_1k.jpg'
        if textures:
            data = (textures / filename).read_bytes()
        else:
            url = f'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/{name}/{filename}'
            with urlopen(url, timeout=60) as response:
                data = response.read()
        if not data.startswith(b'\xff\xd8'):
            raise ValueError(f'{filename} is not a JPEG image')
        images[name] = 'data:image/jpeg;base64,' + base64.b64encode(data).decode('ascii')
    page = (source / 'index.html').read_text()
    css = (source / 'style.css').read_text()
    page = page.replace('<link rel="stylesheet" href="style.css">', f'<style>{css}</style>')
    page = page.replace('<script src="graphics.js">', '<script>window.surfaceImages=' +
                        json.dumps(images) + '</script><script src="graphics.js">')
    page = re.sub(r'<script src="([a-z-]+\.js)"></script>',
                  lambda match: '<script>\n' + (source / match[1]).read_text() + '\n</script>', page)
    credits = (source / 'credits.html').read_text().split('<body>')[1].split('<a href="index.html">')[0]
    page = page.replace('href="credits.html" target="_blank" rel="noopener"',
                        'href="#attribution" onclick="document.getElementById(\'attribution\').showModal();return false"')
    page = page.replace('</body>', '<dialog id="attribution">' + credits +
                        '<form method="dialog"><button>返回游戏</button></form></dialog></body>')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(page)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path, help='HTML file outside the source directory')
    parser.add_argument('--textures', type=Path, help='Use downloaded Poly Haven JPEGs')
    args = parser.parse_args()
    if args.output.resolve().is_relative_to(Path(__file__).resolve().parent):
        parser.error('Choose an output path outside the source directory.')
    build(args.output, args.textures)
