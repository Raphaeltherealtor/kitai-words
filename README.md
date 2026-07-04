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

## Add words from the app (parents)
Open parent settings → **Words** → **＋ Add a word**. You can now:
- **Type just the English** and tap **✨ Suggest from English** — the app translates it and offers the native spelling to pick from (kanji, hiragana, and katakana chips, plus the romaji reading). Tap a chip to fill the word/romaji fields; you can still edit them. Needs internet; falls back to manual entry if the translator can't be reached.
- After you tap **+ Add Word**, the **photo picker opens automatically** (seeded with the English term) so you can pick pictures right away.
- **Fix a wrong reading/pronunciation:** tap any word tile → **✏️ Edit word**. Change the kana that the app shows and speaks (or tap **✨ Suggest** for other readings), then **Save word**. Works for your own words and the built-in ones; the change syncs through the Shared Library. This is the "inflection" fix — `jaKana` is both what's displayed and what the voice reads.

Translation uses a free, no-key endpoint (`translate.googleapis.com`), matching the app's zero-setup philosophy; swap `translateWord()` in `app.js` if you prefer another source.

## Real photos
- Each item may include an optional `photoUrl` pointing at a real photograph. When present it is shown instead of the bundled `imagePath` art (parents' custom uploads still win over both).
- Animals use free-licensed photos from Wikimedia Commons via `Special:FilePath` (resolved by filename on the device, with a `?width=` thumbnail param). These render in the user's browser, not at build time.
- Robust fallback: if a `photoUrl` fails to load, the app automatically swaps in the bundled `imagePath` SVG, so a bad/changed URL never shows a broken image — just the old art for that one item.
- The service worker runtime-caches photos after first view, so they work offline afterward.
- To change a photo, edit that item's `photoUrl` in `data/vocab.json` (one line). To find a clean image, search [Wikimedia Commons](https://commons.wikimedia.org), open the file, and use its exact filename: `https://commons.wikimedia.org/wiki/Special:FilePath/<File%20name>.jpg?width=400`.

## PWA notes
- `pwa/manifest.json` and `service-worker.js` (root) enable install + offline.
- Icons: add `pwa/icons/icon-192.png` and `pwa/icons/icon-512.png` (simple colored squares work).
- Service worker is registered from the root so it works on GitHub Pages subpaths; it pre-caches core files and runtime-caches images after first load.

## Controls
- Home tiles: Vocabulary, Hiragana, Katakana (Kanji coming later).
- Vocab modes: Listen & Tap, Drag to Complete (missing kana).
- Hiragana/Katakana modes: Sound → Pick, Drag to Complete (missing character).
- Long-press the gear to open parent settings (choices, category, voice, romaji, vibration).
- 🔊 replays audio; if no Japanese TTS is available, a warning shows and play continues silently.

## Known constraints
- Web Speech API voice availability depends on the device.
- Drag & Drop uses pointer events (works on touch + mouse).
