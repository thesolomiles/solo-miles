#!/usr/bin/env python3
"""
Sync a ride's story from its Notion snapshot → the game.

    python3 tools/sync-ride.py namsan-bugaksan

Reads content/rides/<id>.md — a snapshot of the climb's Notion page (front
matter + the page's "# Blog" section, blocks in Notion order) — and writes:

  src/config/rideScripts/<id>.ts      the ride script Leonard speaks (GENERATED)
  public/blog/<id>/index.html         the blog post / "Read the log" (GENERATED) —
                                      plain content; read on the site as the
                                      route's mini blog at /blog/index.html#<id>
  public/blog/<id>/images/<uuid8>.jpg the photos (downloaded only when missing)

Leonard controls the sequence from Notion; the rules are mechanical:
  - every text paragraph is one line Leonard says;
  - an image comes up with the NEXT paragraph (image, then text) and stays up
    until the next image;
  - images stacked with no text between them come up together, side by side;
  - an image's Notion caption becomes its hologram caption;
  - a heading clears the photo (a section break).

Image blocks are `![caption](url)`. Photos are keyed by the Notion file UUID
(stable across fetches), so the snapshot can carry just the file path; a NEW
image needs its signed URL (they expire ~5 min after the Notion fetch — run
this straight away). To keep the snapshot short, the signed query every image
of one fetch shares can go once in the front matter as `s3query:` (everything
from X-Amz-Algorithm up to, not including, X-Amz-Signature) and each new image
as `path?sig=<X-Amz-Signature>`. An image under `# Thumbnail` (before `# Blog`)
becomes the blog's cover.jpg when it doesn't exist yet. The paragraphs under
`# Description` (before `# Blog`) become the route's `blurb` — the short pitch
under the title in the world selector and on the /blog/ page. Downloads run in parallel, are resized to ≤1600px
and have EXIF (incl. GPS) stripped.
"""
import html
import json
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
S3 = 'https://prod-files-secure.s3.us-west-2.amazonaws.com/'
S3_TAIL = 'X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject'
UUID = re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
IMG = re.compile(r'^!\[(.*?)\]\((.+)\)\s*$')
HEAD = re.compile(r'^#{1,3}\s+(.*)$')
MAX_PX = 1600


def parse(path: Path):
    text = path.read_text()
    meta, body = {}, text
    if text.startswith('---\n'):
        fm, body = text[4:].split('\n---\n', 1)
        for ln in fm.splitlines():
            if ':' in ln:
                k, v = ln.split(':', 1)
                meta[k.strip()] = v.strip()
    def expand(url: str) -> str:
        if url.startswith('http') or '?sig=' not in url:
            return url
        path, sig = url.split('?sig=', 1)
        if 's3query' not in meta:
            sys.exit('image uses ?sig= but the front matter has no s3query')
        return f"{S3}{path}?{meta['s3query']}&X-Amz-Signature={sig}&{S3_TAIL}"

    stats, blocks, in_blog, cover = {}, [], False, None
    section, desc = None, []
    for raw in body.splitlines():
        ln = raw.strip()
        if not ln:
            continue
        if not in_blog:
            if re.match(r'^#\s+Blog\s*$', ln):
                in_blog = True
            elif m := HEAD.match(ln):
                section = m.group(1).strip().lower()
            elif section == 'description':
                desc.append(ln)
            elif m := IMG.match(ln):
                cover = expand(m.group(2))  # the # Thumbnail image
            elif ':' in ln and not ln.startswith('#'):
                k, v = ln.split(':', 1)
                stats[k.strip().lower()] = v.strip()
            continue
        if m := IMG.match(ln):
            url = expand(m.group(2))
            ids = UUID.findall(url.split('?')[0])
            if not ids:
                sys.exit(f'image without a Notion file UUID: {url[:80]}')
            blocks.append(('img', {'caption': m.group(1).strip(), 'url': url, 'key': ids[-1][:8]}))
        elif m := HEAD.match(ln):
            blocks.append(('head', m.group(1)))
        else:
            blocks.append(('p', ln))
    if not in_blog:
        sys.exit('no "# Blog" section in the snapshot')
    return meta, stats, blocks, cover, ' '.join(desc) or None


