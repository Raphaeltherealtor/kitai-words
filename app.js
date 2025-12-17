const state = {
  data: null,
  items: [],
  categories: [],
  currentSection: "home",
  currentTrack: "vocab",
  currentGameType: "tap", // tap | drag-complete | kana-tap | kana-complete
  choiceCount: 3,
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
  imageOverrides: {},
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
  voiceSelect: document.getElementById("voice-select"),
  romajiToggle: document.getElementById("romaji-toggle"),
  vibrationToggle: document.getElementById("vibration-toggle"),
  closeSettings: document.getElementById("close-settings"),
  speakBtn: document.getElementById("speak-btn"),
  dropzoneSection: document.getElementById("dropzone-section"),
  dropzone: document.getElementById("dropzone"),
  modeButtons: document.querySelectorAll(".mode-btn"),
  tileButtons: document.querySelectorAll(".tile[data-track]"),
  completeWordSection: document.getElementById("complete-word-section"),
  completeWordDisplay: document.getElementById("complete-word-display"),
  completeChoices: document.getElementById("complete-choices"),
  imageSearch: document.getElementById("image-search"),
  imageList: document.getElementById("image-list"),
  wrongOverlay: document.getElementById("wrong-overlay"),
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  await loadData();
  await loadHiragana();
  await loadKatakana();
  await loadImageOverrides();
  buildImageManager();
  await setupVoices();
  bindUI();
  registerServiceWorker();
  goHome();
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

  state.categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = `${cat.emoji} ${cat.label_en}`;
    els.categorySelect.appendChild(opt);
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

let imageDb = null;

function getImageDb() {
  if (imageDb) return Promise.resolve(imageDb);
  if (!("indexedDB" in window)) return Promise.reject(new Error("IndexedDB not supported"));
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("kitai-images", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("images")) {
        db.createObjectStore("images", { keyPath: "id" });
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

async function loadImageOverrides() {
  try {
    const db = await getImageDb();
    const tx = db.transaction("images", "readonly");
    const store = tx.objectStore("images");
    const records = await requestToPromise(store.getAll());
    state.imageOverrides = {};
    records.forEach((rec) => {
      if (rec.blob) {
        const url = URL.createObjectURL(rec.blob);
        state.imageOverrides[rec.id] = url;
      }
    });
  } catch (e) {
    state.imageOverrides = {};
  }
}

function getImageSrc(item) {
  return state.imageOverrides[item.id] || item.imagePath;
}

async function saveImageOverride(itemId, file) {
  if (!file) return;
  try {
    const db = await getImageDb();
    const tx = db.transaction("images", "readwrite");
    const store = tx.objectStore("images");
    await requestToPromise(store.put({ id: itemId, blob: file }));
    if (state.imageOverrides[itemId]) URL.revokeObjectURL(state.imageOverrides[itemId]);
    state.imageOverrides[itemId] = URL.createObjectURL(file);
    renderImageList();
    if (state.currentTrack === "vocab") renderCurrentView();
  } catch (e) {
    // ignore storage errors
  }
}

async function removeImageOverride(itemId) {
  try {
    const db = await getImageDb();
    const tx = db.transaction("images", "readwrite");
    const store = tx.objectStore("images");
    await requestToPromise(store.delete(itemId));
  } catch (e) {
    // ignore storage errors
  }
  if (state.imageOverrides[itemId]) {
    URL.revokeObjectURL(state.imageOverrides[itemId]);
    delete state.imageOverrides[itemId];
  }
  renderImageList();
  if (state.currentTrack === "vocab") renderCurrentView();
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
  els.parentBtn.addEventListener("pointerup", cancelLongPress);
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
    startRound();
  });

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

  els.dropzone.addEventListener("pointerup", onDropZonePointerUp);

  if (els.imageSearch) {
    els.imageSearch.addEventListener("input", renderImageList);
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
}

function buildImageManager() {
  if (!els.imageList) return;
  renderImageList();
}

function renderImageList() {
  if (!els.imageList) return;
  const term = (els.imageSearch?.value || "").toLowerCase().trim();
  els.imageList.innerHTML = "";

  state.categories.forEach((cat) => {
    const catItems = state.items.filter((i) => i.categoryId === cat.id);
    const filtered = catItems.filter((item) => {
      if (!term) return true;
      const haystack = `${item.en} ${item.jaKana} ${item.jaRomaji}`.toLowerCase();
      return haystack.includes(term);
    });
    if (!filtered.length) return;

    const section = document.createElement("div");
    section.className = "image-section";
    const title = document.createElement("h3");
    title.textContent = `${cat.emoji} ${cat.label_en}`;
    section.appendChild(title);

    filtered.forEach((item) => {
      const row = document.createElement("div");
      row.className = "image-row";

      const preview = document.createElement("div");
      preview.className = "image-preview";
      const img = document.createElement("img");
      img.src = getImageSrc(item);
      img.alt = item.en;
      preview.appendChild(img);
      row.appendChild(preview);

      const meta = document.createElement("div");
      meta.className = "image-meta";
      const t = document.createElement("div");
      t.className = "title";
      t.textContent = `${item.en} (${item.jaKana})`;
      const sub = document.createElement("div");
      sub.className = "subtitle";
      sub.textContent = state.imageOverrides[item.id] ? "Custom image in use" : "Using default";
      meta.appendChild(t);
      meta.appendChild(sub);

      const actions = document.createElement("div");
      actions.className = "image-actions";

      const uploadInput = document.createElement("input");
      uploadInput.type = "file";
      uploadInput.accept = "image/*";
      uploadInput.className = "hidden";
      uploadInput.addEventListener("change", () => {
        const file = uploadInput.files?.[0];
        if (file) saveImageOverride(item.id, file);
        uploadInput.value = "";
      });

      const cameraInput = document.createElement("input");
      cameraInput.type = "file";
      cameraInput.accept = "image/*";
      cameraInput.capture = "environment";
      cameraInput.className = "hidden";
      cameraInput.addEventListener("change", () => {
        const file = cameraInput.files?.[0];
        if (file) saveImageOverride(item.id, file);
        cameraInput.value = "";
      });

      const uploadBtn = document.createElement("button");
      uploadBtn.textContent = "Upload";
      uploadBtn.addEventListener("click", () => uploadInput.click());

      const cameraBtn = document.createElement("button");
      cameraBtn.textContent = "Camera";
      cameraBtn.addEventListener("click", () => cameraInput.click());

      const resetBtn = document.createElement("button");
      resetBtn.textContent = "Reset";
      resetBtn.className = "reset";
      resetBtn.disabled = !state.imageOverrides[item.id];
      resetBtn.addEventListener("click", () => removeImageOverride(item.id));

      actions.append(uploadInput, cameraInput, uploadBtn, cameraBtn, resetBtn);
      meta.appendChild(actions);
      row.appendChild(meta);
      section.appendChild(row);
    });
    els.imageList.appendChild(section);
  });
}

function setActiveModeButton(type) {
  els.modeButtons.forEach((b) => b.classList.remove("active"));
  const match = Array.from(els.modeButtons).find((b) => b.dataset.gametype === type);
  if (match) match.classList.add("active");
}

function updateModeButtonsForTrack(track) {
  if (track === "vocab") {
    const [btn1, btn2] = els.modeButtons;
    btn1.dataset.gametype = "tap";
    btn1.textContent = "Listen & Tap";
    btn2.dataset.gametype = "drag-complete";
    btn2.textContent = "Drag to Complete";
    els.modeButtons.forEach((b) => (b.disabled = false));
    state.currentGameType = "tap";
    setActiveModeButton("tap");
  } else if (track === "hiragana" || track === "katakana") {
    const [btn1, btn2] = els.modeButtons;
    btn1.dataset.gametype = "kana-tap";
    btn1.textContent = "Sound & Pick";
    btn2.dataset.gametype = "kana-complete";
    btn2.textContent = "Drag to Complete";
    els.modeButtons.forEach((b) => (b.disabled = false));
    state.currentGameType = "kana-tap";
    setActiveModeButton("kana-tap");
  } else {
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
  const target = pool[Math.floor(Math.random() * pool.length)];
  const others = pool.filter((i) => i.id !== target.id);
  shuffle(others);

  const needed = Math.max(1, state.choiceCount - 1);
  const distractors = others.slice(0, needed);
  const choices = shuffle([target, ...distractors]).slice(0, state.choiceCount);

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
    } else {
      renderDragCompleteView();
    }
  } else if (state.currentTrack === "hiragana" || state.currentTrack === "katakana") {
    if (state.currentGameType === "kana-tap") {
      renderKanaTapView();
    } else {
      renderKanaCompleteView();
    }
  }
}

function renderTapView() {
  els.modeLabel.textContent = "Listen & Tap";
  els.cards.classList.remove("hidden");
  els.dropzoneSection.classList.add("hidden");
  els.completeWordSection.classList.add("hidden");
  renderCards(state.currentChoices);
  els.promptWord.textContent = state.currentTarget.jaKana;
}

function renderDragCompleteView() {
  els.modeLabel.textContent = "Drag to Complete";
  els.cards.classList.add("hidden");
  els.dropzoneSection.classList.add("hidden");
  els.completeWordSection.classList.remove("hidden");
  buildDragCompleteRound(state.currentTarget);
}

function renderKanaTapView() {
  els.modeLabel.textContent = "Sound & Pick";
  els.cards.classList.remove("hidden");
  els.dropzoneSection.classList.add("hidden");
  els.completeWordSection.classList.add("hidden");
  renderKanaCards(state.currentChoices);
  els.promptWord.textContent = state.currentTarget.kana;
}

function renderKanaCompleteView() {
  els.modeLabel.textContent = "Drag to Complete";
  els.cards.classList.add("hidden");
  els.dropzoneSection.classList.add("hidden");
  els.completeWordSection.classList.remove("hidden");
  buildKanaCompleteRound(state.currentTarget);
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
    label.textContent = state.romaji ? item.romaji : " ";
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
    setTimeout(() => startRound(), 600);
  } else {
    cardEl.classList.add("wrong");
    els.feedback.textContent = "Try again!";
    buzz();
    showWrongOverlay();
    setTimeout(() => cardEl.classList.remove("wrong"), 400);
  }
}

