const state = {
  data: null,
  items: [],
  builtinItems: [],
  wordManifest: null,
  wordSync: "idle", // idle | syncing | ok | error
  categories: [],
  currentSection: "home",
  currentTrack: "vocab",
  currentGameType: "tap", // tap | drag-complete | find | kana-tap | kana-complete
  choiceCount: 3,
  findCount: 6,
  // Find It locks onto one word for several rounds (reshuffling distractors)
  // before moving on. findTarget = the locked item, findRepsTarget = how many
  // finds before advancing (random 5–7), findRepsDone = finds completed so far.
  findTarget: null,
  findRepsTarget: 0,
  findRepsDone: 0,
  categoryId: "mixed",
  romaji: false,
  vibration: true,
  voices: [],
  voiceId: null,
  preferOnlineVoice: false,
  ttsApiKey: "",
  currentTarget: null,
  currentChoices: [],
  // Taps are ignored until this timestamp. Prevents a baby's rapid extra taps
  // (mashing after a correct answer) from carrying over and auto-answering the
  // next round before they've even seen it.
  lockUntil: 0,
  kanaChars: [],
  kanaWords: [],
  kataChars: [],
  kataWords: [],
  kanjiChars: [],
  kanjiWords: [],
  currentKanaMissing: null,
  longPressTimer: null,
  longPressMs: 600,
  soundEnabled: true,
  lang: "ja", // ja | ko | en — which language the words + voice use
  koAltReading: false, // Korean siblings: false = 오빠/언니 (girl's view), true = 형/누나 (boy's view)
  theme: "ocean",
  imageOverrides: {},
  imageCategoryId: "all",
  imageModalItemId: null,
  alphabetIndex: { hiragana: 0, katakana: 0 },
  libraryConfig: { libraryId: "", pin: "" },
  storagePrefix: null,
};

// Supported languages. `speech` = BCP-47 tag for SpeechSynthesis, `hl` =
// VoiceRSS language code, `prefix` = voice-list lang filter, `sample` = the
// Parent-Settings voice test phrase, `kana` = whether the Japanese-only kana
// tracks (Hiragana/Katakana) apply.
const LANGS = {
  ja: { label: "日本語 Japanese", speech: "ja-JP", hl: "ja-jp", prefix: "ja", sample: "こんにちは。ねこ。", kana: true },
  ko: { label: "한국어 Korean", speech: "ko-KR", hl: "ko-kr", prefix: "ko", sample: "안녕하세요. 고양이.", kana: false },
  en: { label: "English", speech: "en-US", hl: "en-us", prefix: "en", sample: "Hello. Cat.", kana: false },
};
const LANG_KEY = "kitai-lang";
function langCfg() {
  return LANGS[state.lang] || LANGS.ja;
}

// The word to show/speak for the current language, with graceful fallback.
function wordText(item) {
  if (!item) return "";
  if (state.lang === "en") return item.en || item.jaKana || "";
  if (state.lang === "ko") {
    if (state.koAltReading && item.koAlt) return item.koAlt;
    return item.ko || item.en || item.jaKana || "";
  }
  return item.jaKana || item.en || "";
}
// The romanization line (under the word) for the current language.
function wordRomaji(item) {
  if (!item) return "";
  if (state.lang === "ko") {
    if (state.koAltReading && item.koAltRomaji) return item.koAltRomaji;
    return item.koRomaji || "";
  }
  if (state.lang === "en") return "";
  return item.jaRomaji || "";
}
// The secondary label beneath the word: romanization if toggled on, otherwise
// the English gloss (except in English mode where the word is already English).
function wordSubLabel(item) {
  if (!item) return "";
  if (state.romaji) return wordRomaji(item);
  return state.lang === "en" ? "" : item.en || "";
}

const els = {
  homeScreen: document.getElementById("home-screen"),
  gameScreen: document.getElementById("game-screen"),
  cards: document.getElementById("cards"),
  promptWord: document.getElementById("prompt-word"),
  feedback: document.getElementById("feedback"),
  trackLabel: document.getElementById("track-label"),
  modeLabel: document.getElementById("mode-label"),
  categoryLabel: document.getElementById("category-label"),
  voiceWarning: document.getElementById("voice-warning"),
  parentBtn: document.getElementById("parent-button"),
  homeBtn: document.getElementById("home-button"),
  overlay: document.getElementById("settings-overlay"),
  choiceCount: document.getElementById("choice-count"),
  categorySelect: document.getElementById("category-select"),
  categoryQuick: document.getElementById("category-quick"),
  voiceSelect: document.getElementById("voice-select"),
  romajiToggle: document.getElementById("romaji-toggle"),
  vibrationToggle: document.getElementById("vibration-toggle"),
  soundToggle: document.getElementById("sound-toggle"),
  themeSelect: document.getElementById("theme-select"),
  langSelect: document.getElementById("lang-select"),
  koAltToggle: document.getElementById("ko-alt-toggle"),
  appLogo: document.getElementById("app-logo"),
  appLogoText: document.getElementById("app-logo-text"),
  onboarding: document.getElementById("onboarding"),
  onboardingLogo: document.getElementById("onboarding-logo"),
  onboardingLogoText: document.getElementById("onboarding-logo-text"),
  onboardingLangs: document.getElementById("onboarding-langs"),
  onboardingPhone: document.getElementById("onboarding-phone"),
  onboardingPin: document.getElementById("onboarding-pin"),
  onboardingStart: document.getElementById("onboarding-start"),
  onboardingStatus: document.getElementById("onboarding-status"),
  closeSettings: document.getElementById("close-settings"),
  speakBtn: document.getElementById("speak-btn"),
  dropzoneSection: document.getElementById("dropzone-section"),
  dropzone: document.getElementById("dropzone"),
  modeButtons: document.querySelectorAll(".mode-btn"),
  findCountBar: document.getElementById("find-count-bar"),
  findCountOptions: document.getElementById("find-count-options"),
  tileButtons: document.querySelectorAll(".tile[data-track]"),
  completeWordSection: document.getElementById("complete-word-section"),
  completeWordDisplay: document.getElementById("complete-word-display"),
  completeChoices: document.getElementById("complete-choices"),
  imageSearch: document.getElementById("image-search"),
  imageList: document.getElementById("image-list"),
  wrongOverlay: document.getElementById("wrong-overlay"),
  correctOverlay: document.getElementById("correct-overlay"),
  imageCategoryPills: document.getElementById("image-category-pills"),
  imageModal: document.getElementById("image-modal"),
  imageModalTitle: document.getElementById("image-modal-title"),
  imageModalImg: document.getElementById("image-modal-img"),
  imageModalClose: document.getElementById("image-modal-close"),
  imageModalUpload: document.getElementById("image-modal-upload"),
  imageModalCamera: document.getElementById("image-modal-camera"),
  imageModalFind: document.getElementById("image-modal-find"),
  imageModalStock: document.getElementById("image-modal-stock"),
  stockSearchInput: document.getElementById("stock-search-input"),
  stockSearchGo: document.getElementById("stock-search-go"),
  stockSearchResults: document.getElementById("stock-search-results"),
  imageModalReset: document.getElementById("image-modal-reset"),
  imageModalFile: document.getElementById("image-modal-file"),
  imageModalCameraInput: document.getElementById("image-modal-camera-input"),
  promptArea: document.getElementById("prompt-area"),
  alphabetSection: document.getElementById("alphabet-section"),
  alphabetEmoji: document.getElementById("alphabet-emoji"),
  alphabetKana: document.getElementById("alphabet-kana"),
  alphabetExampleWord: document.getElementById("alphabet-example-word"),
  alphabetExampleRomaji: document.getElementById("alphabet-example-romaji"),
  alphabetExampleEn: document.getElementById("alphabet-example-en"),
  alphabetPrev: document.getElementById("alphabet-prev"),
  alphabetNext: document.getElementById("alphabet-next"),
  alphabetSpeak: document.getElementById("alphabet-speak"),
  alphabetProgress: document.getElementById("alphabet-progress"),
  installBanner: document.getElementById("install-banner"),
  installText: document.getElementById("install-text"),
  installBtn: document.getElementById("install-btn"),
  installDismiss: document.getElementById("install-dismiss"),
  alphabetQuizSection: document.getElementById("alphabet-quiz-section"),
  quizKana: document.getElementById("quiz-kana"),
  quizChoices: document.getElementById("quiz-choices"),
  quizFeedback: document.getElementById("quiz-feedback"),
  quizSpeak: document.getElementById("quiz-speak"),
  quizSkip: document.getElementById("quiz-skip"),
  quizProgress: document.getElementById("quiz-progress"),
  imageModalPhotos: document.getElementById("image-modal-photos"),
  libraryIdInput: document.getElementById("library-id"),
  libraryPinInput: document.getElementById("library-pin"),
  librarySaveBtn: document.getElementById("library-save"),
  libraryResetBtn: document.getElementById("library-reset"),
  libraryStatus: document.getElementById("library-status"),
  newWordCategory: document.getElementById("new-word-category"),
  newWordEn: document.getElementById("new-word-en"),
  newWordKana: document.getElementById("new-word-kana"),
  newWordRomaji: document.getElementById("new-word-romaji"),
  newWordPhoto: document.getElementById("new-word-photo"),
  newWordAdd: document.getElementById("new-word-add"),
  newWordStatus: document.getElementById("new-word-status"),
  wordSyncIndicator: document.getElementById("word-sync-indicator"),
  voiceTestBtn: document.getElementById("voice-test-btn"),
  voiceRefreshBtn: document.getElementById("voice-refresh-btn"),
  voiceTestStatus: document.getElementById("voice-test-status"),
  onlineVoiceToggle: document.getElementById("online-voice-toggle"),
  ttsApiKeyInput: document.getElementById("tts-api-key"),
};

const SUPABASE_URL = "https://nfaxncksesfcfqavmlae.supabase.co";
const SUPABASE_KEY = "sb_publishable_tOW43SppvjqItz5vGlLpiQ_W3t4CMR_";
const SUPABASE_BUCKET = "kitai-images";

document.addEventListener("DOMContentLoaded", init);

async function init() {
  loadThemePref();
  loadLangPref();
  loadVoicePref();
  loadLibraryConfig();
  await loadData();
  await loadHiragana();
  await loadKatakana();
  await loadImageOverrides();
  buildImageManager();
  await setupVoices();
  applyTheme();
  applyLangToUI();
  bindUI();
  registerServiceWorker();
  goHome();
  maybeShowOnboarding();
  ensureStoragePrefix()
    .then(() => {
      syncImagesFromSupabase().catch(() => {});
      syncWordsWithCloud().catch(() => {});
    })
    .catch(() => {});
}

async function loadData() {
  const res = await fetch("data/vocab.json");
  state.data = await res.json();
  state.categories = state.data.categories;
  state.builtinItems = state.data.items;
  state.wordManifest = loadWordManifest();
  applyWordManifestToState();
  updateWordSyncIndicator();

  if (els.newWordCategory) {
    els.newWordCategory.innerHTML = "";
    state.categories.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = `${cat.emoji} ${cat.label_en}`;
      els.newWordCategory.appendChild(opt);
    });
  }

  els.categorySelect.innerHTML = "";
  const mixedOpt = document.createElement("option");
  mixedOpt.value = "mixed";
  mixedOpt.textContent = "Mixed";
  els.categorySelect.appendChild(mixedOpt);
  if (els.categoryQuick) {
    els.categoryQuick.innerHTML = "";
    els.categoryQuick.appendChild(mixedOpt.cloneNode(true));
  }

  state.categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = `${cat.emoji} ${cat.label_en}`;
    els.categorySelect.appendChild(opt);
    if (els.categoryQuick) {
      els.categoryQuick.appendChild(opt.cloneNode(true));
    }
  });
}

async function loadHiragana() {
  const res = await fetch("data/hiragana.json");
  const hira = await res.json();
  state.kanaChars = hira.characters;
  state.kanaWords = hira.words;
}

async function loadKatakana() {
  const res = await fetch("data/katakana.json");
  const kata = await res.json();
  state.kataChars = kata.characters;
  state.kataWords = kata.words;
}

async function loadKanji() {
  const res = await fetch("data/kanji.json");
  const kan = await res.json();
  state.kanjiChars = kan.characters;
  state.kanjiWords = kan.words;
}

const THEME_KEY = "kitai-theme";
const VALID_THEMES = ["ocean", "galaxy", "sky", "sunshine"];

function loadThemePref() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved && VALID_THEMES.includes(saved)) state.theme = saved;
  } catch (_) {}
}