def fetch_cover(url, img_dir: Path):
    dst = img_dir / 'cover.jpg'
    if dst.exists() or not url or not url.startswith('http'):
        return
    img_dir.mkdir(parents=True, exist_ok=True)
    tmp = dst.with_suffix('.download')
    urllib.request.urlretrieve(url, tmp)
    im = ImageOps.exif_transpose(Image.open(tmp)).convert('RGB')
    im.thumbnail((MAX_PX, MAX_PX), Image.LANCZOS)
    im.save(dst, 'JPEG', quality=80, optimize=True, progressive=True)
    tmp.unlink()
    print('  downloaded cover.jpg')


def fetch_images(blocks, img_dir: Path):
    img_dir.mkdir(parents=True, exist_ok=True)
    todo = [b for k, b in blocks if k == 'img' and not (img_dir / f"{b['key']}.jpg").exists()]
    for b in todo:
        if not b['url'].startswith('http'):
            sys.exit(f"new image {b['key']} needs its full signed URL in the snapshot (re-fetch the Notion page)")

    def get(b):
        dst = img_dir / f"{b['key']}.jpg"
        tmp = dst.with_suffix('.download')
        urllib.request.urlretrieve(b['url'], tmp)
        im = ImageOps.exif_transpose(Image.open(tmp)).convert('RGB')
        im.thumbnail((MAX_PX, MAX_PX), Image.LANCZOS)
        im.save(dst, 'JPEG', quality=80, optimize=True, progressive=True)  # no exif= → metadata stripped
        tmp.unlink()
        return dst.name

    with ThreadPoolExecutor(max_workers=16) as pool:
        for name in pool.map(get, todo):
            print(f'  downloaded {name}')
    return len(todo)


def build_script(blocks, web_img: str):
    lines, pending, cleared, orphans = [], [], False, 0
    for kind, b in blocks:
        if kind == 'img':
            pending.append(b)
        elif kind == 'head':
            orphans += len(pending)
            pending, cleared = [], True
        else:
            line = {'say': b}
            if pending:
                line['photos'] = [f"{web_img}/{i['key']}.jpg" for i in pending]
                caption = ' · '.join(i['caption'] for i in pending if i['caption'])
                if caption:
                    line['caption'] = caption
            elif cleared:
                line['photos'] = None
            lines.append(line)
            pending, cleared = [], False
    orphans += len(pending)
    if orphans:
        print(f'  note: {orphans} image(s) with no text after them — shown in the blog only')
    return lines


def ts_script(ride_id: str, lines, blurb) -> str:
    out = [
        f'// GENERATED by tools/sync-ride.py from content/rides/{ride_id}.md — a snapshot',
        "// of Leonard's Notion page. Don't edit by hand: change the page, re-snapshot, re-sync.",
        "import type { ScriptLine } from '../worlds'",
        '',
        'export const script: ScriptLine[] = [',
    ]
    for l in lines:
        parts = [f"say: {json.dumps(l['say'], ensure_ascii=False)}"]
        if 'photos' in l:
            parts.append('photos: null' if l['photos'] is None else f"photos: {json.dumps(l['photos'])}")
        if 'caption' in l:
            parts.append(f"caption: {json.dumps(l['caption'], ensure_ascii=False)}")
        out.append('  { ' + ', '.join(parts) + ' },')
    out += [
        ']',
        '',
        '/** The page\'s # Description — the pitch under the title in the selector + /blog/. */',
        f"export const blurb: string | undefined = {json.dumps(blurb, ensure_ascii=False) if blurb else 'undefined'}",
        '',
    ]
    return '\n'.join(out)


def blog_html(meta, stats, blocks, img_dir: Path) -> str:
    """The post as plain content, in Notion order. The /blog/ page (src/blog/)
    reads its .src-flow into the route's mini blog, and a visit to the post's
    own URL forwards there; without JS it reads as a simple column."""
    e = html.escape
    rid = meta['id']
    place, country, region = meta.get('place', ''), meta.get('country', ''), meta.get('region', '')
    body = []
    for kind, b in blocks:
        if kind == 'p':
            body.append(f'      <p>{e(b)}</p>')
        elif kind == 'head':
            body.append(f'      <h2>{e(b)}</h2>')
        else:
            with Image.open(img_dir / f"{b['key']}.jpg") as im:
                w, h = im.size
            shape = 'tall' if h / w >= 1.2 else 'wide'
            alt = e(b['caption'] or f'Photo from the {place} ride')
            cap = f'<figcaption>{e(b["caption"])}</figcaption>' if b['caption'] else ''
            body.append(f'      <figure class="photo photo--{shape}"><img src="images/{b["key"]}.jpg" '
                        f'width="{w}" height="{h}" alt="{alt}">{cap}</figure>')
    return TEMPLATE.format(
        place=e(place), id=rid,
        meta_line=e(' · '.join(x for x in (region, country, meta.get('date', '')) if x)),
        distance=e(stats.get('distance', '')), elevation=e(stats.get('elevation gained', '')),
        strava=e(stats.get('strava', '')), body='\n'.join(body),
    )


TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{place} — Solomiles</title>
<!-- GENERATED by tools/sync-ride.py from content/rides/{id}.md (Leonard's Notion page).
     Read on the site as the route's mini blog: /blog/index.html#{id}. -->
<script>location.replace('/blog/index.html#{id}')</script>
<style>
  body {{ margin:0; background:#06102a; color:#f4f6fb; font:17px/1.7 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }}
  article {{ max-width:680px; margin:0 auto; padding:48px 20px 80px; }}
  h1 {{ margin:0; font-size:2.4rem; line-height:1.1; }}
  .meta {{ opacity:.66; }}
  a {{ color:#20cfff; }}
  img {{ max-width:100%; height:auto; display:block; border-radius:12px; }}
  figure {{ margin:28px 0; }}
  figcaption {{ font-size:.8rem; opacity:.6; text-align:center; margin-top:8px; }}
</style>
</head>
<body>
  <article class="source">
    <header class="src-title">
      <h1>{place}</h1>
      <p class="meta">{meta_line}</p>
      <p class="meta">{distance} · {elevation} climbing · <a href="{strava}">Strava</a></p>
    </header>
    <div class="src-flow">
{body}
    </div>
  </article>
</body>
</html>
"""


def scrub_snapshot(path: Path):
    """Once the photos are down, drop the signed-URL parts (s3query + signatures
    carry a short-lived AWS session token) so the committed snapshot keeps only
    the stable file paths."""
    text = path.read_text()
    out = re.sub(r'^s3query:.*\n', '', text, flags=re.M)
    out = re.sub(r'\]\(' + re.escape(S3) + r'([^)?]+)\?[^)]*\)', r'](\1)', out)
    out = re.sub(r'\]\(([^)?]+)\?sig=[^)]*\)', r'](\1)', out)
    if out != text:
        path.write_text(out)
        print(f'  scrubbed signed URLs from {path.relative_to(ROOT)}')


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    ride_id = sys.argv[1]
    snapshot = ROOT / 'content' / 'rides' / f'{ride_id}.md'
    meta, stats, blocks, cover, blurb = parse(snapshot)
    meta.setdefault('id', ride_id)
    blog_dir = ROOT / 'public' / 'blog' / ride_id
    img_dir = blog_dir / 'images'
    print(f'{ride_id}: {sum(k == "p" for k, _ in blocks)} paragraphs, {sum(k == "img" for k, _ in blocks)} images')
    with ThreadPoolExecutor(max_workers=2) as pool:
        jobs = [pool.submit(fetch_cover, cover, img_dir), pool.submit(fetch_images, blocks, img_dir)]
        for j in jobs:
            j.result()
    if not (img_dir / 'cover.jpg').exists():
        print('  note: no cover.jpg (add a # Thumbnail image to the page)')
    scrub_snapshot(snapshot)

    lines = build_script(blocks, f'/blog/{ride_id}/images')
    script_path = ROOT / 'src' / 'config' / 'rideScripts' / f'{ride_id}.ts'
    script_path.parent.mkdir(parents=True, exist_ok=True)
    script_path.write_text(ts_script(ride_id, lines, blurb))
    (blog_dir / 'index.html').write_text(blog_html(meta, stats, blocks, img_dir))

    used = {f"{b['key']}.jpg" for k, b in blocks if k == 'img'} | {'cover.jpg'}
    for f in img_dir.glob('*.jpg'):
        if f.name not in used:
            f.unlink()
            print(f'  removed unused {f.name}')
    print(f'  wrote {script_path.relative_to(ROOT)} ({len(lines)} lines) + {(blog_dir / "index.html").relative_to(ROOT)}')


if __name__ == '__main__':
    main()
