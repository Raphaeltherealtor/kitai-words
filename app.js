const state = {
  data: null,
  items: [],
  categories: [],
  currentMode: "tap",
  choiceCount: 3,
  categoryId: "mixed",
  romaji: false,
  voices: [],
  voiceId: null,
  currentTarget: null,
  currentChoices: [],
  longPressTimer: null,
  longPressMs: 600,
};

const els = {
  cards: document.getElementById("cards"),
  promptWord: document.getElementById("prompt-word"),
  feedback: document.getElementById("feedback"),
  modeLabel: document.getElementById("mode-label"),
  categoryLabel: document.getElementById("category-label"),
  voiceWarning: document.getElementById("voice-warning"),
  parentBtn: document.getElementById("parent-button"),
  overlay: document.getElementById("settings-overlay"),
  modeSelect: document.getElementById("mode-select"),
  choiceCount: document.getElementById("choice-count"),
  categorySelect: document.getElementById("category-select"),
  voiceSelect: document.getElementById("voice-select"),
  romajiToggle: document.getElementById("romaji-toggle"),
  closeSettings: document.getElementById("close-settings"),
  speakBtn: document.getElementById("speak-btn"),
  dropzoneSection: document.getElementById("dropzone-section"),
  dropzone: document.getElementById("dropzone"),
};

async function init() {
  await loadData();
  await setupVoices();
  bindUI();
  registerServiceWorker();
  startRound();
}

document.addEventListener("DOMContentLoaded", init);

async function loadData() {
  const res = await fetch("data/vocab.json");
  state.data = await res.json();
  state.categories = state.data.categories;
  state.items = state.data.items;

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

function setupVoiceOptions() {
  els.voiceSelect.innerHTML = "";
  const voices = speechSynthesis
    .getVoices()
    .filter((v) => v.lang && v.lang.startsWith("ja"));
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
  els.closeSettings.addEventListener("click", hideSettings);

  els.modeSelect.addEventListener("change", (e) => {
    state.currentMode = e.target.value;
    startRound();
  });

  els.choiceCount.addEventListener("change", (e) => {
    state.choiceCount = Number(e.target.value);
    startRound();
  });

  els.categorySelect.addEventListener("change", (e) => {
    state.categoryId = e.target.value;
    els.categoryLabel.textContent =
      e.target.value === "mixed"
        ? "Mixed"
        : state.categories.find((c) => c.id === e.target.value)?.label_en ||
          "Mixed";
    startRound();
  });

  els.voiceSelect.addEventListener("change", (e) => {
    state.voiceId = e.target.value;
  });

  els.romajiToggle.addEventListener("change", (e) => {
    state.romaji = e.target.checked;
    renderCards(state.currentChoices);
  });

  els.dropzone.addEventListener("pointerup", onDropZonePointerUp);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
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

function startRound() {
  chooseRoundItems();
  els.modeLabel.textContent =
    state.currentMode === "tap" ? "Listen & Tap" : "Drag & Drop";
  renderCards(state.currentChoices);
  els.promptWord.textContent = state.currentTarget.jaKana;
  els.feedback.textContent = "";

  if (state.currentMode === "drag") {
    els.dropzoneSection.classList.remove("hidden");
  } else {
    els.dropzoneSection.classList.add("hidden");
  }

  speakCurrent();
}

function renderCards(items) {
  els.cards.innerHTML = "";
  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.id = item.id;

    const img = document.createElement("img");
    img.src = item.imagePath;
    img.alt = item.en;
    card.appendChild(img);

    const ja = document.createElement("div");
    ja.className = "label-ja";
    ja.textContent = item.jaKana;
    card.appendChild(ja);

    if (state.romaji) {
      const ro = document.createElement("div");
      ro.className = "label-en";
      ro.textContent = item.jaRomaji;
      card.appendChild(ro);
    } else {
      const en = document.createElement("div");
      en.className = "label-en";
      en.textContent = item.en;
      card.appendChild(en);
    }

    if (state.currentMode === "tap") {
      card.addEventListener("click", () => handleTap(item, card));
    } else {
      card.addEventListener("pointerdown", (e) => handleDragStart(e, card, item));
    }

    els.cards.appendChild(card);
  });
}

function handleTap(item, cardEl) {
  if (item.id === state.currentTarget.id) {
    cardEl.classList.add("correct");
    els.feedback.textContent = "✅";
    playCorrect();
    setTimeout(() => startRound(), 600);
  } else {
    cardEl.classList.add("wrong");
    els.feedback.textContent = "Try again!";
    setTimeout(() => cardEl.classList.remove("wrong"), 400);
  }
}

let dragData = { item: null, el: null };

function handleDragStart(e, cardEl, item) {
  dragData = { item, el: cardEl };
  cardEl.setPointerCapture(e.pointerId);
  cardEl.classList.add("dragging");
  els.dropzone.textContent = "Drop here";
  cardEl.addEventListener("pointermove", handleDragMove);
  cardEl.addEventListener("pointerup", handleDragEnd);
}

function handleDragMove() {
  // pointer capture keeps the drag associated; no visuals needed
}

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
    els.dropzone.textContent = "✅";
    playCorrect();
    setTimeout(() => startRound(), 600);
  } else {
    dragData.el.classList.add("wrong");
    els.dropzone.textContent = "Try again!";
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
    voices.find((v) => v.voiceURI === state.voiceId) ||
    voices.find((v) => v.lang?.startsWith("ja"));
  if (!voice) return;

  const utter = new SpeechSynthesisUtterance(state.currentTarget.jaKana);
  utter.lang = "ja-JP";
  utter.voice = voice;
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}

function playCorrect() {
  const audioEl = document.getElementById("sfx-correct");
  if (audioEl) {
    audioEl.currentTime = 0;
    audioEl.play().catch(() => {});
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
