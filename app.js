const state = {
  data: null,
  items: [],
  categories: [],
  currentSection: "home",
  currentTrack: "vocab",
  currentGameType: "tap", // tap | drag-complete | find | kana-tap | kana-complete
  choiceCount: 3,
  findCount: 6,
  categoryId: "mixed",
  romaji: false,
  vibration: true,
  voices: [],
  voiceId: null,
  currentTarget: null,
  currentChoices: [],
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
  theme: "default",
  imageOverrides: {},
  imageCategoryId: "all",
  imageModalItemId: null,
  alphabetIndex: { hiragana: 0, katakana: 0 },
  libraryConfig: { libraryId: "", pin: "" },
  storagePrefix: null,
};

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
};

const SUPABASE_URL = "https://nfaxncksesfcfqavmlae.supabase.co";
const SUPABASE_KEY = "sb_publishable_tOW43SppvjqItz5vGlLpiQ_W3t4CMR_";
const SUPABASE_BUCKET = "kitai-images";

document.addEventListener("DOMContentLoaded", init);

async function init() {
  loadLibraryConfig();
  await loadData();
  await loadHiragana();
  await loadKatakana();
  await loadImageOverrides();
  buildImageManager();
  await setupVoices();
  applyTheme();
  bindUI();
  registerServiceWorker();
  goHome();
  ensureStoragePrefix().then(() => syncImagesFromSupabase()).catch(() => {});
}

async function loadData() {
  const res = await fetch("data/vocab.json");
  state.data = await res.json();
  state.categories = state.data.categories;
  state.items = state.data.items;

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

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
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
  return item.imagePath;
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
}

function setupVoiceOptions() {
  els.voiceSelect.innerHTML = "";
  const voices = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.startsWith("ja"));
  state.voices = voices;

  if (!voices.length) {
    els.voiceWarning.classList.remove("hidden");
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No Japanese voice";
    els.voiceSelect.appendChild(opt);
    return;
  }

  els.voiceWarning.classList.add("hidden");
  voices.forEach((v, idx) => {
    const opt = document.createElement("option");
    opt.value = v.voiceURI;
    opt.textContent = `${v.name} (${v.lang})`;
    if (idx === 0) opt.selected = true;
    els.voiceSelect.appendChild(opt);
  });
  state.voiceId = voices[0]?.voiceURI || null;
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