function applyTheme() {
  if (!VALID_THEMES.includes(state.theme)) state.theme = "ocean";
  document.documentElement.dataset.theme = state.theme;
  if (els.themeSelect) els.themeSelect.value = state.theme;
  try { localStorage.setItem(THEME_KEY, state.theme); } catch (_) {}
}

function loadLangPref() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && LANGS[saved]) state.lang = saved;
    state.koAltReading = localStorage.getItem("kitai-ko-alt") === "1";
  } catch (_) {}
}

// Reflect the current language in the UI: keep the picker in sync and hide the
// Japanese-only script tracks (Hiragana/Katakana/Kanji) when not in Japanese.
function applyLangToUI() {
  if (els.langSelect) els.langSelect.value = state.lang;
  if (els.koAltToggle) els.koAltToggle.checked = state.koAltReading;
  const kana = langCfg().kana;
  document.querySelectorAll('.tile[data-track="hiragana"], .tile[data-track="katakana"], .tile[data-track="kanji"]').forEach((t) => {
    t.classList.toggle("hidden", !kana);
  });
}

// Apply a language without navigating (used by onboarding + the settings picker).
function applyLanguageChoice(lang) {
  if (!LANGS[lang]) return;
  state.lang = lang;
  try { localStorage.setItem(LANG_KEY, lang); } catch (_) {}
  applyLangToUI();
  setupVoiceOptions();
}

// Switch language from Parent Settings: also reset any in-progress round and
// return home so the (possibly changed) track list is re-picked cleanly.
function setLanguage(lang) {
  if (!LANGS[lang]) return;
  applyLanguageChoice(lang);
  resetFindSession();
  goHome();
}

const ONBOARDED_KEY = "kitai-onboarded";
let onboardingLang = "ja";

function maybeShowOnboarding() {
  let done = false;
  try { done = localStorage.getItem(ONBOARDED_KEY) === "1"; } catch (_) {}
  if (done) return;
  if (!els.onboarding) return;
  onboardingLang = state.lang || "ja";
  highlightOnboardingLang();
  // Pre-fill the account fields if a library is already connected.
  if (els.onboardingPhone) els.onboardingPhone.value = state.libraryConfig.libraryId || "";
  if (els.onboardingPin) els.onboardingPin.value = state.libraryConfig.pin || "";
  els.onboarding.classList.remove("hidden");
}

function highlightOnboardingLang() {
  if (!els.onboardingLangs) return;
  els.onboardingLangs.querySelectorAll(".onboarding-lang").forEach((b) => {
    b.classList.toggle("active", b.dataset.lang === onboardingLang);
  });
}

function setupOnboarding() {
  if (!els.onboarding) return;
  if (els.onboardingLangs) {
    els.onboardingLangs.querySelectorAll(".onboarding-lang").forEach((btn) => {
      onTap(btn, () => {
        onboardingLang = btn.dataset.lang;
        highlightOnboardingLang();
      });
    });
  }
  if (els.onboardingStart) onTap(els.onboardingStart, finishOnboarding);
}

async function finishOnboarding() {
  const phone = (els.onboardingPhone?.value || "").replace(/\D/g, "");
  const pin = (els.onboardingPin?.value || "").trim();
  // Account is optional, but if they started filling it in, require both halves.
  if ((phone || pin) && !(phone && /^\d{4}$/.test(pin))) {
    if (els.onboardingStatus) {
      els.onboardingStatus.textContent = "Enter a phone number and a 4-digit PIN, or leave both blank to skip.";
    }
    return;
  }

  applyLanguageChoice(onboardingLang);
  if (phone && pin) {
    if (els.onboardingStatus) {
      els.onboardingStatus.style.color = "#2a9d8f";
      els.onboardingStatus.textContent = "Connecting your account…";
    }
    try { await applyLibrarySwitch(phone, pin); } catch (_) {}
  }

  try { localStorage.setItem(ONBOARDED_KEY, "1"); } catch (_) {}
  if (els.onboarding) els.onboarding.classList.add("hidden");
  goHome();
}

let imageDb = null;

const MAX_PHOTOS_PER_ITEM = 10;

function getImageDb() {
  if (imageDb) return Promise.resolve(imageDb);
  if (!("indexedDB" in window)) return Promise.reject(new Error("IndexedDB not supported"));
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("kitai-images", 2);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      const tx = req.transaction;
      let store;
      if (e.oldVersion < 1) {
        store = db.createObjectStore("images", { keyPath: "id" });
      } else {
        store = tx.objectStore("images");
      }
      if (!store.indexNames.contains("itemId")) {
        store.createIndex("itemId", "itemId");
      }
      if (e.oldVersion < 2) {
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (!cursor) return;
          const rec = cursor.value;
          if (!rec.itemId) {
            rec.itemId = rec.id;
            rec.addedAt = rec.addedAt || 0;
            cursor.update(rec);
          }
          cursor.continue();
        };
      }
    };
    req.onsuccess = () => {
      imageDb = req.result;
      resolve(imageDb);
    };
    req.onerror = () => reject(req.error);
  });
}

function requestToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function revokeAllOverrideUrls() {
  Object.values(state.imageOverrides).forEach((arr) => {
    if (Array.isArray(arr)) arr.forEach((entry) => URL.revokeObjectURL(entry.url));
  });
  state.imageOverrides = {};
}

async function loadImageOverrides() {
  revokeAllOverrideUrls();
  try {
    const db = await getImageDb();
    const tx = db.transaction("images", "readonly");
    const store = tx.objectStore("images");
    const records = await requestToPromise(store.getAll());
    records.forEach((rec) => {
      if (!rec.blob) return;
      const itemId = rec.itemId || rec.id;
      const url = URL.createObjectURL(rec.blob);
      if (!state.imageOverrides[itemId]) state.imageOverrides[itemId] = [];
      state.imageOverrides[itemId].push({ imageId: rec.id, url, addedAt: rec.addedAt || 0 });
    });
    Object.keys(state.imageOverrides).forEach((k) => {
      state.imageOverrides[k].sort((a, b) => a.addedAt - b.addedAt);
    });
  } catch (e) {
    state.imageOverrides = {};
  }
}

function getOverrideEntries(itemId) {
  const arr = state.imageOverrides[itemId];
  return Array.isArray(arr) ? arr : [];
}

function getImageSrc(item) {
  const arr = getOverrideEntries(item.id);
  if (arr.length) {
    const pick = arr[Math.floor(Math.random() * arr.length)];
    return pick.url;
  }
  return item.photoUrl || item.imagePath;
}

// If a curated/remote photo fails to load, quietly swap in the bundled art
// so the user never sees a broken image.
function onImageLoadError(e) {
  const img = e.currentTarget;
  const fallback = img.dataset.fallbackSrc;
  if (fallback && img.getAttribute("src") !== fallback) {
    img.src = fallback;
  }
}

// Set the built-in image for an item: prefer the curated real photo,
// fall back to the bundled SVG art if it fails to load.
function applyDefaultImage(img, item) {
  if (item.photoUrl) {
    img.dataset.fallbackSrc = item.imagePath;
    img.addEventListener("error", onImageLoadError, { once: true });
    img.src = item.photoUrl;
  } else {
    img.src = item.imagePath;
  }
}

// Set the image shown in gameplay cards: a user's custom photo wins,
// otherwise the curated photo (with fallback to bundled art).
function applyItemImage(img, item) {
  const arr = getOverrideEntries(item.id);
  if (arr.length) {
    img.src = arr[Math.floor(Math.random() * arr.length)].url;
    return;
  }
  applyDefaultImage(img, item);
}

// --- Custom words (parent-added, synced via the Shared Library) ---
//
// Stored as a manifest { items: {id: word}, deleted: {id: ts} }. Each word and
// each deletion carries a timestamp, so merging two devices' manifests is a
// last-write-wins union with tombstones: adds and deletes both propagate and a
// deleted word never re-appears. The same manifest lives in localStorage (for
// offline) and in Supabase Storage under the Shared Library prefix.

const WORD_MANIFEST_KEY = "kitai-words-manifest";
const LEGACY_CUSTOM_KEY = "kitai-custom-items";

function emptyManifest() {
  return { items: {}, deleted: {} };
}

function loadWordManifest() {
  try {
    const raw = localStorage.getItem(WORD_MANIFEST_KEY);
    if (raw) {
      const m = JSON.parse(raw);
      if (m && typeof m === "object") return { items: m.items || {}, deleted: m.deleted || {} };
    }
  } catch (_) {}
  // Migrate the earlier device-only array form, if present.
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_CUSTOM_KEY) || "[]");
    if (Array.isArray(legacy) && legacy.length) {
      const m = emptyManifest();
      const now = Date.now();
      legacy.forEach((it) => {
        if (it && it.id && it.categoryId) m.items[it.id] = serializeWord(it, now);
      });
      saveWordManifest(m);
      return m;
    }
  } catch (_) {}
  return emptyManifest();
}

function saveWordManifest(m) {
  try {
    localStorage.setItem(WORD_MANIFEST_KEY, JSON.stringify(m));
  } catch (_) {}
}

function serializeWord(item, ts) {
  const w = {
    id: item.id,
    categoryId: item.categoryId,
    en: item.en,
    jaKana: item.jaKana,
    jaRomaji: item.jaRomaji || "",
    updatedAt: ts || item.updatedAt || Date.now(),
  };
  if (item.photoUrl) w.photoUrl = item.photoUrl;
  return w;
}

// Turn a stored word record into a live, renderable item (art regenerated).
function wordToItem(w) {
  const cat = state.categories.find((c) => c.id === w.categoryId);
  const item = {
    id: w.id,
    categoryId: w.categoryId,
    en: w.en,
    jaKana: w.jaKana,
    jaRomaji: w.jaRomaji || "",
    imagePath: placeholderImage(cat ? cat.emoji : "⭐"),
    aliases: [],
    custom: true,
    updatedAt: w.updatedAt || 0,
  };
  if (w.photoUrl) item.photoUrl = w.photoUrl;
  return item;
}

function applyWordManifestToState() {
  const m = state.wordManifest || emptyManifest();
  // Honor deletions for built-in words too (not just custom ones), so a parent
  // can remove any word from the games. The tombstone syncs across devices.
  const base = (state.builtinItems || []).filter((it) => !m.deleted[it.id]);
  state.items = base.concat(Object.values(m.items).map(wordToItem));
}

function mergeManifests(a, b) {
  const out = emptyManifest();
  const ids = new Set([
    ...Object.keys(a.items || {}),
    ...Object.keys(b.items || {}),
    ...Object.keys(a.deleted || {}),
    ...Object.keys(b.deleted || {}),
  ]);
  ids.forEach((id) => {
    const ai = (a.items || {})[id];
    const bi = (b.items || {})[id];
    const item = ai && bi ? ((ai.updatedAt || 0) >= (bi.updatedAt || 0) ? ai : bi) : ai || bi;
    const itemTs = item ? item.updatedAt || 0 : 0;
    const delTs = Math.max((a.deleted || {})[id] || 0, (b.deleted || {})[id] || 0);
    if (delTs && delTs >= itemTs) {
      out.deleted[id] = delTs;
    } else if (item) {
      out.items[id] = item;
    }
  });
  return out;
}

// --- Cloud sync for the word manifest (mirrors the image sync prefix) ---

function wordsCloudPath(prefix) {
  return `${prefix}/__words__/manifest.json`;
}

async function fetchCloudWordManifest() {
  const prefix = await ensureStoragePrefix();
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${wordsCloudPath(prefix)}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      cache: "no-store",
    });
    if (!res.ok) return emptyManifest();
    const m = await res.json();
    return { items: m.items || {}, deleted: m.deleted || {} };
  } catch (_) {
    return emptyManifest();
  }
}

async function pushCloudWordManifest(m) {
  const prefix = await ensureStoragePrefix();
  const body = new Blob([JSON.stringify(m)], { type: "application/json" });
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${wordsCloudPath(prefix)}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "x-upsert": "true",
      "Content-Type": "application/json",
    },
    body,
  });
  if (!res.ok) throw new Error(`Word manifest upload failed: ${res.status}`);
}

function isLibraryConfigured() {
  const id = (state.libraryConfig.libraryId || "").trim();
  const pin = (state.libraryConfig.pin || "").trim();
  return !!(id && pin);
}

