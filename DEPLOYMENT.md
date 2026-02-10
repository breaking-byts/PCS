# Deployment Guide

## Option 1: Netlify
1. Push this folder to a Git repo.
2. In Netlify, create a new site from that repo.
3. Build settings:
   - Build command: `echo 'Static site - no build step'`
   - Publish directory: `.`
4. Deploy.

`netlify.toml` is already configured with headers.

## Option 2: Vercel
1. Push this folder to a Git repo.
2. Import the repo in Vercel.
3. Keep framework as `Other`.
4. Build command can stay empty.
5. Deploy.

`vercel.json` is already configured for clean URLs and security headers.

## Option 3: GitHub Pages
1. Push repository to GitHub.
2. In repository settings, open `Pages`.
3. Set source to the desired branch/folder (root).
4. Save and wait for site publish.

## Production Checklist
- Validate visuals on desktop and mobile.
- Verify export CSV and PNG actions in browser.
- Confirm comparison mode, scenario presets, and saved presets.
- Smoke test BER/SER output on noisy digital scenarios.
