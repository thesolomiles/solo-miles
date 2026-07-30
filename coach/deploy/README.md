# Deploying Coach so it's reachable with your machine off

The web app + Telegram bot run as two systemd services behind Caddy (automatic HTTPS) on a small always-on VPS.

## 1. Create the VPS

Hetzner (cheapest, ~€4.35/mo, CX22) or DigitalOcean ($4-6/mo, Basic Droplet) both work fine. Pick:

- Ubuntu 22.04 or 24.04
- Smallest/cheapest plan (this app is tiny - 1 vCPU / 1-2GB RAM is plenty)
- Add your SSH key during creation so you can log in as root

You'll do the account creation and payment yourself on their site. Note the server's public IP once it's up.

## 2. Point coach.thesolomiles.com at it

In whatever DNS provider manages `thesolomiles.com` (Namecheap, Cloudflare, your registrar's dashboard, etc.), add:

- Type: `A`
- Host/Name: `coach`
- Value: the VPS's public IP
- TTL: default is fine

This is a separate record from whatever points the bare domain/`www` at Vercel - adding it doesn't touch or risk the live site. DNS can take a few minutes (sometimes longer) to propagate; `dig coach.thesolomiles.com` should show the VPS IP once it has.

## 3. Push the code

`coach/` needs to be on GitHub for the server to `git clone`/`git pull` it. This pushes to the `projects-page` branch only - `main` (and the live site) is untouched:

```bash
git add coach components/projects/coach-project.tsx app/projects/coach
git commit -m "Add Coach project page and always-on deploy config"
git push origin projects-page
```

## 4. Run the provisioning script

SSH into the box as root, then:

```bash
REPO_URL=git@github.com:thesolomiles/solo-miles.git BRANCH=projects-page bash -c "$(curl -fsSL https://raw.githubusercontent.com/thesolomiles/solo-miles/projects-page/coach/deploy/provision.sh)"
```

(`DOMAIN` defaults to `coach.thesolomiles.com` - only pass `DOMAIN=...` if you want something else.)

It'll stop partway and tell you to add `coach/.env` on the server - see step 5.

## 5. Set real secrets on the server

The `.env` file is intentionally never committed. On the VPS:

```bash
sudo -u coach nano /opt/solo-miles/coach/.env
```

Paste your real values (same shape as your local `coach/.env`), but change:

```
STRAVA_REDIRECT_URI=https://coach.thesolomiles.com/strava/callback
WEB_BASE_URL=https://coach.thesolomiles.com
COOKIE_SECURE=true
```

Then re-run `provision.sh` (or just `systemctl restart coach-web coach-bot`).

## 6. Update the Strava app's redirect URI

In your Strava API app settings (strava.com/settings/api), change the "Authorization Callback Domain" to `coach.thesolomiles.com`. The old `localhost:8008` redirect stops working once you switch.

## 7. Point the public site at the real URL

In your Vercel project settings, add an environment variable:

```
NEXT_PUBLIC_COACH_APP_URL=https://coach.thesolomiles.com
```

Then redeploy the site (Vercel env vars only take effect on the next build).

## Updating the app later

```bash
ssh root@your-vps
cd /opt/solo-miles && git pull
sudo -u coach coach/.venv/bin/pip install -r coach/requirements.txt
systemctl restart coach-web coach-bot
```