function updateWordSyncIndicator() {
  const el = els.wordSyncIndicator;
  if (!el) return;
  if (!isLibraryConfigured()) {
    el.textContent = "● Saved on this device — connect a Shared Library below to sync across devices";
    el.style.color = "#8a8594";
    return;
  }
  switch (state.wordSync) {
    case "syncing":
      el.textContent = "⟳ Syncing…";
      el.style.color = "#8a8594";
      break;
    case "ok":
      el.textContent = "✓ Synced to your Shared Library";
      el.style.color = "#2a9d8f";
      break;
    case "error":
      el.textContent = "⚠ Offline — changes will sync when you're back online";
      el.style.color = "#e76f51";
      break;
    default:
      el.textContent = "● Connected to Shared Library";
      el.style.color = "#8a8594";
  }
}

let wordSyncInFlight = false;
async function syncWordsWithCloud() {
  if (wordSyncInFlight) return;
  wordSyncInFlight = true;
  state.wordSync = "syncing";
  updateWordSyncIndicator();
  try {
    const remote = await fetchCloudWordManifest();
    const merged = mergeManifests(state.wordManifest || emptyManifest(), remote);
    state.wordManifest = merged;
    saveWordManifest(merged);
    applyWordManifestToState();
    renderImageList();
    if (state.currentTrack === "vocab") renderCurrentView();
    await pushCloudWordManifest(merged); // let other devices converge
    state.wordSync = "ok";
  } catch (_) {
    // offline or failed; the local manifest is already applied
    state.wordSync = "error";
  } finally {
    wordSyncInFlight = false;
    updateWordSyncIndicator();
  }
}

// A simple emoji-on-color placeholder (data URI) so a new word always has art
// even before a photo is added — matches the bundled SVG style.
function placeholderImage(emoji) {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">' +
    '<rect width="200" height="200" rx="32" fill="#ffe0b2"/>' +
    '<text x="100" y="115" font-size="96" text-anchor="middle" dominant-baseline="middle" dy="-5">' +
    (emoji || "⭐") +
    "</text></svg>";
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

function setNewWordStatus(msg, isError) {
  if (!els.newWordStatus) return;
  els.newWordStatus.textContent = msg;
  els.newWordStatus.style.color = isError ? "#d62828" : "#2a9d8f";
}

function addCustomItemFromForm() {
  const categoryId = els.newWordCategory ? els.newWordCategory.value : "";
  const en = (els.newWordEn?.value || "").trim();
  const kana = (els.newWordKana?.value || "").trim();
  const romaji = (els.newWordRomaji?.value || "").trim();
  const photo = (els.newWordPhoto?.value || "").trim();

  if (!categoryId) {
    setNewWordStatus("Please pick a category.", true);
    return;
  }
  if (!en || !kana) {
    setNewWordStatus("Please enter both English and Japanese (kana).", true);
    return;
  }
  if (photo && !/^https?:\/\//i.test(photo)) {
    setNewWordStatus("Photo URL must start with http:// or https://", true);
    return;
  }

  const cat = state.categories.find((c) => c.id === categoryId);
  const now = Date.now();
  const id = `custom-${now}-${Math.random().toString(36).slice(2, 7)}`;
  const word = { id, categoryId, en, jaKana: kana, jaRomaji: romaji, updatedAt: now };
  if (photo) word.photoUrl = photo;

  if (!state.wordManifest) state.wordManifest = emptyManifest();
  state.wordManifest.items[id] = word;
  delete state.wordManifest.deleted[id];
  saveWordManifest(state.wordManifest);
  applyWordManifestToState();

  els.newWordEn.value = "";
  els.newWordKana.value = "";
  els.newWordRomaji.value = "";
  els.newWordPhoto.value = "";
  setNewWordStatus(`Added "${en}" to ${cat ? cat.label_en : categoryId}. ✓`);

  renderImageList();
  if (state.currentTrack === "vocab") renderCurrentView();
  syncWordsWithCloud().catch(() => {});
}

function removeCustomItem(id) {
  const removed = state.items.find((i) => i.id === id);
  if (!removed) return;
  if (!confirm(`Remove the word "${removed.en}" from the games?`)) return;
  if (!state.wordManifest) state.wordManifest = emptyManifest();
  delete state.wordManifest.items[id]; // no-op for built-in words
  state.wordManifest.deleted[id] = Date.now();
  saveWordManifest(state.wordManifest);
  // Drop any photos that were attached to this custom word.
  const overrides = getOverrideEntries(id);
  overrides.forEach((e) => {
    URL.revokeObjectURL(e.url);
    removeImageFromIdbAndCloud(e.imageId).catch(() => {});
  });
  delete state.imageOverrides[id];
  applyWordManifestToState();
  renderImageList();
  if (state.currentTrack === "vocab") renderCurrentView();
  syncWordsWithCloud().catch(() => {});
}

function generateImageId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function saveImageOverride(itemId, file) {
  if (!file) return;
  const imageId = generateImageId();
  const addedAt = Date.now();
  try {
    const db = await getImageDb();
    const tx = db.transaction("images", "readwrite");
    await requestToPromise(tx.objectStore("images").put({ id: imageId, itemId, blob: file, addedAt }));
    if (!state.imageOverrides[itemId]) state.imageOverrides[itemId] = [];
    state.imageOverrides[itemId].push({ imageId, url: URL.createObjectURL(file), addedAt });
    while (state.imageOverrides[itemId].length > MAX_PHOTOS_PER_ITEM) {
      const oldest = state.imageOverrides[itemId].shift();
      URL.revokeObjectURL(oldest.url);
      removeImageFromIdbAndCloud(oldest.imageId).catch(() => {});
    }
    renderImageList();
    renderImageModalContent();
    if (state.currentTrack === "vocab") renderCurrentView();
  } catch (e) {
    // ignore
  }
  uploadImageToSupabase(itemId, imageId, file).catch(() => {});
}

async function removeImageFromIdbAndCloud(imageId) {
  try {
    const db = await getImageDb();
    const tx = db.transaction("images", "readwrite");
    await requestToPromise(tx.objectStore("images").delete(imageId));
  } catch (_) {}
  deleteImageFromSupabase(imageId).catch(() => {});
}

async function removeImageOverride(itemId, imageId) {
  const arr = state.imageOverrides[itemId] || [];
  const idx = arr.findIndex((e) => e.imageId === imageId);
  if (idx >= 0) {
    URL.revokeObjectURL(arr[idx].url);
    arr.splice(idx, 1);
    if (arr.length === 0) delete state.imageOverrides[itemId];
  }
  await removeImageFromIdbAndCloud(imageId);
  renderImageList();
  renderImageModalContent();
  if (state.currentTrack === "vocab") renderCurrentView();
}

async function removeAllImagesForItem(itemId) {
  const arr = (state.imageOverrides[itemId] || []).slice();
  for (const entry of arr) {
    URL.revokeObjectURL(entry.url);
    await removeImageFromIdbAndCloud(entry.imageId);
  }
  delete state.imageOverrides[itemId];
  renderImageList();
  renderImageModalContent();
  if (state.currentTrack === "vocab") renderCurrentView();
}

function getDeviceId() {
  let id = null;
  try { id = localStorage.getItem("kitai-device-id"); } catch (_) {}
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) ||
      `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try { localStorage.setItem("kitai-device-id", id); } catch (_) {}
  }
  return id;
}

function loadLibraryConfig() {
  try {
    state.libraryConfig.libraryId = localStorage.getItem("kitai-library-id") || "";
    state.libraryConfig.pin = localStorage.getItem("kitai-library-pin") || "";
  } catch (_) {}
}

function saveLibraryConfigToStorage(libraryId, pin) {
  state.libraryConfig.libraryId = libraryId || "";
  state.libraryConfig.pin = pin || "";
  try {
    if (libraryId) localStorage.setItem("kitai-library-id", libraryId);
    else localStorage.removeItem("kitai-library-id");
    if (pin) localStorage.setItem("kitai-library-pin", pin);
    else localStorage.removeItem("kitai-library-pin");
  } catch (_) {}
}

async function deriveLibraryPrefix(libraryId, pin) {
  if (!crypto.subtle) return `lib-${libraryId}-${pin}`;
  const data = new TextEncoder().encode(`kitai-v1::${libraryId}::${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return "lib-" + Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}

async function computeStoragePrefix() {
  const id = (state.libraryConfig.libraryId || "").trim();
  const pin = (state.libraryConfig.pin || "").trim();
  if (id && pin) return await deriveLibraryPrefix(id, pin);
  return getDeviceId();
}

async function ensureStoragePrefix() {
  if (state.storagePrefix) return state.storagePrefix;
  state.storagePrefix = await computeStoragePrefix();
  return state.storagePrefix;
}

function readPathMap() {
  try { return JSON.parse(localStorage.getItem("kitai-image-paths") || "{}"); } catch (_) { return {}; }
}
function writePathMap(map) {
  try { localStorage.setItem("kitai-image-paths", JSON.stringify(map)); } catch (_) {}
}

// The "My First Words" logo lives in Supabase Storage so it can be swapped
// without a code change. Each <img> falls back to the text title if the file
// isn't uploaded yet (or fails to load offline before it's been cached).
const BRAND_LOGO_PATH = "branding/my-first-words-logo.png";
function brandLogoUrl() {
  return supabasePublicUrl(BRAND_LOGO_PATH);
}
function wireLogo(img, textEl) {
  if (!img) return;
  img.addEventListener("load", () => {
    img.classList.remove("hidden");
    if (textEl) textEl.classList.add("hidden");
  });
  img.addEventListener("error", () => {
    img.classList.add("hidden");
    if (textEl) textEl.classList.remove("hidden");
  });
  img.src = brandLogoUrl();
}
function setupBranding() {
  wireLogo(els.appLogo, els.appLogoText);
  wireLogo(els.onboardingLogo, els.onboardingLogoText);
}

function supabasePublicUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${path}`;
}

function fileExt(file) {
  const fallback = (file.type && file.type.split("/")[1]) || "png";
  const nameExt = file.name && file.name.includes(".") ? file.name.split(".").pop() : null;
  return (nameExt || fallback).toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
}

async function uploadImageToSupabase(itemId, imageId, file) {
  const ext = fileExt(file);
  const prefix = await ensureStoragePrefix();
  const path = `${prefix}/${itemId}/${imageId}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "x-upsert": "true",
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });
  if (!res.ok) throw new Error(`Supabase upload failed: ${res.status}`);
  const map = readPathMap();
  map[imageId] = path;
  writePathMap(map);
}

