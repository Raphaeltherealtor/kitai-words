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
- **Fix a wrong reading/pronunciation:** tap any word tile → **✏️ Edit word**. Change the kana that the app shows and speaks (or tap **✨ Suggest** for other readings), then **Save word**. Works for your own words and the built-in ones; the change syncs through the Shared Library.
- **Fix the pitch accent (箸 vs 橋):** the same kana can be two words with different pitch — 箸 (chopsticks, *HA‑shi*) vs 橋 (bridge, *ha‑SHI*), 桃 vs 腿 for もも. Bare kana carries no accent, and the Web Speech API has no per‑syllable pitch control. The lever is the **spoken form**: in **✏️ Edit word** fill **"🔊 Say it as"** with the kanji (箸/橋/桃). The tile still shows the kana, but the voice is handed the kanji so a good Japanese voice applies the right accent from its dictionary. Stored as the word's optional `jaSpeech`; leave blank to just speak the kana. Suggestions auto‑fill it from the kanji they generate. (Accent fidelity depends on the voice — high‑quality Japanese voices honor it; robotic/VoiceRSS voices may flatten it.)

## Choose which words the games use (parents)
Open parent settings → **Words in play** (also on the **Game** screen). Every category is one row — Animals, Numbers, Things, and any category you made — with a checkbox that summarises it:

- **Tap a group's checkbox** to switch that whole group on or off in one go. The box shows a dash when only some of its words are on.
- **Open a group** (tap its name) to see its words, each with its own checkbox — so you can rest the ten words she already knows and keep the rest.
- **All on / All off** at the top, plus a search box for finding one word fast.

Unchecked words are **not deleted**. They stop being dealt into every vocab game — Listen & Tap, Find It, Drag to Complete, Flash Cards, Memory, and the English Sentences track — and the Words screen dims them and marks them "sitting out". Check them back on any time.

**During a game**, tap the category chip in the play bar (the "🎲 Mixed ▾" pill next to the mode name). The menu that opens is the same list with the same checkboxes: pick a group to play by tapping its name, tick a group in or out with its checkbox, or tap the **›** to unfold that group's words and tick them one by one. Picks apply when you close the menu, so the board is re-dealt once rather than under the child's finger. Tapping the name of a group you had switched off turns it back on — asking to play it says you want it. Under **child lock** the menu shows the plain category list with no checkboxes, so a toddler's finger can't empty the game.

Notes:
- Changes apply when you close settings (or the in-game menu), so the round on screen is re-dealt from the new selection (deck modes start a fresh deck).
- The picks live in the same manifest as your words, so they sync through the Shared Library like everything else — last change wins.
- A word you add to a group that is entirely switched off starts switched off too, so it doesn't sneak into a game on its own.
- Switch everything off and the games say so instead of showing an empty board.

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