function buildDragCompleteRound(target) {
  const chars = Array.from(target.jaKana);
  const missingIndex = Math.floor(Math.random() * chars.length);
  const missingChar = chars[missingIndex];
  const display = chars
    .map((ch, idx) => (idx === missingIndex ? `<span class="blank-slot" data-missing="${missingChar}"></span>` : ch))
    .join("");
  els.completeWordDisplay.innerHTML = display;
  els.promptWord.textContent = target.en;

  const poolChars = Array.from(new Set(pickPool().flatMap((i) => Array.from(i.jaKana))));
  const distractors = shuffle(poolChars.filter((c) => c !== missingChar)).slice(0, 3);
  const options = shuffle([missingChar, ...distractors]).slice(0, 3);

  els.completeChoices.innerHTML = "";
  options.forEach((opt) => {
    const chip = document.createElement("div");
    chip.className = "choice-chip";
    chip.textContent = opt;
    chip.addEventListener("click", () => handleCompleteChoice(opt, missingChar, target));
    els.completeChoices.appendChild(chip);
  });
}

function buildKanaCompleteRound(word) {
  const chars = Array.from(word.kana);
  const missingIndex = Math.floor(Math.random() * chars.length);
  const missingChar = chars[missingIndex];
  state.currentKanaMissing = missingChar;
  const display = chars
    .map((ch, idx) => (idx === missingIndex ? `<span class="blank-slot" data-missing="${missingChar}"></span>` : ch))
    .join("");
  els.completeWordDisplay.innerHTML = display;
  els.promptWord.textContent = word.romaji;

  const poolChars = Array.from(new Set(state.kanaChars.map((c) => c.kana)));
  if (state.currentTrack === "katakana") {
    const kataSet = Array.from(new Set(state.kataChars.map((c) => c.kana)));
    poolChars.splice(0, poolChars.length, ...kataSet);
  }
  const distractors = shuffle(poolChars.filter((c) => c !== missingChar)).slice(0, 3);
  const options = shuffle([missingChar, ...distractors]).slice(0, 3);

  els.completeChoices.innerHTML = "";
  options.forEach((opt) => {
    const chip = document.createElement("div");
    chip.className = "choice-chip";
    chip.textContent = opt;
    chip.addEventListener("click", () => handleKanaCompleteChoice(opt, missingChar, word));
    els.completeChoices.appendChild(chip);
  });
}