function bindUI() {
  els.speakBtn.addEventListener("click", () => speakCurrent());
  els.parentBtn.addEventListener("pointerdown", startLongPress);
  els.parentBtn.addEventListener("pointerup", (e) => {
    cancelLongPress();
    showSettings();
  });
  els.parentBtn.addEventListener("click", showSettings);
  els.parentBtn.addEventListener("pointerleave", cancelLongPress);
  els.homeBtn.addEventListener("click", goHome);
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

  els.dropzone.addEventListener("pointerup", onDropZonePointerUp);

  if (els.imageSearch) {
    els.imageSearch.addEventListener("input", renderImageList);
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
    btn.addEventListener("click", () => {
      if (
        state.currentTrack === "vocab" ||
        state.currentTrack === "hiragana" ||
        state.currentTrack === "katakana"
      ) {
        els.modeButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.currentGameType = btn.dataset.gametype;
        startRound();
      }
    });
  });

  els.tileButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
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

  if (els.alphabetPrev) els.alphabetPrev.addEventListener("click", () => advanceAlphabet(-1));
  if (els.alphabetNext) els.alphabetNext.addEventListener("click", () => advanceAlphabet(1));
  if (els.alphabetSpeak) {
    els.alphabetSpeak.addEventListener("click", () => {
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
    els.quizSpeak.addEventListener("click", () => {
      const set = getAlphabetSet();
      if (!set) return;
      speakAlphabetChar(set[state.alphabetIndex[state.currentTrack] || 0]);
    });
  }
  if (els.quizSkip) els.quizSkip.addEventListener("click", () => advanceQuizAuto());

  buildFindCountBar();
  setupInstallPrompt();
  setupLibraryControls();
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
    btn.addEventListener("click", () => {
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
    const haystack = `${item.en} ${item.jaKana} ${item.jaRomaji}`.toLowerCase();
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
      img.src = item.imagePath;
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
    sub.textContent = arr.length === 0
      ? "Default image"
      : arr.length === 1 ? "1 custom photo" : `${arr.length} custom photos`;
    card.appendChild(sub);

    card.addEventListener("click", () => openImageModal(item));
    els.imageList.appendChild(card);
  });
}

function openImageModal(item) {
  if (!els.imageModal || !els.imageModalTitle) return;
  state.imageModalItemId = item.id;
  els.imageModalTitle.textContent = `${item.en} (${item.jaKana})`;
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
      img.src = item.imagePath;
      img.alt = item.en;
      img.className = "modal-photo";
      wrap.appendChild(img);
      const note = document.createElement("div");
      note.className = "modal-photo-note";
      note.textContent = "Default image";
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
  const target = pool[Math.floor(Math.random() * pool.length)];
  const others = pool.filter((i) => i.id !== target.id);
  shuffle(others);

  const needed = Math.max(1, count - 1);
  const distractors = others.slice(0, needed);
  const choices = shuffle([target, ...distractors]).slice(0, count);

  state.currentTarget = target;
  state.currentChoices = choices;
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
  els.promptWord.textContent = state.currentTarget.jaKana;
}

function renderFindView() {
  els.modeLabel.textContent = "Find It";
  hideAllGameViews();
  showPromptArea(true);
  if (els.findCountBar) els.findCountBar.classList.remove("hidden");
  updateFindCountButtons();
  els.cards.classList.remove("hidden");
  renderCards(state.currentChoices);
  els.promptWord.textContent = state.currentTarget.jaKana;
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

function speakText(text) {
  if (!text) return;
  if (!("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ja-JP";
    const voice = state.voices.find((v) => v.voiceURI === state.voiceId) ||
      state.voices.find((v) => v.lang && v.lang.startsWith("ja"));
    if (voice) utter.voice = voice;
    utter.rate = 0.9;
    speechSynthesis.speak(utter);
  } catch (_) {}
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
    btn.addEventListener("click", () => handleQuizChoice(ch, target, btn));
    els.quizChoices.appendChild(btn);
  });

  speakAlphabetChar(target);
}

function handleQuizChoice(chosen, target, btn) {
  if (chosen.id === target.id) {
    btn.classList.add("correct");
    els.quizFeedback.textContent = `${target.exampleWord || target.kana} — ${target.exampleEn || ""}`.trim();
    playCorrect();
    showCorrectOverlay();
    setTimeout(() => advanceQuizAuto(), 1100);
  } else {
    btn.classList.add("wrong");
    setTimeout(() => btn.classList.remove("wrong"), 500);
    buzz();
    showWrongOverlay();
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
    img.src = getImageSrc(item);
    img.alt = item.en;
    card.appendChild(img);

    const ja = document.createElement("div");
    ja.className = "label-ja";
    ja.textContent = item.jaKana;
    card.appendChild(ja);

    const label = document.createElement("div");
    label.className = "label-en";
    label.textContent = state.romaji ? item.jaRomaji : item.en;
    card.appendChild(label);

    card.addEventListener("click", () => handleTap(item, card));
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

    card.addEventListener("click", () => handleKanaTap(item, card));
    els.cards.appendChild(card);
  });
}

function handleTap(item, cardEl) {
  if (item.id === state.currentTarget.id) {
    cardEl.classList.add("correct");
    els.feedback.textContent = "Great!";
    playCorrect();
    showCorrectOverlay();
    setTimeout(() => startRound(), 800);
  } else {
    cardEl.classList.add("wrong");
    els.feedback.textContent = "Try again!";
    buzz();
    showWrongOverlay();
    setTimeout(() => cardEl.classList.remove("wrong"), 400);
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
  const chars = Array.from(target.jaKana);
  const missingIndex = Math.floor(Math.random() * chars.length);
  const missingChar = chars[missingIndex];
  state.currentKanaMissing = missingChar;
  renderSplitWordDisplay(chars, missingIndex, missingChar);
  els.promptWord.textContent = target.en;

  const poolChars = Array.from(new Set(pickPool().flatMap((i) => Array.from(i.jaKana))));
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
  }
}

function handleKanaTap(item, cardEl) {
  if (item.id === state.currentTarget.id) {
    cardEl.classList.add("correct");
    els.feedback.textContent = "Great!";
    playCorrect();
    showCorrectOverlay();
    setTimeout(() => startRound(), 800);
  } else {
    cardEl.classList.add("wrong");
    els.feedback.textContent = "Try again!";
    buzz();
    showWrongOverlay();
    setTimeout(() => cardEl.classList.remove("wrong"), 400);
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
    setTimeout(() => {
      dragData.el.classList.remove("wrong");
      els.dropzone.textContent = "Drop here";
    }, 500);
  }
}

function speakCurrent() {
  if (!state.currentTarget) return;
  if (!("speechSynthesis" in window)) return;

  const voices = speechSynthesis.getVoices();
  const voice =
    voices.find((v) => v.voiceURI === state.voiceId) || voices.find((v) => v.lang?.startsWith("ja"));
  if (!voice) return;

  const phrase =
    state.currentTrack === "hiragana" || state.currentTrack === "katakana"
      ? state.currentTarget.kana || state.currentTarget.romaji
      : state.currentTarget.jaKana;

  const utter = new SpeechSynthesisUtterance(phrase);
  utter.lang = "ja-JP";
  utter.voice = voice;
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
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
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}
