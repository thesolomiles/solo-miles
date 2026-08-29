# Blog posts (ride logs)

Static HTML ride logs, served by Vite from `public/` at the site root. No CMS —
each post is a self-contained folder. Written in Notion, exported to HTML, then
normalised into the layout below.

## Layout — one folder per post

```
public/blog/
  <slug>/                 # kebab-case, no spaces/hashes  → URL /blog/<slug>/
    index.html            # the post (renamed from Notion's hashed filename)
    images/               # all of the post's images, referenced as src="images/…"
      cover.jpg
      ...
```

- **Slug** is the folder name and the URL. Keep it kebab-case (`shimanami-kaido`),
  so URLs never contain `%20`.
- **`index.html`** — rename Notion's `Page Name <hash>.html` to this.
- **`images/`** — put every image here and make each `src` relative
  (`src="images/foo.jpg"`). Notion exports images into a hashed folder with the
  wrong name and URL-encoded paths; the normalisation step fixes this.
- Link the post from the game with
  `blogPath: '/blog/<slug>/index.html'` on the matching route in
  `src/config/worlds.ts`. Point at `index.html` explicitly (not the bare
  `/blog/<slug>/` directory) so it resolves as a static file rather than getting
  caught by Vite's SPA history fallback in dev.

## Metadata the game reads (`<meta name="sm:*">` in `<head>`)

These drive the world-selector card. Author them from the post (ideally a small
"properties" table/callout at the top of the Notion page):

| meta name          | example              | used for                         |
| ------------------ | -------------------- | -------------------------------- |
| `sm:place`         | `Shimanami Kaido`    | card title                       |
| `sm:country`       | `japan`              | which country group it lands in  |
| `sm:region`        | `Seto Inland Sea`    | card subtitle                    |
| `sm:distance-km`   | `70`                 | distance stat / km badge         |
| `sm:elevation-m`   | `640`                | climbing stat                    |
| `sm:difficulty`    | `2`                  | 1–5 difficulty pips              |
| `sm:glyph`         | `🌊`                 | thumbnail glyph                  |

The `<body>` prose is what becomes Leonard's ride dialogue (`script`).

## Adding a post

1. Write it in Notion; export **HTML** (with images).
2. Hand the export over; it gets normalised into `public/blog/<slug>/` as above
   (rename folder + `index.html`, move images into `images/`, rewrite `src`s,
   add the `sm:*` meta, and resize/compress large images — `public/` ships as-is).
3. A `Route` is added in `src/config/worlds.ts` (card + stats + `script` +
   `blogPath`). It shows up under its country with a 📖 marker, rides with a
   "Read the log" button, and Leonard talks about it.

The three folders here now (`shimanami-kaido`, `jeju-coastal-loop`, `biei-hills`)
are placeholders demonstrating the structure; `cover.svg` stands in for a real
exported photo.