async function deleteImageFromSupabase(imageId) {
  const map = readPathMap();
  const path = map[imageId];
  if (!path) return;
  await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${path}`, {
    method: "DELETE",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  delete map[imageId];
  writePathMap(map);
}

async function listSupabase(prefix) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${SUPABASE_BUCKET}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function listSupabaseRecursive(rootPrefix) {
  const all = [];
  const queue = [rootPrefix];
  let safety = 200;
  while (queue.length && safety-- > 0) {
    const p = queue.shift();
    const list = await listSupabase(p);
    for (const entry of list) {
      if (!entry || !entry.name) continue;
      if (entry.id) {
        all.push({ path: `${p}${entry.name}`, name: entry.name });
      } else {
        queue.push(`${p}${entry.name}/`);
      }
    }
  }
  return all;
}

async function syncImagesFromSupabase() {
  const prefix = await ensureStoragePrefix();
  const all = await listSupabaseRecursive(`${prefix}/`);
  if (all.length === 0) return;

  const db = await getImageDb();
  const existingKeys = new Set(
    await requestToPromise(db.transaction("images", "readonly").objectStore("images").getAllKeys())
  );

  const map = readPathMap();
  let touched = false;
  for (const entry of all) {
    const rel = entry.path.slice(prefix.length + 1);
    if (rel.startsWith("__words__/")) continue; // word manifest, not an image
    const parts = rel.split("/");
    let itemId, imageId;
    if (parts.length >= 2) {
      itemId = parts[0];
      imageId = parts[parts.length - 1].replace(/\.[^.]+$/, "");
    } else {
      itemId = parts[0].replace(/\.[^.]+$/, "");
      imageId = `legacy-${itemId}`;
    }
    map[imageId] = entry.path;
    if (existingKeys.has(imageId)) continue;
    try {
      const blobRes = await fetch(supabasePublicUrl(entry.path));
      if (!blobRes.ok) continue;
      const blob = await blobRes.blob();
      const addedAt = Date.now();
      const wtx = db.transaction("images", "readwrite");
      await requestToPromise(wtx.objectStore("images").put({ id: imageId, itemId, blob, addedAt }));
      if (!state.imageOverrides[itemId]) state.imageOverrides[itemId] = [];
      state.imageOverrides[itemId].push({ imageId, url: URL.createObjectURL(blob), addedAt });
      touched = true;
    } catch (_) {}
  }
  writePathMap(map);
  if (touched) {
    Object.keys(state.imageOverrides).forEach((k) => {
      state.imageOverrides[k].sort((a, b) => a.addedAt - b.addedAt);
    });
    renderImageList();
    renderImageModalContent();
    if (state.currentTrack === "vocab") renderCurrentView();
  }
}

async function clearImageDb() {
  try {
    const db = await getImageDb();
    const tx = db.transaction("images", "readwrite");
    await requestToPromise(tx.objectStore("images").clear());
  } catch (_) {}
}

async function applyLibrarySwitch(libraryId, pin) {
  saveLibraryConfigToStorage(libraryId, pin);
  await clearImageDb();
  revokeAllOverrideUrls();
  writePathMap({});
  state.storagePrefix = null;
  await ensureStoragePrefix();
  renderImageList();
  renderImageModalContent();
  if (state.currentTrack === "vocab") renderCurrentView();
  syncImagesFromSupabase().catch(() => {});
  // Custom words follow the library too (local words merge up into it).
  syncWordsWithCloud().catch(() => {});
}

function setupVoiceOptions() {
  els.voiceSelect.innerHTML = "";
  const prefix = langCfg().prefix;
  const voices = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith(prefix));
  state.voices = voices;

  if (!voices.length) {
    els.voiceWarning.classList.remove("hidden");
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = `No ${langCfg().label} voice`;
    els.voiceSelect.appendChild(opt);
    return;
  }

  els.voiceWarning.classList.add("hidden");

  // Pick the default: the previously saved voice if it's still here, otherwise
  // prefer an offline (local) voice — they're far more reliable than network
  // voices — and finally fall back to the first Japanese voice.
  const saved = state.voiceId && voices.find((v) => v.voiceURI === state.voiceId);
  const local = voices.find((v) => v.localService);
  const chosen = saved || local || voices[0];
  state.voiceId = chosen.voiceURI;
  saveVoicePref();

  voices.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v.voiceURI;
    opt.textContent = `${v.name} (${v.lang})${v.localService ? " · offline" : " · network"}`;
    if (v.voiceURI === state.voiceId) opt.selected = true;
    els.voiceSelect.appendChild(opt);
  });
}

const VOICE_KEY = "kitai-voice-id";

function loadVoicePref() {
  try {
    const v = localStorage.getItem(VOICE_KEY);
    if (v) state.voiceId = v;
    state.preferOnlineVoice = localStorage.getItem("kitai-prefer-online-voice") === "1";
    state.ttsApiKey = localStorage.getItem("kitai-tts-key") || "";
  } catch (_) {}
  if (els.onlineVoiceToggle) els.onlineVoiceToggle.checked = state.preferOnlineVoice;
  if (els.ttsApiKeyInput) els.ttsApiKeyInput.value = state.ttsApiKey;
}

function saveVoicePref() {
  try {
    if (state.voiceId) localStorage.setItem(VOICE_KEY, state.voiceId);
  } catch (_) {}
}

// Re-query the OS voice list (e.g. after installing Japanese TTS data) and
// rebuild the dropdown without restarting the app.
function refreshVoices() {
  speechSynthesis.getVoices(); // nudge engines that load voices lazily
  setupVoiceOptions();
  const el = els.voiceTestStatus;
  if (!el) return;
  const n = state.voices.length;
  if (n) {
    const cur = state.voices.find((v) => v.voiceURI === state.voiceId);
    el.style.color = "#2a9d8f";
    el.textContent = `Found ${n} ${langCfg().label} voice${n > 1 ? "s" : ""}. Selected: ${cur ? cur.name : "default"}.`;
  } else {
    el.style.color = "#d62828";
    el.textContent = `No ${langCfg().label} voice found yet. Install that language's TTS in Android settings, then tap Refresh again.`;
  }
}

function setupVoices() {
  return new Promise((resolve) => {
    setupVoiceOptions();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = () => {
        setupVoiceOptions();
        resolve();
      };
    } else {
      resolve();
    }
  });
}

// Activate on a per-pointer tap instead of "click". When a second finger (a
// resting thumb gripping the tablet) is already on the screen, the browser
// will NOT synthesize a click for a poke from another finger — it assumes a
// gesture may be starting — so click-based buttons silently fail under
// multi-touch. Pointer events fire per pointerId, so each finger's tap is
// handled independently regardless of other fingers held down elsewhere.
function onTap(el, handler) {
  if (!el) return;
  let downId = null;
  let sx = 0;
  let sy = 0;
  el.addEventListener("pointerdown", (e) => {
    downId = e.pointerId;
    sx = e.clientX;
    sy = e.clientY;
  });
  el.addEventListener("pointerup", (e) => {
    if (e.pointerId !== downId) return;
    downId = null;
    // Ignore drags/swipes; only count a roughly-stationary press as a tap.
    if (Math.abs(e.clientX - sx) > 28 || Math.abs(e.clientY - sy) > 28) return;
    handler(e);
  });
  el.addEventListener("pointercancel", () => {
    downId = null;
  });
}

function bindUI() {
  // Unlock iOS speech on the very first interaction anywhere in the app.
  document.addEventListener("pointerdown", primeSpeech);
  document.addEventListener("touchend", primeSpeech);
  onTap(els.speakBtn, () => speakCurrent());
  if (els.voiceTestBtn) els.voiceTestBtn.addEventListener("click", testVoice);
  if (els.voiceRefreshBtn) els.voiceRefreshBtn.addEventListener("click", refreshVoices);
  if (els.onlineVoiceToggle) {
    els.onlineVoiceToggle.addEventListener("change", (e) => {
      state.preferOnlineVoice = e.target.checked;
      try { localStorage.setItem("kitai-prefer-online-voice", state.preferOnlineVoice ? "1" : "0"); } catch (_) {}
    });
  }
  if (els.ttsApiKeyInput) {
    els.ttsApiKeyInput.addEventListener("change", (e) => {
      state.ttsApiKey = e.target.value.trim();
      try { localStorage.setItem("kitai-tts-key", state.ttsApiKey); } catch (_) {}
      // A key means they want the online voice — switch to it automatically.
      if (state.ttsApiKey && !state.preferOnlineVoice) {
        state.preferOnlineVoice = true;
        if (els.onlineVoiceToggle) els.onlineVoiceToggle.checked = true;
        try { localStorage.setItem("kitai-prefer-online-voice", "1"); } catch (_) {}
      }
    });
  }
  els.parentBtn.addEventListener("pointerdown", startLongPress);
  els.parentBtn.addEventListener("pointerup", (e) => {
    cancelLongPress();
    showSettings();
  });
  els.parentBtn.addEventListener("click", showSettings);
  els.parentBtn.addEventListener("pointerleave", cancelLongPress);
  onTap(els.homeBtn, goHome);
  els.closeSettings.addEventListener("click", hideSettings);

  els.choiceCount.addEventListener("change", (e) => {
    state.choiceCount = Number(e.target.value);
    startRound();
  });

  els.categorySelect.addEventListener("change", (e) => {
    state.categoryId = e.target.value;
    els.categoryLabel.textContent =
      e.target.value === "mixed"
        ? "Mixed"
        : state.categories.find((c) => c.id === e.target.value)?.label_en || "Mixed";
    if (els.categoryQuick && els.categoryQuick.value !== e.target.value) {
      els.categoryQuick.value = e.target.value;
    }
    startRound();
  });

  if (els.categoryQuick) {
    els.categoryQuick.addEventListener("change", (e) => {
      state.categoryId = e.target.value;
      els.categoryLabel.textContent =
        e.target.value === "mixed"
          ? "Mixed"
          : state.categories.find((c) => c.id === e.target.value)?.label_en || "Mixed";
      if (els.categorySelect && els.categorySelect.value !== e.target.value) {
        els.categorySelect.value = e.target.value;
      }
      startRound();
    });
  }

  els.voiceSelect.addEventListener("change", (e) => {
    state.voiceId = e.target.value;
    saveVoicePref();
  });

  els.romajiToggle.addEventListener("change", (e) => {
    state.romaji = e.target.checked;
    renderCurrentView();
  });

  els.vibrationToggle.addEventListener("change", (e) => {
    state.vibration = e.target.checked;
  });

  if (els.soundToggle) {
    els.soundToggle.addEventListener("change", (e) => {
      state.soundEnabled = e.target.checked;
    });
  }

  if (els.themeSelect) {
    els.themeSelect.addEventListener("change", (e) => {
      state.theme = e.target.value;
      applyTheme();
    });
  }

  if (els.langSelect) {
    els.langSelect.addEventListener("change", (e) => setLanguage(e.target.value));
  }

  if (els.koAltToggle) {
    els.koAltToggle.addEventListener("change", (e) => {
      state.koAltReading = e.target.checked;
      try { localStorage.setItem("kitai-ko-alt", state.koAltReading ? "1" : "0"); } catch (_) {}
      if (state.currentTrack === "vocab" && state.currentSection === "game") renderCurrentView();
    });
  }

  els.dropzone.addEventListener("pointerup", onDropZonePointerUp);

  if (els.imageSearch) {
    els.imageSearch.addEventListener("input", renderImageList);
  }

  if (els.newWordAdd) {
    els.newWordAdd.addEventListener("click", addCustomItemFromForm);
  }

  if (els.imageModalClose) {
    els.imageModalClose.addEventListener("click", closeImageModal);
  }
  if (els.imageModalUpload) {
    els.imageModalUpload.addEventListener("click", () => {
      if (!els.imageModalFile || !state.imageModalItemId) return;
      els.imageModalFile.dataset.itemId = state.imageModalItemId;
      els.imageModalFile.click();
    });
  }
  if (els.imageModalCamera) {
    els.imageModalCamera.addEventListener("click", () => {
      if (!els.imageModalCameraInput || !state.imageModalItemId) return;
      els.imageModalCameraInput.dataset.itemId = state.imageModalItemId;
      els.imageModalCameraInput.click();
    });
  }
  if (els.imageModalFind) {
    els.imageModalFind.addEventListener("click", toggleStockSearch);
  }
  if (els.stockSearchGo) {
    els.stockSearchGo.addEventListener("click", () => searchStockPhotos(els.stockSearchInput?.value));
  }
  if (els.stockSearchInput) {
    els.stockSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); searchStockPhotos(els.stockSearchInput.value); }
    });
  }
  if (els.imageModalReset) {
    els.imageModalReset.addEventListener("click", () => {
      if (state.imageModalItemId) removeAllImagesForItem(state.imageModalItemId);
    });
  }
  if (els.imageModalFile) {
    els.imageModalFile.addEventListener("change", () => {
      const id = els.imageModalFile.dataset.itemId;
      const file = els.imageModalFile.files?.[0];
      if (id && file) saveImageOverride(id, file);
      els.imageModalFile.value = "";
    });
  }
  if (els.imageModalCameraInput) {
    els.imageModalCameraInput.addEventListener("change", () => {
      const id = els.imageModalCameraInput.dataset.itemId;
      const file = els.imageModalCameraInput.files?.[0];
      if (id && file) saveImageOverride(id, file);
      els.imageModalCameraInput.value = "";
    });
  }

  els.modeButtons.forEach((btn) => {
    onTap(btn, () => {
      if (
        state.currentTrack === "vocab" ||
        state.currentTrack === "hiragana" ||
        state.currentTrack === "katakana"
      ) {
        els.modeButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.currentGameType = btn.dataset.gametype;
        if (state.currentGameType === "find") resetFindSession();
        startRound();
      }
    });
  });

  els.tileButtons.forEach((btn) => {
    onTap(btn, () => {
      const track = btn.dataset.track;
      if (track === "kanji") {
        alert("Kanji coming soon");
        return;
      }
      state.currentTrack = track;
      state.currentSection = "game";
      if (track === "vocab") els.trackLabel.textContent = "Vocabulary";
      else if (track === "hiragana") els.trackLabel.textContent = "Hiragana";
      else els.trackLabel.textContent = "Katakana";
      if (track === "vocab") {
        els.categoryLabel.textContent =
          state.categoryId === "mixed"
            ? "Mixed"
            : state.categories.find((c) => c.id === state.categoryId)?.label_en || "Mixed";
      } else {
        els.categoryLabel.textContent = "Kana";
      }
      updateModeButtonsForTrack(track);
      showGame();
      startRound();
    });
  });

  onTap(els.alphabetPrev, () => advanceAlphabet(-1));
  onTap(els.alphabetNext, () => advanceAlphabet(1));
  if (els.alphabetSpeak) {
    onTap(els.alphabetSpeak, () => {
      const set = getAlphabetSet();
      if (!set) return;
      const idx = state.alphabetIndex[state.currentTrack] || 0;
      speakAlphabetChar(set[idx]);
    });
  }
  if (els.alphabetSection) {
    let touchStartX = null;
    els.alphabetSection.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) touchStartX = e.touches[0].clientX;
    }, { passive: true });
    els.alphabetSection.addEventListener("touchend", (e) => {
      if (touchStartX == null) return;
      const dx = (e.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
      touchStartX = null;
      if (Math.abs(dx) > 50) advanceAlphabet(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  if (els.quizSpeak) {
    onTap(els.quizSpeak, () => {
      const set = getAlphabetSet();
      if (!set) return;
      speakAlphabetChar(set[state.alphabetIndex[state.currentTrack] || 0]);
    });
  }
  onTap(els.quizSkip, () => advanceQuizAuto());

  buildFindCountBar();
  setupInstallPrompt();
  setupLibraryControls();
  setupOnboarding();
  setupBranding();
}

function buildFindCountBar() {
  if (!els.findCountOptions) return;
  els.findCountOptions.innerHTML = "";
  for (let n = 3; n <= 10; n++) {
    const btn = document.createElement("button");
    btn.className = "find-count-btn";
    btn.textContent = String(n);
    btn.dataset.count = String(n);
    if (n === state.findCount) btn.classList.add("active");
    onTap(btn, () => {
      state.findCount = n;
      updateFindCountButtons();
      startRound();
    });
    els.findCountOptions.appendChild(btn);
  }
}

function updateFindCountButtons() {
  if (!els.findCountOptions) return;
  els.findCountOptions.querySelectorAll(".find-count-btn").forEach((b) => {
    b.classList.toggle("active", Number(b.dataset.count) === state.findCount);
  });
}

function setupLibraryControls() {
  if (els.libraryIdInput) els.libraryIdInput.value = state.libraryConfig.libraryId || "";
  if (els.libraryPinInput) els.libraryPinInput.value = state.libraryConfig.pin || "";
  updateLibraryStatusLabel();

  if (els.librarySaveBtn) {
    els.librarySaveBtn.addEventListener("click", () => {
      const id = (els.libraryIdInput?.value || "").trim();
      const pin = (els.libraryPinInput?.value || "").trim();
      if (!id || !/^\d{4}$/.test(pin)) {
        alert("Enter a Library ID and a 4-digit PIN to switch.");
        return;
      }
      if (!confirm("Switching libraries will clear photos on this device and load the shared library. Continue?")) return;
      applyLibrarySwitch(id, pin).then(updateLibraryStatusLabel);
    });
  }
  if (els.libraryResetBtn) {
    els.libraryResetBtn.addEventListener("click", () => {
      if (!confirm("Reset to private device library? Photos already on the cloud library are not deleted; this device will go back to its own library.")) return;
      if (els.libraryIdInput) els.libraryIdInput.value = "";
      if (els.libraryPinInput) els.libraryPinInput.value = "";
      applyLibrarySwitch("", "").then(updateLibraryStatusLabel);
    });
  }
}

function updateLibraryStatusLabel() {
  if (!els.libraryStatus) return;
  const id = (state.libraryConfig.libraryId || "").trim();
  const pin = (state.libraryConfig.pin || "").trim();
  if (id && pin) {
    els.libraryStatus.textContent = `Connected: "${id}" (PIN ${pin.replace(/./g, "•")})`;
  } else {
    els.libraryStatus.textContent = "Private device library (default)";
  }
}

let deferredInstallPrompt = null;
function setupInstallPrompt() {
  const dismissed = (() => {
    try { return localStorage.getItem("install-dismissed") === "1"; } catch { return false; }
  })();
  const isStandalone = window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  if (isStandalone) return;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (dismissed) return;
    showInstallBanner("Install Kitai Words for offline play!", true);
  });

  window.addEventListener("appinstalled", () => {
    if (els.installBanner) els.installBanner.classList.add("hidden");
    deferredInstallPrompt = null;
  });

  if (els.installBtn) {
    els.installBtn.addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;
      els.installBanner.classList.add("hidden");
      deferredInstallPrompt.prompt();
      try { await deferredInstallPrompt.userChoice; } catch (_) {}
      deferredInstallPrompt = null;
    });
  }
  if (els.installDismiss) {
    els.installDismiss.addEventListener("click", () => {
      els.installBanner.classList.add("hidden");
      try { localStorage.setItem("install-dismissed", "1"); } catch (_) {}
    });
  }

  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  if (isIOS && isSafari && !dismissed) {
    showInstallBanner("Install: tap the Share icon, then “Add to Home Screen”.", false);
  }
}

