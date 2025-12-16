# Kitai Vocabulary PWA

A touch-friendly Japanese vocab game for toddlers. Runs on mobile browsers and as a PWA.

## Run locally
1. Serve the folder with any static server (needed for fetch and service worker):
   - Python: `python -m http.server 8000`
   - Node: `npx serve .`
2. Open `http://localhost:8000`.

## Deploy to GitHub Pages
1. In this folder: `git init`, `git add .`, `git commit -m "Init Kitai PWA"`.
2. Create a new GitHub repo (empty), then:
   - `git remote add origin https://github.com/yourname/kitai-words.git`
   - `git branch -M main`
   - `git push -u origin main`
3. GitHub → Settings → Pages → Source: `Deploy from a branch`, Branch: `main`, Folder: `/ (root)`.
4. Wait a minute; your site will be at `https://yourname.github.io/kitai-words/`.
5. Optional: add a `.nojekyll` file in the root to avoid Jekyll quirks (`ni .nojekyll` then commit/push).

## Add new items
- Add categories in `data/vocab.json` under `categories`.
- Add items in `data/vocab.json` under `items` with `categoryId`, kana, romaji, `imagePath`, aliases.
- Drop the matching image file in `assets/images/` and point to it via `imagePath`.
- No code changes needed; the app is data-driven.

## PWA notes
- `pwa/manifest.json` and `service-worker.js` (root) enable install + offline.
- Icons: add `pwa/icons/icon-192.png` and `pwa/icons/icon-512.png` (simple colored squares work).
- Service worker is registered from the root so it works on GitHub Pages subpaths; it pre-caches core files and runtime-caches images after first load.

## Controls
- Default mode: Listen & Tap.
- Long-press the gear to open parent settings (mode, choices, category, voice, romaji).
- 🔊 replays audio; if no Japanese TTS is available, a warning shows and play continues silently.

## Known constraints
- Web Speech API voice availability depends on the device.
- Drag & Drop uses pointer events (works on touch + mouse).