function handleCompleteChoice(opt, missingChar, target) {
  if (opt === missingChar) {
    const slot = els.completeWordDisplay.querySelector(".blank-slot");
    if (slot) slot.textContent = missingChar;
    els.feedback.textContent = "Great!";
    playCorrect();
    setTimeout(() => startRound(), 800);
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
    setTimeout(() => startRound(), 600);
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
    setTimeout(() => startRound(), 800);
  } else {
    els.feedback.textContent = "Try again!";
    buzz();
    showWrongOverlay();
  }
}

let dragData = { item: null, el: null };
let wrongOverlayTimer = null;

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

function onDropZonePointerUp() {
  if (!dragData.item) return;
  const item = dragData.item;
  if (item.id === state.currentTarget.id) {
    dragData.el.classList.add("correct");
    els.dropzone.textContent = "Nice!";
    playCorrect();
    setTimeout(() => startRound(), 600);
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

function buzz() {
  playTone(120, 0.14);
  playTone(80, 0.12, 0.02);
  if (state.vibration && "vibrate" in navigator) navigator.vibrate([160]);
}

function playCorrect() {
  playChime();
  playClap();
}

function playTone(freq, duration, delay = 0) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.start(now);
    osc.stop(now + duration);
  } catch (e) {
    // ignore audio errors
  }
}

function playChime() {
  playTone(523.25, 0.15);
  playTone(659.25, 0.15, 0.08);
  playTone(783.99, 0.12, 0.16);
}

function playClap() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const bufferSize = ctx.sampleRate * 0.2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.6, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    source.connect(gain).connect(ctx.destination);
    source.start();
  } catch (e) {
    // ignore audio errors
  }
}

function showWrongOverlay() {
  if (!els.wrongOverlay) return;
  els.wrongOverlay.classList.remove("hidden");
  clearTimeout(wrongOverlayTimer);
  wrongOverlayTimer = setTimeout(() => {
    els.wrongOverlay.classList.add("hidden");
  }, 600);
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