function showInstallBanner(message, withInstallButton) {
  if (!els.installBanner) return;
  if (els.installText) els.installText.textContent = message;
  if (els.installBtn) els.installBtn.classList.toggle("hidden", !withInstallButton);
  els.installBanner.classList.remove("hidden");
}

function buildImageManager() {
  if (!els.imageList) return;
  renderImageList();
}

function renderImageList() {
  if (!els.imageList) return;
  const term = (els.imageSearch?.value || "").toLowerCase().trim();
  els.imageList.innerHTML = "";

  if (els.imageCategoryPills) {
    els.imageCategoryPills.innerHTML = "";
    const makePill = (id, label) => {
      const btn = document.createElement("button");
      btn.className = "pill-btn";
      if (id === state.imageCategoryId) btn.classList.add("active");
      btn.textContent = label;
      btn.addEventListener("click", () => {
        state.imageCategoryId = id;
        renderImageList();
      });
      return btn;
    };
    els.imageCategoryPills.appendChild(makePill("all", "All"));
    state.categories.forEach((cat) => {
      els.imageCategoryPills.appendChild(makePill(cat.id, cat.label_en));
    });
  }

  const filteredItems = state.items.filter((item) => {
    const catOk = state.imageCategoryId === "all" || item.categoryId === state.imageCategoryId;
    if (!catOk) return false;
    if (!term) return true;
    const haystack = `${item.en} ${item.jaKana} ${item.jaRomaji} ${item.ko || ""} ${item.koRomaji || ""}`.toLowerCase();
    return haystack.includes(term);
  });

  filteredItems.forEach((item) => {
    const card = document.createElement("div");
    card.className = "image-card";
    const preview = document.createElement("div");
    preview.className = "image-preview";
    const arr = getOverrideEntries(item.id);
    if (arr.length > 0) {
      arr.slice(0, 3).forEach((entry, i) => {
        const t = document.createElement("img");
        t.src = entry.url;
        t.className = "image-thumb stack-" + i;
        t.alt = item.en;
        preview.appendChild(t);
      });
    } else {
      const img = document.createElement("img");
      applyDefaultImage(img, item);
      img.alt = item.en;
      img.className = "image-thumb";
      preview.appendChild(img);
    }
    card.appendChild(preview);

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = item.en;
    card.appendChild(title);

    const sub = document.createElement("div");
    sub.className = "subtitle";
    if (arr.length === 0) {
      sub.textContent = item.custom ? "Custom word" : "Default image";
    } else {
      sub.textContent = arr.length === 1 ? "1 custom photo" : `${arr.length} custom photos`;
    }
    card.appendChild(sub);

    const del = document.createElement("button");
    del.className = "word-delete";
    del.textContent = "✕";
    del.setAttribute("aria-label", `Remove word ${item.en}`);
    del.title = "Remove word from games";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      removeCustomItem(item.id);
    });
    card.appendChild(del);

    card.addEventListener("click", () => openImageModal(item));
    els.imageList.appendChild(card);
  });
}

function openImageModal(item) {
  if (!els.imageModal || !els.imageModalTitle) return;
  state.imageModalItemId = item.id;
  els.imageModalTitle.textContent = `${item.en} (${item.jaKana}${item.ko ? " · " + item.ko : ""})`;
  hideStockSearch();
  renderImageModalContent();
  els.imageModal.classList.remove("hidden");
}

function renderImageModalContent() {
  const itemId = state.imageModalItemId;
  if (!itemId) return;
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return;
  const arr = getOverrideEntries(itemId);
  if (els.imageModalPhotos) {
    els.imageModalPhotos.innerHTML = "";
    if (arr.length === 0) {
      const wrap = document.createElement("div");
      wrap.className = "modal-photo-wrap default";
      const img = document.createElement("img");
      applyDefaultImage(img, item);
      img.alt = item.en;
      img.className = "modal-photo";
      wrap.appendChild(img);
      const note = document.createElement("div");
      note.className = "modal-photo-note";
      note.textContent = item.photoUrl ? "Default photo" : "Default image";
      wrap.appendChild(note);
      els.imageModalPhotos.appendChild(wrap);
    } else {
      arr.forEach((entry) => {
        const wrap = document.createElement("div");
        wrap.className = "modal-photo-wrap";
        const img = document.createElement("img");
        img.src = entry.url;
        img.className = "modal-photo";
        wrap.appendChild(img);
        const x = document.createElement("button");
        x.className = "modal-photo-delete";
        x.textContent = "×";
        x.setAttribute("aria-label", "Delete photo");
        x.addEventListener("click", (e) => {
          e.stopPropagation();
          removeImageOverride(itemId, entry.imageId);
        });
        wrap.appendChild(x);
        els.imageModalPhotos.appendChild(wrap);
      });
    }
  }
  if (els.imageModalReset) {
    els.imageModalReset.disabled = arr.length === 0;
    els.imageModalReset.textContent = arr.length > 1 ? "Remove All" : "Reset";
  }
}

function closeImageModal() {
  state.imageModalItemId = null;
  if (els.imageModal) els.imageModal.classList.add("hidden");
  hideStockSearch();
}

// --- Stock photo search (Wikimedia Commons: free, no API key, CORS-friendly) ---

function hideStockSearch() {
  if (els.imageModalStock) els.imageModalStock.classList.add("hidden");
  if (els.stockSearchResults) els.stockSearchResults.innerHTML = "";
}

function toggleStockSearch() {
  if (!els.imageModalStock) return;
  const opening = els.imageModalStock.classList.contains("hidden");
  els.imageModalStock.classList.toggle("hidden", !opening);
  if (opening) {
    const item = state.items.find((i) => i.id === state.imageModalItemId);
    const q = item ? item.en : "";
    if (els.stockSearchInput) els.stockSearchInput.value = q;
    searchStockPhotos(q);
  }
}

async function searchStockPhotos(query) {
  const grid = els.stockSearchResults;
  if (!grid) return;
  const q = (query || "").trim();
  if (!q) { grid.innerHTML = ""; return; }
  grid.innerHTML = '<div class="stock-status">Searching…</div>';
  try {
    const url =
      "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*" +
      "&generator=search&gsrnamespace=6&gsrlimit=24&prop=imageinfo&iiprop=url|mime" +
      "&iiurlwidth=400&gsrsearch=" + encodeURIComponent(q + " -icon -logo -map -diagram");
    const res = await fetch(url);
    const data = await res.json();
    const pages = data.query && data.query.pages ? Object.values(data.query.pages) : [];
    const photos = pages
      .map((p) => p.imageinfo && p.imageinfo[0])
      .filter((ii) => ii && ii.thumburl && /image\/(jpeg|png|webp)/.test(ii.mime || ""))
      .slice(0, 18);
    grid.innerHTML = "";
    if (!photos.length) {
      grid.innerHTML = '<div class="stock-status">No photos found. Try a different word.</div>';
      return;
    }
    photos.forEach((ii) => {
      const btn = document.createElement("button");
      btn.className = "stock-result";
      const img = document.createElement("img");
      img.src = ii.thumburl;
      img.loading = "lazy";
      img.alt = "";
      btn.appendChild(img);
      onTap(btn, () => pickStockPhoto(ii.thumburl, btn));
      grid.appendChild(btn);
    });
  } catch (_) {
    grid.innerHTML = '<div class="stock-status">Search failed. Check your connection.</div>';
  }
}

async function pickStockPhoto(url, btnEl) {
  const itemId = state.imageModalItemId;
  if (!itemId) return;
  if (btnEl) btnEl.classList.add("picking");
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const ext = ((blob.type.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "")) || "jpg";
    const file = new File([blob], `stock-${itemId}-${Date.now()}.${ext}`, { type: blob.type || "image/jpeg" });
    await saveImageOverride(itemId, file); // stores offline + syncs to the library
    hideStockSearch();
  } catch (_) {
    if (btnEl) btnEl.classList.remove("picking");
    alert("Couldn't add that photo. Try another one.");
  }
}

