---
name: journal
description: Read and update the solo-miles dev journal (journal.html). Use at the start of every session to catch up on recent progress before doing anything else, when the user asks "where were we", "what did we do last time", "catch me up", or mentions the journal — and before ending a session where meaningful work happened, to log today's entry.
---

# Dev journal

`journal.html` (repo root) is the running, human-readable log of solo-miles progress,
newest first. It is large, so never read the whole file just to catch up.

## Catching up (start of session)

A `SessionStart` hook (`.claude/settings.json`) already injects the newest 3 entries as
plain text into context — look for "Dev journal — newest 3 of N entries". If it's there,
you're caught up; don't re-read the file.

If it's missing (hook didn't run), or you need more history, run:

```bash
python3 .claude/skills/journal/scripts/recent.py 5
```

For a specific older day, grep for its `<article id="YYYY-MM-DD">` block instead of
reading the whole file.

After catching up, give the user a 1–3 line "last time we…" recap only if it's relevant to
what they asked; otherwise just proceed with their request.

## Logging (end of session)

Before ending a session where meaningful work happened, add or update **today's** entry:

- New day: add `<a href="#YYYY-MM-DD">YYYY-MM-DD</a>` at the **top** of the `<nav>` list,
  and a new `<article id="YYYY-MM-DD">` at the **top** of `<main>` (just under the
  "newest first" comment), matching the existing markup:
  ```html
  <article id="YYYY-MM-DD">
    <h3><a class="perma" href="#YYYY-MM-DD">YYYY-MM-DD · Weekday</a></h3>
    <ul>
      <li><strong>What changed.</strong> Why, in a sentence or two.</li>
    </ul>
  </article>
  ```
- Today's entry already exists: append `<li>` bullets to it — never duplicate the article.
- Keep it high-level and readable by a human: decisions + what changed and why, not a
  play-by-play. Implementation detail and gotchas belong in memory or the code.
