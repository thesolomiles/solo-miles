#!/usr/bin/env python3
"""Print the newest N dev-journal entries from journal.html as plain text.

Usage: recent.py [N]   (default 3)
Used by the SessionStart hook so each session starts caught up, without
loading the whole (large) journal into context.
"""
import html, os, re, sys

n = int(sys.argv[1]) if len(sys.argv) > 1 else 3
root = os.environ.get("CLAUDE_PROJECT_DIR") or os.path.join(os.path.dirname(__file__), "../../../..")
path = os.path.join(root, "journal.html")
try:
    src = open(path, encoding="utf-8").read()
except OSError:
    sys.exit(0)

articles = re.findall(r'<article id="([\d-]+)">(.*?)</article>', src, re.S)
all_dates = [d for d, _ in articles]
out = [f"# Dev journal — newest {min(n, len(articles))} of {len(articles)} entries (journal.html)\n"]
for date, body in articles[:n]:
    body = re.sub(r"<li>", "\n- ", body)
    body = re.sub(r"<h3>.*?>(.*?)</a></h3>", r"## \1", body, flags=re.S)
    body = re.sub(r"<[^>]+>", "", body)
    body = html.unescape(body)
    body = "\n".join(l.strip() for l in body.splitlines() if l.strip())
    out.append(body + "\n")
if len(all_dates) > n:
    out.append("Older entries: " + ", ".join(all_dates[n:]))
print("\n".join(out))