function setActiveModeButton(type) {
  els.modeButtons.forEach((b) => b.classList.remove("active"));
  const match = Array.from(els.modeButtons).find((b) => b.dataset.gametype === type);
  if (match) match.classList.add("active");
}

function updateModeButtonsForTrack(track) {
  const [btn1, btn2, btn3, btn4] = els.modeButtons;
  if (track === "vocab") {
    if (els.categoryQuick) els.categoryQuick.parentElement.classList.remove("hidden");
    btn1.dataset.gametype = "tap";
    btn1.textContent = "Listen & Tap";
    btn1.classList.remove("hidden");
    btn1.disabled = false;
    btn2.dataset.gametype = "drag-complete";
    btn2.textContent = "Drag to Complete";
    btn2.classList.remove("hidden");
    btn2.disabled = false;
    if (btn3) {
      btn3.dataset.gametype = "find";
      btn3.textContent = "Find It 🔍";
      btn3.classList.remove("hidden");
      btn3.disabled = false;
    }
    if (btn4) btn4.classList.add("hidden");
    state.currentGameType = "tap";
    setActiveModeButton("tap");
  } else if (track === "hiragana" || track === "katakana") {
    if (els.categoryQuick) els.categoryQuick.parentElement.classList.add("hidden");
    btn1.dataset.gametype = "kana-tap";
    btn1.textContent = "Sound & Pick";
    btn1.classList.remove("hidden");
    btn1.disabled = false;
    btn2.dataset.gametype = "kana-complete";
    btn2.textContent = "Drag to Complete";
    btn2.classList.remove("hidden");
    btn2.disabled = false;
    if (btn3) {
      btn3.dataset.gametype = "kana-alphabet";
      btn3.textContent = "Alphabet";
      btn3.classList.remove("hidden");
      btn3.disabled = false;
    }
    if (btn4) {
      btn4.dataset.gametype = "kana-alphabet-quiz";
      btn4.textContent = "Quiz";
      btn4.classList.remove("hidden");
      btn4.disabled = false;
    }
    state.currentGameType = "kana-tap";
    setActiveModeButton("kana-tap");
  } else {
    if (els.categoryQuick) els.categoryQuick.parentElement.classList.add("hidden");
    els.modeButtons.forEach((b) => (b.disabled = true));
  }
}

function startLongPress() {
  state.longPressTimer = setTimeout(showSettings, state.longPressMs);
}

function cancelLongPress() {
  clearTimeout(state.longPressTimer);
}

function showSettings() {
  els.overlay.classList.remove("hidden");
  updateWordSyncIndicator();
}

function hideSettings() {
  els.overlay.classList.add("hidden");
}

function goHome() {
  state.currentSection = "home";
  els.homeScreen.classList.remove("hidden");
  els.gameScreen.classList.add("hidden");
}

function showGame() {
  state.currentSection = "game";
  els.homeScreen.classList.add("hidden");
  els.gameScreen.classList.remove("hidden");
}

function pickPool() {
  if (state.categoryId === "mixed") return [...state.items];
  return state.items.filter((i) => i.categoryId === state.categoryId);
}

function chooseRoundItems() {
  const pool = pickPool();
  const count = state.currentGameType === "find" ? state.findCount : state.choiceCount;

  let target;
  if (state.currentGameType === "find") {
    // Stay on the same word for findRepsTarget rounds, then pick a new one.
    const needNewWord =
      !state.findTarget ||
      !pool.some((i) => i.id === state.findTarget.id) ||
      state.findRepsDone >= state.findRepsTarget;
    if (needNewWord) {
      const candidates = state.findTarget
        ? pool.filter((i) => i.id !== state.findTarget.id)
        : pool;
      const fromPool = candidates.length ? candidates : pool;
      state.findTarget = fromPool[Math.floor(Math.random() * fromPool.length)];
      state.findRepsTarget = 5 + Math.floor(Math.random() * 3); // 5, 6, or 7 times
      state.findRepsDone = 0;
    }
    target = state.findTarget;
  } else {
    target = pool[Math.floor(Math.random() * pool.length)];
  }

  const others = pool.filter((i) => i.id !== target.id);
  shuffle(others);

  const needed = Math.max(1, count - 1);
  const distractors = others.slice(0, needed);
  const choices = shuffle([target, ...distractors]).slice(0, count);

  state.currentTarget = target;
  state.currentChoices = choices;
}

function resetFindSession() {
  state.findTarget = null;
  state.findRepsTarget = 0;
  state.findRepsDone = 0;
}

function chooseKanaRound() {
  const set = state.currentTrack === "katakana"
    ? { chars: state.kataChars, words: state.kataWords }
    : { chars: state.kanaChars, words: state.kanaWords };

  if (state.currentGameType === "kana-tap") {
    const pool = set.chars;
    const target = pool[Math.floor(Math.random() * pool.length)];
    const others = pool.filter((c) => c.id !== target.id);
    shuffle(others);
    const needed = Math.max(1, state.choiceCount - 1);
    const distractors = others.slice(0, needed);
    const choices = shuffle([target, ...distractors]).slice(0, state.choiceCount);
    state.currentTarget = target;
    state.currentChoices = choices;
  } else {
    const pool = set.words;
    const target = pool[Math.floor(Math.random() * pool.length)];
    state.currentTarget = target;
  }
}

function startRound() {
  if (state.currentSection !== "game") return;
  if (state.currentGameType === "kana-alphabet" || state.currentGameType === "kana-alphabet-quiz") {
    renderCurrentView();
    return;
  }
  if (state.currentTrack === "vocab") {
    if (!pickPool().length) {
      // Parent removed every word in this category — don't crash, just guide.
      els.feedback.textContent = "No words here yet. Add or restore some in Parent Settings.";
      if (els.cards) els.cards.innerHTML = "";
      if (els.promptWord) els.promptWord.textContent = "—";
      return;
    }
    chooseRoundItems();
  } else if (state.currentTrack === "hiragana" || state.currentTrack === "katakana") {
    chooseKanaRound();
  }
  renderCurrentView();
  speakCurrent();
}

function renderCurrentView() {
  els.feedback.textContent = "";
  if (state.currentTrack === "vocab") {
    if (state.currentGameType === "tap") {
      renderTapView();
    } else if (state.currentGameType === "find") {
      renderFindView();
    } else {
      renderDragCompleteView();
    }
  } else if (state.currentTrack === "hiragana" || state.currentTrack === "katakana") {
    if (state.currentGameType === "kana-tap") {
      renderKanaTapView();
    } else if (state.currentGameType === "kana-complete") {
      renderKanaCompleteView();
    } else if (state.currentGameType === "kana-alphabet") {
      renderAlphabetView();
    } else if (state.currentGameType === "kana-alphabet-quiz") {
      renderAlphabetQuizView();
    }
  }
}

function showPromptArea(show) {
  if (!els.promptArea) return;
  els.promptArea.classList.toggle("hidden", !show);
}

function hideAllGameViews() {
  els.cards.classList.add("hidden");
  els.dropzoneSection.classList.add("hidden");
  els.completeWordSection.classList.add("hidden");
  if (els.findCountBar) els.findCountBar.classList.add("hidden");
  if (els.alphabetSection) els.alphabetSection.classList.add("hidden");
  if (els.alphabetQuizSection) els.alphabetQuizSection.classList.add("hidden");
}

function renderTapView() {
  els.modeLabel.textContent = "Listen & Tap";
  hideAllGameViews();
  showPromptArea(true);
  els.cards.classList.remove("hidden");
  renderCards(state.currentChoices);
  els.promptWord.textContent = wordText(state.currentTarget);
}

function renderFindView() {
  els.modeLabel.textContent = "Find It";
  hideAllGameViews();
  showPromptArea(true);
  if (els.findCountBar) els.findCountBar.classList.remove("hidden");
  updateFindCountButtons();
  els.cards.classList.remove("hidden");
  renderCards(state.currentChoices);
  els.promptWord.textContent = wordText(state.currentTarget);
}

function renderDragCompleteView() {
  els.modeLabel.textContent = "Drag to Complete";
  hideAllGameViews();
  showPromptArea(true);
  els.completeWordSection.classList.remove("hidden");
  buildDragCompleteRound(state.currentTarget);
}

function renderKanaTapView() {
  els.modeLabel.textContent = "Sound & Pick";
  hideAllGameViews();
  showPromptArea(true);
  els.cards.classList.remove("hidden");
  renderKanaCards(state.currentChoices);
  els.promptWord.textContent = "🔊 Listen & pick";
}

function renderKanaCompleteView() {
  els.modeLabel.textContent = "Drag to Complete";
  hideAllGameViews();
  showPromptArea(true);
  els.completeWordSection.classList.remove("hidden");
  buildKanaCompleteRound(state.currentTarget);
}

function getAlphabetSet() {
  return state.currentTrack === "katakana" ? state.kataChars : state.kanaChars;
}

function renderAlphabetView() {
  els.modeLabel.textContent = "Alphabet";
  hideAllGameViews();
  showPromptArea(false);
  if (!els.alphabetSection) return;
  els.alphabetSection.classList.remove("hidden");
  const set = getAlphabetSet();
  if (!set || set.length === 0) return;
  const trackKey = state.currentTrack;
  let idx = state.alphabetIndex[trackKey] || 0;
  if (idx >= set.length) idx = 0;
  state.alphabetIndex[trackKey] = idx;
  const ch = set[idx];
  els.alphabetEmoji.textContent = ch.exampleEmoji || "";
  els.alphabetKana.textContent = ch.kana;
  els.alphabetExampleWord.textContent = ch.exampleWord || "";
  els.alphabetExampleRomaji.textContent = ch.exampleRomaji || "";
  els.alphabetExampleEn.textContent = ch.exampleEn || "";
  els.alphabetProgress.textContent = `${idx + 1} / ${set.length}`;
  els.alphabetPrev.disabled = idx === 0;
  els.alphabetNext.disabled = idx === set.length - 1;
  speakAlphabetChar(ch);
}

function speakAlphabetChar(ch) {
  if (!ch) return;
  const phrase = ch.exampleWord ? `${ch.kana}。${ch.exampleWord}` : ch.kana;
  speakText(phrase);
}

// iOS Safari stays silent until speechSynthesis is "unlocked" by a real user
// gesture. Speak a tiny silent utterance on the first touch so later spoken
// words (speak button, card reveals) actually produce audio.
let speechPrimed = false;
function primeSpeech() {
  if (speechPrimed || !("speechSynthesis" in window)) return;
  try {
    speechSynthesis.resume();
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    speechSynthesis.speak(u);
    speechPrimed = true;
  } catch (_) {}
}

function pickJaVoice(preferLocal) {
  const voices = speechSynthesis.getVoices();
  const prefix = langCfg().prefix;
  const matches = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith(prefix));
  // Honor the saved voice only if it belongs to the current language.
  if (state.voiceId) {
    const saved = matches.find((v) => v.voiceURI === state.voiceId);
    if (saved) return saved;
  }
  if (preferLocal) {
    const local = matches.find((v) => v.localService);
    if (local) return local;
  }
  return matches[0] || null;
}

// Online voice via VoiceRSS (https://www.voicerss.org) — a real TTS service
// that reliably serves Japanese audio with a free API key. Played through an
// <audio> element so the app speaks even when the device TTS engine is broken.
function onlineTtsUrls(text) {
  const key = (state.ttsApiKey || "").trim();
  if (!key) return [];
  const params = new URLSearchParams({
    key,
    hl: langCfg().hl,
    c: "MP3",
    f: "44khz_16bit_mono",
    r: "0",
    src: text,
  });
  return [`https://api.voicerss.org/?${params.toString()}`];
}

let onlineAudio = null;
function playOnlineTts(phrase, handlers) {
  const urls = onlineTtsUrls(phrase);
  let i = 0;
  const attempt = () => {
    if (i >= urls.length) {
      if (handlers.onFail) handlers.onFail(state.ttsApiKey ? "online-unavailable" : "no-api-key");
      return;
    }
    const url = urls[i++];
    const audio = new Audio();
    let advanced = false;
    const next = () => {
      if (advanced) return;
      advanced = true;
      attempt();
    };
    audio.addEventListener("playing", () => {
      advanced = true;
      if (handlers.onStart) handlers.onStart();
    }, { once: true });
    audio.addEventListener("error", next, { once: true });
    audio.src = url;
    const p = audio.play();
    if (p && p.catch) p.catch(() => next());
    onlineAudio = audio;
  };
  attempt();
}

