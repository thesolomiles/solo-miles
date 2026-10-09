---
name: ride-sync
description: Sync a ride's story (text + photos, in order) from Leonard's Notion climb page into the game — the ride script Leonard speaks, the hologram photos, and the "Read the log" blog post. Use whenever Leonard says he's updated/tweaked/written a climb page in Notion ("I've updated the namsan page", "sync the ride", "re-sync", "hook this ride up", "I changed the order of the photos"), or when wiring up a new climb's blog. Do NOT hand-edit the generated script or blog — the Notion page is the source of truth.
---

# Ride sync (Notion → ride)

Leonard controls each ride's story from its Notion page (under "List of climbs",
id `3c5e34df57ac80f89dd7d895252cfea9`). The page's `# Blog` section, in block
order, IS the ride's sequence. The mapping is mechanical, done by
`tools/sync-ride.py` — keep it that way so what he arranges is what plays:

- each text paragraph → one line Leonard says (verbatim — don't polish; he edits in Notion)
- an image → comes up with the NEXT paragraph (image first, then text) and stays up until the next image
- images stacked with no text between → come up together, side by side
- an image's Notion caption → its hologram caption (none = no caption)
- a heading → clears the photo (section break)

## Steps

1. **Fetch** the climb page with the Notion MCP (`notion-fetch`).
2. **Snapshot** it to `content/rides/<route-id>.md` (the route id from `src/config/worlds.ts`):
   front matter (`id, notion, place, country, region, date, synced`), the
   `Strava: / Distance: / Elevation gained:` lines, then `# Blog` and every block
   after it, one per line, in order. Include the `# Thumbnail` heading + its image
   (above `# Blog`) — it becomes the blog cover on first sync. Include `# Description` + its
   paragraph(s) too — they become the route's `blurb` (the pitch under the title in
   the world selector and on /blog/). For images **already
   synced** write just the file path `![caption](<workspace-uuid>/<file-uuid>/<name>)`
   (the file UUID is the stable key → `images/<uuid8>.jpg`). For **new** images, put
   the query every image of the fetch shares ONCE in front matter as `s3query:`
   (X-Amz-Algorithm … Security-Token, stop before X-Amz-Signature) and write each
   image as `path?sig=<X-Amz-Signature>` — writing ~20 full URLs by hand blows the
   5-min window. An image whose X-Amz-Date differs from the rest needs its full URL.
   An image that comes back as `file://{"source":"attachment:…"}` has no download
   URL (the MCP can't fetch it) — leave it out and tell Leonard to re-add it in Notion.
3. **Run immediately** (signed URLs expire ~5 min after the fetch; downloads run in parallel):
   ```bash
   python3 tools/sync-ride.py <route-id>
   ```
   It writes `src/config/rideScripts/<route-id>.ts` (GENERATED), regenerates
   `public/blog/<route-id>/index.html` (plain content — the /blog/ page, `src/blog/`,
   shows it as the route's mini blog at `/blog/index.html#<route-id>`; don't hand-edit), downloads missing photos (≤1600px, EXIF/GPS
   stripped), deletes photos no longer on the page, then scrubs the signed-URL
   parts (s3query/signatures carry an AWS session token) from the snapshot so only
   stable file paths get committed.
4. **First sync of a route only**: in `worlds.ts` import the generated script and set
   `script:` + `blurb:` (both exported by the generated file) + `blogPath: '/blog/<route-id>/index.html'` on the route; make sure
   `public/blog/<route-id>/images/cover.jpg` exists (the page's `# Thumbnail`) and the
   route SVG is at `public/routes/<route-id>.svg`.
5. **Check** `git diff content/rides/` (shows exactly what changed on the page), load
   `/?ride=<route-id>&skipintro`, step through a few lines, then `pnpm build`.

`# Ride scene description` on the page is separate — it drives the scenery kits in
`src/config/rideScenes.ts`, not this sync.