// Robust device TTS with retry. Android/Chrome (especially Samsung) throws
// "synthesis-failed" intermittently, and a specific voice can fail while the
// OS-default engine works. So we: (1) put a tick between cancel() and speak()
// to dodge the cancel→speak race, and (2) retry on failure, dropping the
// explicit voice on later attempts so the system routes to its default engine.
function deviceSpeak(phrase, handlers) {
  const synth = speechSynthesis;
  const maxAttempts = 3;
  let attempt = 0;
  const run = () => {
    attempt++;
    const utter = new SpeechSynthesisUtterance(phrase);
    utter.lang = langCfg().speech;
    utter.rate = 0.9;
    if (attempt === 1) {
      const v = pickJaVoice(true);
      if (v) utter.voice = v;
    }
    utter.onstart = () => handlers.onStart && handlers.onStart();
    utter.onerror = (e) => {
      const err = (e && e.error) || "unknown";
      if (err === "interrupted" || err === "canceled") return; // our cancel / re-tap
      if ((err === "synthesis-failed" || err === "audio-busy" || err === "network") && attempt < maxAttempts) {
        setTimeout(run, 250);
        return;
      }
      handlers.onFail && handlers.onFail(err);
    };
    try { synth.cancel(); } catch (_) {}
    setTimeout(() => {
      try {
        synth.resume();
        synth.speak(utter);
      } catch (err) {
        handlers.onFail && handlers.onFail((err && err.message) || "exception");
      }
    }, attempt === 1 ? 50 : 200);
  };
  run();
}

// Top-level speak: device voice first (offline-friendly), online voice as a
// fallback — or online first when the parent turns on "Prefer online voice".
function synthesize(phrase, opts) {
  opts = opts || {};
  const showErrors = !!opts.showErrors;
  const onStatus = typeof opts.onStatus === "function" ? opts.onStatus : null;
  if (!phrase) return;

  const succeed = (kind) => {
    if (onStatus) onStatus("start", kind);
    else if (showErrors) els.feedback.textContent = "";
  };
  const failFinal = (err) => {
    if (onStatus) onStatus("error", err);
    else if (showErrors) {
      els.feedback.textContent =
        err === "no-api-key"
          ? `No voice available. Add a free online-voice key in Parent Settings (Voice → "Online voice key").`
          : `Voice error (${err}). Check your internet, or add/verify the online-voice key in Parent Settings.`;
    }
  };
  const goOnline = (origErr) =>
    playOnlineTts(phrase, { onStart: () => succeed("online"), onFail: () => failFinal(origErr || "online-unavailable") });

  if (state.preferOnlineVoice || !("speechSynthesis" in window)) {
    goOnline("device-unavailable");
    return;
  }
  deviceSpeak(phrase, { onStart: () => succeed("device"), onFail: (err) => goOnline(err) });
}

// Parent Settings: speak a sample and report whether the voice works. When an
// online-voice key is set, validate it directly (VoiceRSS returns a readable
// "ERROR: ..." message for a bad/missing key); otherwise test the device voice.
async function testVoice() {
  const el = els.voiceTestStatus;
  if (!el) return;
  const key = (state.ttsApiKey || "").trim();

  if (key) {
    el.style.color = "#5a5564";
    el.textContent = "🔊 Testing online voice…";
    const url = onlineTtsUrls(langCfg().sample)[0];
    try {
      const res = await fetch(url, { cache: "no-store" });
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (res.ok && ct.includes("audio")) {
        try { onlineAudio = new Audio(url); onlineAudio.play().catch(() => {}); } catch (_) {}
        el.style.color = "#2a9d8f";
        el.textContent = "✓ Online voice working!";
      } else {
        const txt = (await res.text()).trim();
        el.style.color = "#d62828";
        el.textContent = `⚠ ${txt.slice(0, 140) || "Online voice failed — check your API key."}`;
      }
    } catch (_) {
      // A CORS/network error blocked the diagnostic; just try to play it.
      playOnlineTts(langCfg().sample, {
        onStart: () => { el.style.color = "#2a9d8f"; el.textContent = "✓ Online voice working!"; },
        onFail: () => { el.style.color = "#d62828"; el.textContent = "⚠ Couldn't reach the online voice. Check your internet and the key."; },
      });
    }
    return;
  }

  const voices = ("speechSynthesis" in window) ? speechSynthesis.getVoices() : [];
  const prefix = langCfg().prefix;
  const matches = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith(prefix));
  const chosen = ("speechSynthesis" in window) ? pickJaVoice(true) : null;
  const desc = chosen
    ? `${chosen.name} (${chosen.lang}, ${chosen.localService ? "offline" : "network"})`
    : `no device ${langCfg().label} voice`;
  const info = `Device voice: ${desc} · ${matches.length} ${prefix.toUpperCase()} / ${voices.length} total.`;
  el.style.color = "#5a5564";
  el.textContent = `${info} 🔊 Speaking…`;
  synthesize(langCfg().sample, {
    showErrors: true,
    onStatus: (s, kind) => {
      if (s === "start") {
        el.style.color = "#2a9d8f";
        el.textContent = `${info} ✓ Working (${kind === "online" ? "online" : "device"} voice).`;
      } else if (s === "error") {
        el.style.color = "#d62828";
        el.textContent =
          `${info} ⚠ Still failed. Add a free online-voice key below (Voice → "Online voice key") and tap Test voice again.`;
      }
    },
  });
}

function speakText(text) {
  synthesize(text, { showErrors: false });
}

function advanceAlphabet(delta) {
  const set = getAlphabetSet();
  if (!set) return;
  const trackKey = state.currentTrack;
  const next = (state.alphabetIndex[trackKey] || 0) + delta;
  if (next < 0 || next >= set.length) return;
  state.alphabetIndex[trackKey] = next;
  renderAlphabetView();
}

function renderAlphabetQuizView() {
  els.modeLabel.textContent = "Quiz";
  hideAllGameViews();
  showPromptArea(false);
  if (!els.alphabetQuizSection) return;
  els.alphabetQuizSection.classList.remove("hidden");
  buildAlphabetQuizRound();
}

function buildAlphabetQuizRound() {
  const set = getAlphabetSet();
  if (!set || set.length === 0) return;
  const trackKey = state.currentTrack;
  let idx = state.alphabetIndex[trackKey] || 0;
  if (idx >= set.length) idx = 0;
  while (!set[idx].exampleEmoji && idx < set.length - 1) idx++;
  state.alphabetIndex[trackKey] = idx;
  const target = set[idx];

  els.quizKana.textContent = target.kana;
  els.quizFeedback.textContent = "";
  els.quizProgress.textContent = `${idx + 1} / ${set.length}`;

  const others = set.filter((c) => c.id !== target.id && c.exampleEmoji && c.exampleEmoji !== target.exampleEmoji);
  const distractors = shuffle([...others]).slice(0, 2);
  const choices = shuffle([target, ...distractors]);

  els.quizChoices.innerHTML = "";
  choices.forEach((ch) => {
    const btn = document.createElement("button");
    btn.className = "quiz-choice";
    btn.textContent = ch.exampleEmoji;
    btn.dataset.id = ch.id;
    btn.setAttribute("aria-label", ch.exampleEn || ch.kana);
    onTap(btn, () => handleQuizChoice(ch, target, btn));
    els.quizChoices.appendChild(btn);
  });

  speakAlphabetChar(target);
}

function handleQuizChoice(chosen, target, btn) {
  if (tapsLocked()) return;
  if (chosen.id === target.id) {
    state.lockUntil = Date.now() + 1100 + ROUND_DEAD_MS;
    btn.classList.add("correct");
    els.quizFeedback.textContent = `${target.exampleWord || target.kana} — ${target.exampleEn || ""}`.trim();
    playCorrect();
    showCorrectOverlay();
    setTimeout(() => advanceQuizAuto(), 1100);
  } else {
    state.lockUntil = Date.now() + WRONG_DEAD_MS;
    btn.classList.add("wrong");
    setTimeout(() => btn.classList.remove("wrong"), 500);
    buzz();
    showWrongOverlay();
    setTimeout(() => speakAlphabetChar(target), REPEAT_MS); // hear the sound again
  }
}

function advanceQuizAuto() {
  const set = getAlphabetSet();
  if (!set) return;
  const trackKey = state.currentTrack;
  let next = (state.alphabetIndex[trackKey] || 0) + 1;
  while (next < set.length && !set[next].exampleEmoji) next++;
  if (next >= set.length) next = 0;
  state.alphabetIndex[trackKey] = next;
  buildAlphabetQuizRound();
}

function renderCards(items) {
  els.cards.innerHTML = "";
  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.id = item.id;

    const img = document.createElement("img");
    applyItemImage(img, item);
    img.alt = item.en;
    card.appendChild(img);

    const ja = document.createElement("div");
    ja.className = "label-ja";
    ja.textContent = wordText(item);
    card.appendChild(ja);

    const label = document.createElement("div");
    label.className = "label-en";
    label.textContent = wordSubLabel(item);
    card.appendChild(label);

    onTap(card, () => handleTap(item, card));
    els.cards.appendChild(card);
  });
}

function renderKanaCards(items) {
  els.cards.innerHTML = "";
  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card kana";
    card.dataset.id = item.id;

    const ja = document.createElement("div");
    ja.className = "label-ja";
    ja.textContent = item.kana;
    card.appendChild(ja);

    const label = document.createElement("div");
    label.className = "label-en";
    label.textContent = state.romaji ? item.romaji : "";
    card.appendChild(label);

    onTap(card, () => handleKanaTap(item, card));
    els.cards.appendChild(card);
  });
}

// Timings for answer handling. CORRECT_ADVANCE_MS = pause on a right answer
// before the next word; ROUND_DEAD_MS = extra dead time after the new word
// appears so buffered taps can't auto-answer it; WRONG_DEAD_MS = brief lockout
// after a wrong answer so mashing doesn't spam the buzzer/repeat; REPEAT_MS =
// delay before re-speaking the word after a mistake.
const CORRECT_ADVANCE_MS = 800;
const ROUND_DEAD_MS = 450;
const WRONG_DEAD_MS = 650;
const REPEAT_MS = 500;

function tapsLocked() {
  return Date.now() < state.lockUntil;
}

// Lock taps through the advance pause AND a dead window after the next word
// renders, so a flurry of taps can't bleed into the new round.
function lockForCorrectAdvance() {
  state.lockUntil = Date.now() + CORRECT_ADVANCE_MS + ROUND_DEAD_MS;
}

function handleTap(item, cardEl) {
  if (tapsLocked()) return;
  if (item.id === state.currentTarget.id) {
    lockForCorrectAdvance();
    cardEl.classList.add("correct");
    els.feedback.textContent = "Great!";
    if (state.currentGameType === "find") state.findRepsDone++;
    playCorrect();
    showCorrectOverlay();
    setTimeout(() => startRound(), CORRECT_ADVANCE_MS);
  } else {
    state.lockUntil = Date.now() + WRONG_DEAD_MS;
    cardEl.classList.add("wrong");
    els.feedback.textContent = "Try again!";
    buzz();
    showWrongOverlay();
    setTimeout(() => cardEl.classList.remove("wrong"), 400);
    setTimeout(() => speakCurrent(), REPEAT_MS); // hear the word again after the buzzer
  }
}

function renderSplitWordDisplay(chars, missingIndex, missingChar) {
  els.completeWordDisplay.innerHTML = "";
  const prefix = chars.slice(0, missingIndex).join("");
  const suffix = chars.slice(missingIndex + 1).join("");
  if (prefix) {
    const left = document.createElement("span");
    left.className = "word-section";
    left.textContent = prefix;
    els.completeWordDisplay.appendChild(left);
  }
  const slot = document.createElement("span");
  slot.className = "letter-cell blank-slot";
  slot.dataset.missing = missingChar;
  els.completeWordDisplay.appendChild(slot);
  if (suffix) {
    const right = document.createElement("span");
    right.className = "word-section";
    right.textContent = suffix;
    els.completeWordDisplay.appendChild(right);
  }
}

function buildDragCompleteRound(target) {
  const chars = Array.from(wordText(target));
  const missingIndex = Math.floor(Math.random() * chars.length);
  const missingChar = chars[missingIndex];
  state.currentKanaMissing = missingChar;
  renderSplitWordDisplay(chars, missingIndex, missingChar);
  els.promptWord.textContent = state.lang === "en" ? "Spell it!" : target.en;

  const poolChars = Array.from(new Set(pickPool().flatMap((i) => Array.from(wordText(i)))));
  const distractors = shuffle(poolChars.filter((c) => c !== missingChar)).slice(0, 3);
  let options = shuffle([missingChar, ...distractors]).slice(0, 3);
  if (!options.includes(missingChar)) {
    options.pop();
    options.push(missingChar);
    options = shuffle(options);
  }

  els.completeChoices.innerHTML = "";
  options.forEach((opt) => {
    const chip = document.createElement("div");
    chip.className = "choice-chip";
    chip.textContent = opt;
    chip.addEventListener("pointerdown", (e) => handleChipDragStart(e, chip, opt));
    chip.addEventListener("click", () => {
      const slot = els.completeWordDisplay.querySelector(".blank-slot");
      if (slot && !chip.dataset.dragMoved) handleDropOnBlank(slot, missingChar, target, opt);
      delete chip.dataset.dragMoved;
    });
    els.completeChoices.appendChild(chip);
  });
}

function buildKanaCompleteRound(word) {
  const chars = Array.from(word.kana);
  const missingIndex = Math.floor(Math.random() * chars.length);
  const missingChar = chars[missingIndex];
  state.currentKanaMissing = missingChar;
  renderSplitWordDisplay(chars, missingIndex, missingChar);
  els.promptWord.textContent = word.romaji;

  const poolChars = Array.from(new Set(state.kanaChars.map((c) => c.kana)));
  if (state.currentTrack === "katakana") {
    const kataSet = Array.from(new Set(state.kataChars.map((c) => c.kana)));
    poolChars.splice(0, poolChars.length, ...kataSet);
  }
  const distractors = shuffle(poolChars.filter((c) => c !== missingChar)).slice(0, 3);
  let options = shuffle([missingChar, ...distractors]).slice(0, 3);
  if (!options.includes(missingChar)) {
    options.pop();
    options.push(missingChar);
    options = shuffle(options);
  }

  els.completeChoices.innerHTML = "";
  options.forEach((opt) => {
    const chip = document.createElement("div");
    chip.className = "choice-chip";
    chip.textContent = opt;
    chip.addEventListener("pointerdown", (e) => handleChipDragStart(e, chip, opt));
    chip.addEventListener("click", () => {
      const slot = els.completeWordDisplay.querySelector(".blank-slot");
      if (slot && !chip.dataset.dragMoved) handleDropOnBlank(slot, missingChar, word, opt);
      delete chip.dataset.dragMoved;
    });
    els.completeChoices.appendChild(chip);
  });
}

function handleCompleteChoice(opt, missingChar, target) {
  if (opt === missingChar) {
    const slot = els.completeWordDisplay.querySelector(".blank-slot");
    if (slot) slot.textContent = missingChar;
    els.feedback.textContent = "Great!";
    playCorrect();
    showCorrectOverlay();
    setTimeout(() => startRound(), 900);
  } else {
    els.feedback.textContent = "Try again!";
    buzz();
    showWrongOverlay();
    setTimeout(() => speakCurrent(), REPEAT_MS); // hear the word again after the buzzer
  }
}

function handleKanaTap(item, cardEl) {
  if (tapsLocked()) return;
  if (item.id === state.currentTarget.id) {
    lockForCorrectAdvance();
    cardEl.classList.add("correct");
    els.feedback.textContent = "Great!";
    playCorrect();
    showCorrectOverlay();
    setTimeout(() => startRound(), CORRECT_ADVANCE_MS);
  } else {
    state.lockUntil = Date.now() + WRONG_DEAD_MS;
    cardEl.classList.add("wrong");
    els.feedback.textContent = "Try again!";
    buzz();
    showWrongOverlay();
    setTimeout(() => cardEl.classList.remove("wrong"), 400);
    setTimeout(() => speakCurrent(), REPEAT_MS); // hear the sound again after the buzzer
  }
}

function handleKanaCompleteChoice(opt, missingChar) {
  if (opt === missingChar) {
    const slot = els.completeWordDisplay.querySelector(".blank-slot");
    if (slot) slot.textContent = missingChar;
    els.feedback.textContent = "Great!";
    playCorrect();
    showCorrectOverlay();
    setTimeout(() => startRound(), 900);
  } else {
    els.feedback.textContent = "Try again!";
    buzz();
    showWrongOverlay();
    setTimeout(() => speakCurrent(), REPEAT_MS); // hear the word again after the buzzer
  }
}

let dragData = { item: null, el: null };
let wrongOverlayTimer = null;
let dragOptionData = { value: null, el: null, startX: 0, startY: 0 };
let dragOptionHoverSlot = null;

function handleDragStart(e, cardEl, item) {
  dragData = { item, el: cardEl };
  cardEl.setPointerCapture(e.pointerId);
  cardEl.classList.add("dragging");
  els.dropzone.textContent = "Drop here";
  cardEl.addEventListener("pointermove", handleDragMove);
  cardEl.addEventListener("pointerup", handleDragEnd);
}

function handleDragMove() {}

function handleDragEnd(e) {
  const cardEl = dragData.el;
  cardEl.releasePointerCapture(e.pointerId);
  cardEl.classList.remove("dragging");
  cardEl.removeEventListener("pointermove", handleDragMove);
  cardEl.removeEventListener("pointerup", handleDragEnd);
  dragData = { item: null, el: null };
}

let chipDragPointerId = null;
const DRAG_THRESHOLD_PX = 6;

function handleChipDragStart(e, chipEl, value) {
  if (e.button != null && e.button !== 0) return;
  e.preventDefault();
  dragOptionData = { value, el: chipEl, startX: e.clientX, startY: e.clientY };
  chipDragPointerId = e.pointerId;
  document.addEventListener("pointermove", handleChipDragMove);
  document.addEventListener("pointerup", handleChipDragEnd);
  document.addEventListener("pointercancel", handleChipDragEnd);
}

function handleChipDragMove(e) {
  if (chipDragPointerId != null && e.pointerId !== chipDragPointerId) return;
  const chipEl = dragOptionData.el;
  if (!chipEl) return;
  const dx = e.clientX - dragOptionData.startX;
  const dy = e.clientY - dragOptionData.startY;
  if (!chipEl.classList.contains("dragging")) {
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    chipEl.classList.add("dragging");
    chipEl.dataset.dragMoved = "true";
  }
  chipEl.style.transform = `translate(${dx}px, ${dy}px)`;
  const targetEl = document.elementFromPoint(e.clientX, e.clientY);
  const slot = targetEl?.closest(".blank-slot");
  if (slot !== dragOptionHoverSlot) {
    if (dragOptionHoverSlot) dragOptionHoverSlot.classList.remove("hover");
    dragOptionHoverSlot = slot || null;
    if (dragOptionHoverSlot) dragOptionHoverSlot.classList.add("hover");
  }
}

function handleChipDragEnd(e) {
  if (chipDragPointerId != null && e.pointerId !== chipDragPointerId) return;
  document.removeEventListener("pointermove", handleChipDragMove);
  document.removeEventListener("pointerup", handleChipDragEnd);
  document.removeEventListener("pointercancel", handleChipDragEnd);
  chipDragPointerId = null;
  const chipEl = dragOptionData.el;
  if (!chipEl) return;
  const wasDragging = chipEl.classList.contains("dragging");
  const dropTarget = e.clientX != null ? document.elementFromPoint(e.clientX, e.clientY) : null;
  const slot = dragOptionHoverSlot || dropTarget?.closest(".blank-slot");
  const value = dragOptionData.value;
  if (dragOptionHoverSlot) dragOptionHoverSlot.classList.remove("hover");
  dragOptionHoverSlot = null;
  chipEl.classList.remove("dragging");
  chipEl.style.transform = "";
  dragOptionData = { value: null, el: null, startX: 0, startY: 0 };
  if (wasDragging && slot) handleDropOnBlank(slot, slot.dataset.missing, state.currentTarget, value);
}

function handleDropOnBlank(slotEl, missingChar, target, chosenOverride = null) {
  const chosen = chosenOverride || dragOptionData.value;
  if (!chosen) return;
  if (chosen === missingChar) {
    slotEl.textContent = missingChar;
    els.feedback.textContent = "Great!";
    playCorrect();
    showCorrectOverlay();
    setTimeout(() => startRound(), 900);
  } else {
    els.feedback.textContent = "Try again!";
    buzz();
    showWrongOverlay();
    setTimeout(() => speakCurrent(), REPEAT_MS); // hear the word again after the buzzer
  }
}

function onDropZonePointerUp() {
  if (!dragData.item) return;
  const item = dragData.item;
  if (item.id === state.currentTarget.id) {
    dragData.el.classList.add("correct");
    els.dropzone.textContent = "Nice!";
    playCorrect();
    showCorrectOverlay();
    setTimeout(() => startRound(), 800);
  } else {
    dragData.el.classList.add("wrong");
    els.dropzone.textContent = "Try again!";
    buzz();
    showWrongOverlay();
    setTimeout(() => speakCurrent(), REPEAT_MS); // hear the word again after the buzzer
    setTimeout(() => {
      dragData.el.classList.remove("wrong");
      els.dropzone.textContent = "Drop here";
    }, 500);
  }
}

function speakCurrent() {
  if (!state.currentTarget) return;

  const phrase =
    state.currentTrack === "hiragana" || state.currentTrack === "katakana"
      ? state.currentTarget.kana || state.currentTarget.romaji
      : wordText(state.currentTarget);

  synthesize(phrase, { showErrors: true });
}

let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function buzz() {
  if (!state.soundEnabled) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const duration = 0.55;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.9, now);
  master.gain.setValueAtTime(0.9, now + duration - 0.05);
  master.gain.exponentialRampToValueAtTime(0.001, now + duration);
  master.connect(ctx.destination);

  // Square-wave fundamentals for that harsh game-show buzzer feel
  [
    { freq: 110, type: "square", gain: 0.5 },
    { freq: 220, type: "square", gain: 0.35 },
    { freq: 73, type: "sawtooth", gain: 0.4 },
  ].forEach(({ freq, type, gain }) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(gain, now);
    osc.connect(g).connect(master);
    osc.start(now);
    osc.stop(now + duration);
  });

  // Amplitude tremolo to give it the ratchety buzz texture
  const tremolo = ctx.createOscillator();
  const tremGain = ctx.createGain();
  tremolo.frequency.value = 28;
  tremolo.type = "square";
  tremGain.gain.value = 0.5;
  tremolo.connect(tremGain).connect(master.gain);
  tremolo.start(now);
  tremolo.stop(now + duration);

  if (state.vibration && "vibrate" in navigator) navigator.vibrate([200, 80, 200]);
}

function playCorrect() {
  if (!state.soundEnabled) return;
  playBellTone(659.25, 1.0, 0);
  playBellTone(523.25, 1.3, 0.28);
}

function playBellTone(freq, duration, delay = 0) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const start = ctx.currentTime + delay;
  const fundamental = ctx.createOscillator();
  const overtone = ctx.createOscillator();
  const gain = ctx.createGain();
  const overtoneGain = ctx.createGain();
  fundamental.type = "sine";
  overtone.type = "sine";
  fundamental.frequency.value = freq;
  overtone.frequency.value = freq * 2.76;
  overtoneGain.gain.value = 0.22;
  fundamental.connect(gain);
  overtone.connect(overtoneGain).connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.55, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  fundamental.start(start);
  overtone.start(start);
  fundamental.stop(start + duration);
  overtone.stop(start + duration);
}

function showWrongOverlay() {
  if (!els.wrongOverlay) return;
  els.wrongOverlay.classList.remove("hidden");
  clearTimeout(wrongOverlayTimer);
  wrongOverlayTimer = setTimeout(() => {
    els.wrongOverlay.classList.add("hidden");
  }, 700);
}

let correctOverlayTimer = null;
function showCorrectOverlay() {
  if (!els.correctOverlay) return;
  els.correctOverlay.classList.remove("hidden");
  clearTimeout(correctOverlayTimer);
  correctOverlayTimer = setTimeout(() => {
    els.correctOverlay.classList.add("hidden");
  }, 700);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  // Auto-reload once when a new service worker takes control, so a freshly
  // deployed version replaces the running one without a manual force-close.
  // Skip the first-ever install (which also fires controllerchange via claim()).
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading || !hadController) return;
    reloading = true;
    window.location.reload();
  });
  navigator.serviceWorker
    .register("service-worker.js")
    .then((reg) => {
      reg.update();
      // Check for updates whenever the app is brought back to the foreground.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update();
      });
    })
    .catch(() => {});
}
