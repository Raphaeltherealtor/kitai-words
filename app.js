const state = {
  data: null,
  items: [],
  builtinItems: [],
  builtinCategories: [],
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
  // The parent's own ElevenLabs account (optional). `key` is theirs, not ours,
  // and `voiceId` may be a clone of their own voice. See the premium-voice
  // section further down for how clips are cached and how this is synced.
  eleven: {
    enabled: false,
    key: "",
    voiceId: "",
    voiceName: "",
    model: "eleven_flash_v2_5",
    syncKey: false,
    voices: [],
  },
  // Optional Google Programmable Search creds for real Google image results.
  googleImgKey: "",
  googleImgCx: "",
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
  lang: "ja", // ja | ko | en | es | pt — which language the words + voice use (the "output")
  uiLang: "en", // ja | ko | en | es | pt — the app's own interface language
  koAltReading: false, // Korean siblings: false = 오빠/언니 (girl's view), true = 형/누나 (boy's view)
  theme: "ocean",
  imageOverrides: {},
  imageCategoryId: "all",
  imageModalItemId: null,
  alphabetIndex: { hiragana: 0, katakana: 0 },
  libraryConfig: { libraryId: "", pin: "" },
  storagePrefix: null,
  // Flash Cards: a "clear the deck" session over the current category. Each word
  // shows once; a correct answer removes it, a miss reshuffles it back deeper in
  // the deck. `wrong` counts misses per word id so we can show weak words at the
  // end. `firstTryOk` counts words cleared without any miss. `missedThisCard`
  // tracks whether the current target has been missed yet this appearance.
  flash: {
    active: false,
    deck: [],
    wrong: {},
    total: 0,
    firstTryOk: 0,
    answered: 0, // total answer taps (right or wrong)
    correct: 0, // right taps
    startTime: 0,
    missedThisCard: false,
  },
  // Memory mode reuses the flash deck-session but hides the pictures after a peek:
  // cards show face-up, the word is read, then they flip face-down and the child
  // taps where they remember the right card was. `memoryFlipTimer` schedules the
  // flip; `memoryArmed` gates taps so they only count once the cards are down.
  memoryFlipTimer: null,
  memoryArmed: false,
  // Child Lock: fullscreen kiosk-ish mode. `locked` = on; `wakeLock` holds the
  // Screen Wake Lock sentinel so we can release it on unlock.
  locked: false,
  wakeLock: null,
};

// Supported languages. `speech` = BCP-47 tag for SpeechSynthesis, `hl` =
// VoiceRSS language code, `prefix` = voice-list lang filter, `sample` = the
// Parent-Settings voice test phrase, `kana` = whether the Japanese-only kana
// tracks (Hiragana/Katakana) apply.
const LANGS = {
  ja: { label: "日本語 Japanese", speech: "ja-JP", hl: "ja-jp", prefix: "ja", sample: "こんにちは。ねこ。", kana: true },
  ko: { label: "한국어 Korean", speech: "ko-KR", hl: "ko-kr", prefix: "ko", sample: "안녕하세요. 고양이.", kana: false },
  en: { label: "English", speech: "en-US", hl: "en-us", prefix: "en", sample: "Hello. Cat.", kana: false },
  es: { label: "Español Spanish", speech: "es-ES", hl: "es-es", prefix: "es", sample: "Hola. Gato.", kana: false },
  pt: { label: "Português Portuguese", speech: "pt-BR", hl: "pt-br", prefix: "pt", sample: "Olá. Gato.", kana: false },
};
const LANG_KEY = "kitai-lang";
function langCfg() {
  return LANGS[state.lang] || LANGS.ja;
}

// Which stored field holds the word for a given language. ja shows kana, ko
// shows Hangul, and every Latin-script language (en, es, pt) has a field named
// after its code. Falls back to English, then Japanese, so a word missing a
// translation still shows *something* instead of a blank card.
function langWordField(item, lang) {
  if (!item) return "";
  if (lang === "ja") return item.jaKana || item.en || "";
  if (lang === "ko") return item.ko || item.en || item.jaKana || "";
  return item[lang] || item.en || item.jaKana || "";
}

// The word to show for the current output language, with graceful fallback.
function wordText(item) {
  if (!item) return "";
  if (state.lang === "ko" && state.koAltReading && item.koAlt) return item.koAlt;
  return langWordField(item, state.lang);
}
// What the *voice* should say (may differ from what's displayed). For Japanese a
// word can carry an optional `jaSpeech` — usually the kanji — so the engine's
// dictionary applies the correct pitch accent (e.g. 箸 HA‑shi vs 橋 ha‑SHI) even
// though the tile still shows the ambiguous kana. Falls back to the shown word.
function speechText(item) {
  if (!item) return "";
  if (state.lang === "ja") return item.jaSpeech || item.jaKana || item.en || "";
  return wordText(item);
}
// The romanization line (under the word). Only the Japanese and Korean tracks
// have a romanization; Latin-script languages (en, es, pt) show nothing here.
function wordRomaji(item) {
  if (!item) return "";
  if (state.lang === "ko") {
    if (state.koAltReading && item.koAltRomaji) return item.koAltRomaji;
    return item.koRomaji || "";
  }
  if (state.lang === "ja") return item.jaRomaji || "";
  return "";
}
// The secondary label beneath the word. If romaji is on, show the romanization;
// otherwise show a gloss in the *app* language so the parent recognizes the word
// (e.g. output "Gato" with "Cat" underneath). Hidden when the app language and
// the output language are the same (the gloss would just repeat the word).
function wordSubLabel(item) {
  if (!item) return "";
  if (state.romaji) return wordRomaji(item);
  if (state.uiLang === state.lang) return "";
  return langWordField(item, state.uiLang);
}

// ---- Interface localization (app language) ---------------------------------
// `state.uiLang` picks the language of the app's own chrome (buttons, menus,
// feedback) — independent of `state.lang`, which is the language being *taught*.
// So a Spanish speaker can set the app to Spanish and still teach English. Keys
// missing for a language fall back to English; UI text with no key at all stays
// as authored in index.html (used for long power-user help paragraphs).
const UI_LANG_KEY = "kitai-ui-lang";
const UI_LANGS = ["en", "es", "pt", "ja", "ko"];
const UI_LANG_LABELS = {
  en: "English", es: "Español", pt: "Português", ja: "日本語", ko: "한국어",
};
const I18N = {
  en: {
    ob_sub: "Pick a language to learn", ob_start: "Start playing →",
    aria_lock: "Child lock", aria_home: "Go to home", aria_parent: "Parent settings",
    home_title: "Choose a track",
    track_vocab: "Vocabulary", track_vocab_sub: "Listen & match pictures",
    track_hiragana: "Hiragana", track_katakana: "Katakana", track_kana_sub: "Sound & pick, complete",
    track_kanji: "Kanji", track_kanji_sub: "Coming soon",
    mode_tap: "Listen & Tap", mode_drag: "Drag to Complete", mode_find: "Find It 🔍",
    mode_flash: "Flash Cards 🎴", mode_memory: "Memory 🧠",
    mode_kana_tap: "Sound & Pick", mode_alphabet: "Alphabet", mode_quiz: "Quiz",
    flash_finish: "Finish ✓", flash_live_default: "Tap the right picture",
    find_count_q: "How many pictures?", quiz_prompt: "Pick the picture for this sound",
    fb_great: "Great!", fb_try_again: "Try again!", fb_see_again: "We'll see it again!",
    fb_no_words: "No words here yet. Add or restore some in Parent Settings.",
    mem_look_listen: "Look and listen…", mem_where: "Where was it? Tap the card!",
    mem_remembered: "You remembered! 🎉", mem_was_here: "It was here! We'll see it again.",
    mem_watch: "Watch closely!",
    done_all: "All done!", done_nice: "Nice work!",
    stat_correct: "correct", stat_first: "first try", stat_cleared: "cleared", stat_time: "time",
    weak_title: "Words to practice", play_again: "🎴 Play again", home_btn: "🏠 Home",
    lock_hold: "Hold to unlock", install_btn: "Install",
    settings_title: "Parent Settings",
    tab_words: "📚 Words", tab_language: "🌐 Language", tab_game: "🎮 Game", tab_account: "☁️ Account",
    done: "Done", label_category: "Category:",
    app_language: "App language:", app_language_hint: "Changes the buttons and menus throughout the app.",
    output_language: "Words / voice language:",
    label_voice: "Voice:", voice_test: "🔊 Test voice", voice_refresh: "↻ Refresh voices",
    ko_alt: "Korean: use a boy's words for siblings (형 / 누나 instead of 오빠 / 언니)",
    romaji_toggle: "Show romaji / romanization (off by default)",
    online_voice: "Prefer online voice (needs internet; use if device voice won't play)",
    label_online_key: "Online voice key:",
    label_choices: "Choices:", vibrate_toggle: "Vibrate on wrong (if supported)",
    sound_toggle: "Enable sounds (chime/buzz)", label_theme: "Theme:",
    childlock_header: "Child Lock",
    library_header: "Shared Library", label_library_id: "Library ID:", label_pin: "PIN (4 digits):",
    library_save: "Save & Switch", library_reset: "Reset to Device",
  },
  es: {
    ob_sub: "Elige un idioma para aprender", ob_start: "¡A jugar! →",
    aria_lock: "Bloqueo infantil", aria_home: "Ir al inicio", aria_parent: "Ajustes",
    home_title: "Elige una pista",
    track_vocab: "Vocabulario", track_vocab_sub: "Escucha y empareja imágenes",
    track_hiragana: "Hiragana", track_katakana: "Katakana", track_kana_sub: "Escucha, elige y completa",
    track_kanji: "Kanji", track_kanji_sub: "Muy pronto",
    mode_tap: "Escucha y Toca", mode_drag: "Arrastra y Completa", mode_find: "Encuéntralo 🔍",
    mode_flash: "Tarjetas 🎴", mode_memory: "Memoria 🧠",
    mode_kana_tap: "Sonido y Elige", mode_alphabet: "Alfabeto", mode_quiz: "Prueba",
    flash_finish: "Terminar ✓", flash_live_default: "Toca la imagen correcta",
    find_count_q: "¿Cuántas imágenes?", quiz_prompt: "Elige la imagen de este sonido",
    fb_great: "¡Muy bien!", fb_try_again: "¡Inténtalo otra vez!", fb_see_again: "¡La veremos de nuevo!",
    fb_no_words: "Aún no hay palabras aquí. Agrégalas o restáuralas en Ajustes.",
    mem_look_listen: "Mira y escucha…", mem_where: "¿Dónde estaba? ¡Toca la tarjeta!",
    mem_remembered: "¡Lo recordaste! 🎉", mem_was_here: "¡Estaba aquí! La veremos de nuevo.",
    mem_watch: "¡Fíjate bien!",
    done_all: "¡Terminado!", done_nice: "¡Buen trabajo!",
    stat_correct: "correctas", stat_first: "al primer intento", stat_cleared: "completadas", stat_time: "tiempo",
    weak_title: "Palabras para practicar", play_again: "🎴 Jugar otra vez", home_btn: "🏠 Inicio",
    lock_hold: "Mantén para desbloquear", install_btn: "Instalar",
    settings_title: "Ajustes para padres",
    tab_words: "📚 Palabras", tab_language: "🌐 Idioma", tab_game: "🎮 Juego", tab_account: "☁️ Cuenta",
    done: "Listo", label_category: "Categoría:",
    app_language: "Idioma de la app:", app_language_hint: "Cambia los botones y menús de toda la app.",
    output_language: "Idioma de palabras / voz:",
    label_voice: "Voz:", voice_test: "🔊 Probar voz", voice_refresh: "↻ Actualizar voces",
    ko_alt: "Coreano: usar las palabras de un niño para hermanos (형 / 누나 en vez de 오빠 / 언니)",
    romaji_toggle: "Mostrar romaji / romanización (desactivado por defecto)",
    online_voice: "Preferir voz en línea (necesita internet; úsala si la voz del dispositivo no suena)",
    label_online_key: "Clave de voz en línea:",
    label_choices: "Opciones:", vibrate_toggle: "Vibrar al fallar (si es compatible)",
    sound_toggle: "Activar sonidos (campana/zumbido)", label_theme: "Tema:",
    childlock_header: "Bloqueo infantil",
    library_header: "Biblioteca compartida", label_library_id: "ID de biblioteca:", label_pin: "PIN (4 dígitos):",
    library_save: "Guardar y cambiar", library_reset: "Volver al dispositivo",
  },
  pt: {
    ob_sub: "Escolha um idioma para aprender", ob_start: "Vamos jogar! →",
    aria_lock: "Bloqueio infantil", aria_home: "Ir para o início", aria_parent: "Configurações",
    home_title: "Escolha uma trilha",
    track_vocab: "Vocabulário", track_vocab_sub: "Ouça e combine as imagens",
    track_hiragana: "Hiragana", track_katakana: "Katakana", track_kana_sub: "Ouça, escolha e complete",
    track_kanji: "Kanji", track_kanji_sub: "Em breve",
    mode_tap: "Ouça e Toque", mode_drag: "Arraste e Complete", mode_find: "Encontre 🔍",
    mode_flash: "Cartões 🎴", mode_memory: "Memória 🧠",
    mode_kana_tap: "Som e Escolha", mode_alphabet: "Alfabeto", mode_quiz: "Quiz",
    flash_finish: "Terminar ✓", flash_live_default: "Toque na imagem certa",
    find_count_q: "Quantas imagens?", quiz_prompt: "Escolha a imagem deste som",
    fb_great: "Muito bem!", fb_try_again: "Tente de novo!", fb_see_again: "Vamos ver de novo!",
    fb_no_words: "Ainda não há palavras aqui. Adicione ou restaure nas Configurações.",
    mem_look_listen: "Olhe e ouça…", mem_where: "Onde estava? Toque no cartão!",
    mem_remembered: "Você lembrou! 🎉", mem_was_here: "Estava aqui! Vamos ver de novo.",
    mem_watch: "Preste atenção!",
    done_all: "Tudo pronto!", done_nice: "Bom trabalho!",
    stat_correct: "corretas", stat_first: "de primeira", stat_cleared: "concluídas", stat_time: "tempo",
    weak_title: "Palavras para praticar", play_again: "🎴 Jogar de novo", home_btn: "🏠 Início",
    lock_hold: "Segure para desbloquear", install_btn: "Instalar",
    settings_title: "Configurações dos pais",
    tab_words: "📚 Palavras", tab_language: "🌐 Idioma", tab_game: "🎮 Jogo", tab_account: "☁️ Conta",
    done: "Pronto", label_category: "Categoria:",
    app_language: "Idioma do app:", app_language_hint: "Muda os botões e menus em todo o app.",
    output_language: "Idioma das palavras / voz:",
    label_voice: "Voz:", voice_test: "🔊 Testar voz", voice_refresh: "↻ Atualizar vozes",
    ko_alt: "Coreano: usar as palavras de um menino para irmãos (형 / 누나 em vez de 오빠 / 언니)",
    romaji_toggle: "Mostrar romaji / romanização (desativado por padrão)",
    online_voice: "Preferir voz online (precisa de internet; use se a voz do aparelho não funcionar)",
    label_online_key: "Chave de voz online:",
    label_choices: "Opções:", vibrate_toggle: "Vibrar ao errar (se suportado)",
    sound_toggle: "Ativar sons (sino/erro)", label_theme: "Tema:",
    childlock_header: "Bloqueio infantil",
    library_header: "Biblioteca compartilhada", label_library_id: "ID da biblioteca:", label_pin: "PIN (4 dígitos):",
    library_save: "Salvar e trocar", library_reset: "Voltar ao aparelho",
  },
  ja: {
    ob_sub: "まなぶ ことばを えらんでね", ob_start: "はじめる →",
    aria_lock: "チャイルドロック", aria_home: "ホームへ", aria_parent: "ほごしゃせってい",
    home_title: "コースを えらぼう",
    track_vocab: "たんご", track_vocab_sub: "きいて えを えらぼう",
    track_hiragana: "ひらがな", track_katakana: "カタカナ", track_kana_sub: "きいて えらぶ・かんせい",
    track_kanji: "かんじ", track_kanji_sub: "ちか日 こうかい",
    mode_tap: "きいて タッチ", mode_drag: "ドラッグで かんせい", mode_find: "さがそう 🔍",
    mode_flash: "フラッシュカード 🎴", mode_memory: "きおくゲーム 🧠",
    mode_kana_tap: "おと で えらぶ", mode_alphabet: "あいうえお", mode_quiz: "クイズ",
    flash_finish: "おわり ✓", flash_live_default: "ただしい えを タッチ",
    find_count_q: "えは いくつ？", quiz_prompt: "この おとの えを えらんで",
    fb_great: "せいかい！", fb_try_again: "もう いちど！", fb_see_again: "また でてくるよ！",
    fb_no_words: "ここには まだ ことばが ありません。せっていで ついか してね。",
    mem_look_listen: "みて きいてね…", mem_where: "どこ だった？ カードを タッチ！",
    mem_remembered: "おぼえてたね！ 🎉", mem_was_here: "ここ だったよ！また でてくるよ。",
    mem_watch: "よく みてね！",
    done_all: "ぜんぶ できた！", done_nice: "よく できました！",
    stat_correct: "せいかい", stat_first: "いっぱつ", stat_cleared: "クリア", stat_time: "じかん",
    weak_title: "れんしゅう する ことば", play_again: "🎴 もう いっかい", home_btn: "🏠 ホーム",
    lock_hold: "ながおしで かいじょ", install_btn: "インストール",
    settings_title: "ほごしゃ せってい",
    tab_words: "📚 ことば", tab_language: "🌐 げんご", tab_game: "🎮 ゲーム", tab_account: "☁️ アカウント",
    done: "かんりょう", label_category: "カテゴリ:",
    app_language: "アプリの げんご:", app_language_hint: "アプリぜんたいの ボタンや メニューを かえます。",
    output_language: "ことば・こえの げんご:",
    label_voice: "こえ:", voice_test: "🔊 こえを ためす", voice_refresh: "↻ こえを こうしん",
    ko_alt: "かんこくご: きょうだいの よびかたを だんせいよう にする（오빠 / 언니 の かわりに 형 / 누나）",
    romaji_toggle: "ローマじを ひょうじ（きほんは オフ）",
    online_voice: "オンラインの こえを ゆうせん（ネットが ひつよう）",
    label_online_key: "オンラインこえ キー:",
    label_choices: "せんたくし:", vibrate_toggle: "まちがえたら しんどう（たいおうき のみ）",
    sound_toggle: "おとを ゆうこう（チャイム／ブザー）", label_theme: "テーマ:",
    childlock_header: "チャイルドロック",
    library_header: "きょうゆう ライブラリ", label_library_id: "ライブラリID:", label_pin: "PIN（4けた）:",
    library_save: "ほぞんして きりかえ", library_reset: "たんまつに もどす",
  },
  ko: {
    ob_sub: "배울 언어를 골라요", ob_start: "시작하기 →",
    aria_lock: "어린이 잠금", aria_home: "홈으로", aria_parent: "부모 설정",
    home_title: "코스를 골라요",
    track_vocab: "낱말", track_vocab_sub: "듣고 그림 맞추기",
    track_hiragana: "히라가나", track_katakana: "가타카나", track_kana_sub: "듣고 고르기·완성",
    track_kanji: "한자", track_kanji_sub: "곧 나와요",
    mode_tap: "듣고 터치", mode_drag: "끌어서 완성", mode_find: "찾아봐 🔍",
    mode_flash: "플래시 카드 🎴", mode_memory: "기억 게임 🧠",
    mode_kana_tap: "소리로 고르기", mode_alphabet: "글자", mode_quiz: "퀴즈",
    flash_finish: "끝내기 ✓", flash_live_default: "맞는 그림을 터치",
    find_count_q: "그림은 몇 개?", quiz_prompt: "이 소리의 그림을 골라요",
    fb_great: "잘했어요!", fb_try_again: "다시 해봐요!", fb_see_again: "또 나올 거예요!",
    fb_no_words: "아직 낱말이 없어요. 부모 설정에서 추가하세요.",
    mem_look_listen: "보고 들어요…", mem_where: "어디였을까? 카드를 터치!",
    mem_remembered: "기억했어요! 🎉", mem_was_here: "여기였어요! 또 나올 거예요.",
    mem_watch: "잘 보세요!",
    done_all: "다 했어요!", done_nice: "잘했어요!",
    stat_correct: "정답", stat_first: "한 번에", stat_cleared: "완료", stat_time: "시간",
    weak_title: "연습할 낱말", play_again: "🎴 다시 하기", home_btn: "🏠 홈",
    lock_hold: "길게 눌러 잠금 해제", install_btn: "설치",
    settings_title: "부모 설정",
    tab_words: "📚 낱말", tab_language: "🌐 언어", tab_game: "🎮 게임", tab_account: "☁️ 계정",
    done: "완료", label_category: "분류:",
    app_language: "앱 언어:", app_language_hint: "앱 전체의 버튼과 메뉴를 바꿔요.",
    output_language: "낱말 / 음성 언어:",
    label_voice: "음성:", voice_test: "🔊 음성 테스트", voice_refresh: "↻ 음성 새로고침",
    ko_alt: "한국어: 남자아이 기준 호칭 사용 (오빠 / 언니 대신 형 / 누나)",
    romaji_toggle: "로마자 표기 보이기 (기본은 꺼짐)",
    online_voice: "온라인 음성 우선 (인터넷 필요; 기기 음성이 안 되면 사용)",
    label_online_key: "온라인 음성 키:",
    label_choices: "선택지:", vibrate_toggle: "틀리면 진동 (지원 시)",
    sound_toggle: "소리 켜기 (차임/버저)", label_theme: "테마:",
    childlock_header: "어린이 잠금",
    library_header: "공유 라이브러리", label_library_id: "라이브러리 ID:", label_pin: "PIN (4자리):",
    library_save: "저장 후 전환", library_reset: "기기로 되돌리기",
  },
};

// Look up a UI string in the current app language, falling back to English.
// Returns null when no key exists anywhere, so applyI18n can leave the original
// (English) DOM text untouched for strings that were never translated.
function t(key, vars) {
  const table = I18N[state.uiLang] || I18N.en;
  let s = table[key] != null ? table[key] : I18N.en[key];
  if (s == null) return null;
  if (vars) Object.keys(vars).forEach((k) => { s = s.split("{" + k + "}").join(vars[k]); });
  return s;
}

// Push the current app language into the DOM. data-i18n sets textContent,
// data-i18n-ph sets the placeholder, data-i18n-aria sets aria-label. Elements
// wrap translatable label text in their own <span data-i18n> so nested <select>
// / <input> controls are never clobbered.
function applyI18n(root) {
  root = root || document;
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const s = t(el.getAttribute("data-i18n"));
    if (s != null) el.textContent = s;
  });
  root.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    const s = t(el.getAttribute("data-i18n-ph"));
    if (s != null) el.setAttribute("placeholder", s);
  });
  root.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const s = t(el.getAttribute("data-i18n-aria"));
    if (s != null) el.setAttribute("aria-label", s);
  });
  document.documentElement.lang = state.uiLang;
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
  uiLangSelect: document.getElementById("ui-lang-select"),
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
  settingsTabs: document.getElementById("settings-tabs"),
  wordAddToggle: document.getElementById("word-add-toggle"),
  addWordForm: document.getElementById("add-word-form"),
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
  stockSearchDots: document.getElementById("stock-search-dots"),
  stockAdd: document.getElementById("stock-add"),
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
  newWordSuggest: document.getElementById("new-word-suggest"),
  newWordSuggestions: document.getElementById("new-word-suggestions"),
  imageModalEdit: document.getElementById("image-modal-edit"),
  readingEditor: document.getElementById("reading-editor"),
  readingInput: document.getElementById("reading-input"),
  readingRomaji: document.getElementById("reading-romaji"),
  readingSpeechRow: document.getElementById("reading-speech-row"),
  readingSpeech: document.getElementById("reading-speech"),
  readingSuggest: document.getElementById("reading-suggest"),
  readingSave: document.getElementById("reading-save"),
  readingSuggestions: document.getElementById("reading-suggestions"),
  readingStatus: document.getElementById("reading-status"),
  wordSyncIndicator: document.getElementById("word-sync-indicator"),
  voiceTestBtn: document.getElementById("voice-test-btn"),
  voiceRefreshBtn: document.getElementById("voice-refresh-btn"),
  voiceTestStatus: document.getElementById("voice-test-status"),
  onlineVoiceToggle: document.getElementById("online-voice-toggle"),
  ttsApiKeyInput: document.getElementById("tts-api-key"),
  elevenToggle: document.getElementById("eleven-toggle"),
  elevenKeyInput: document.getElementById("eleven-key"),
  elevenLoadVoicesBtn: document.getElementById("eleven-load-voices"),
  elevenTestBtn: document.getElementById("eleven-test"),
  elevenVoiceSelect: document.getElementById("eleven-voice"),
  elevenModelSelect: document.getElementById("eleven-model"),
  elevenSyncKeyToggle: document.getElementById("eleven-sync-key"),
  elevenPregenBtn: document.getElementById("eleven-pregen"),
  elevenClearCacheBtn: document.getElementById("eleven-clear-cache"),
  elevenStatus: document.getElementById("eleven-status"),
  quickAddCategory: document.getElementById("quick-add-category"),
  quickAddInput: document.getElementById("quick-add-input"),
  quickAddBtn: document.getElementById("quick-add-btn"),
  quickAddStatus: document.getElementById("quick-add-status"),
  flashComplete: document.getElementById("flash-complete"),
  flashCompleteTitle: document.getElementById("flash-complete-title"),
  flashCompleteEmoji: document.getElementById("flash-complete-emoji"),
  flashStatScore: document.getElementById("flash-stat-score"),
  flashStatFirst: document.getElementById("flash-stat-first"),
  flashStatCleared: document.getElementById("flash-stat-cleared"),
  flashStatTime: document.getElementById("flash-stat-time"),
  flashBar: document.getElementById("flash-bar"),
  flashWeakSection: document.getElementById("flash-weak-section"),
  flashWeakList: document.getElementById("flash-weak-list"),
  flashAgain: document.getElementById("flash-again"),
  flashHome: document.getElementById("flash-home"),
  lockButton: document.getElementById("lock-button"),
  lockBadge: document.getElementById("lock-badge"),
  lockRingFill: document.getElementById("lock-ring-fill"),
  catAddToggle: document.getElementById("cat-add-toggle"),
  catAddForm: document.getElementById("cat-add-form"),
  catAddEmoji: document.getElementById("cat-add-emoji"),
  catAddName: document.getElementById("cat-add-name"),
  catAddBtn: document.getElementById("cat-add-btn"),
  catAddStatus: document.getElementById("cat-add-status"),
  catSuggestList: document.getElementById("cat-suggest-list"),
  stockUrlInput: document.getElementById("stock-url-input"),
  stockUrlAdd: document.getElementById("stock-url-add"),
  flashFinish: document.getElementById("flash-finish"),
  flashLiveScore: document.getElementById("flash-live-score"),
  googleImgKey: document.getElementById("google-img-key"),
  googleImgCx: document.getElementById("google-img-cx"),
};

const SUPABASE_URL = "https://nfaxncksesfcfqavmlae.supabase.co";
const SUPABASE_KEY = "sb_publishable_tOW43SppvjqItz5vGlLpiQ_W3t4CMR_";
const SUPABASE_BUCKET = "kitai-images";

document.addEventListener("DOMContentLoaded", init);

async function init() {
  loadThemePref();
  loadLangPref();
  loadVoicePref();
  loadElevenPrefs();
  loadLibraryConfig();
  await loadData();
  await loadHiragana();
  await loadKatakana();
  await loadImageOverrides();
  buildImageManager();
  await setupVoices();
  applyTheme();
  applyI18n();
  applyLangToUI();
  bindUI();
  registerServiceWorker();
  goHome();
  maybeShowOnboarding();
  ensureStoragePrefix()
    .then(() => {
      syncImagesFromSupabase().catch(() => {});
      syncWordsWithCloud().catch(() => {});
      // Only adopt the cloud voice setup on a device that hasn't been set up
      // locally — otherwise a fresh login would clobber a working local key.
      if (!state.eleven.key) pullElevenCloudSettings().catch(() => {});
    })
    .catch(() => {});
}

async function loadData() {
  const res = await fetch("data/vocab.json");
  state.data = await res.json();
  state.builtinCategories = state.data.categories;
  // Items with no image file but an `emoji`/glyph (e.g. numbers) get a
  // generated picture so they render like any other word.
  state.builtinItems = state.data.items.map((it) =>
    !it.imagePath && !it.photoUrl && it.emoji ? { ...it, imagePath: placeholderImage(it.emoji) } : it
  );
  state.wordManifest = loadWordManifest();
  applyWordManifestToState(); // also builds state.categories (built-in + custom)
  updateWordSyncIndicator();
  refreshCategoryUI();
}

// (Re)populate every category dropdown + the picture-manager pills from the
// current state.categories, preserving the user's current selections. Call this
// after any category add/remove or a cloud sync.
function refreshCategoryUI() {
  const fillPlain = (sel) => {
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = "";
    state.categories.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = `${cat.emoji} ${cat.label_en}`;
      sel.appendChild(opt);
    });
    if (prev && state.categories.some((c) => c.id === prev)) sel.value = prev;
  };
  fillPlain(els.newWordCategory);
  fillPlain(els.quickAddCategory);

  [els.categorySelect, els.categoryQuick].forEach((sel) => {
    if (!sel) return;
    const prev = sel.value || state.categoryId;
    sel.innerHTML = "";
    const mixedOpt = document.createElement("option");
    mixedOpt.value = "mixed";
    mixedOpt.textContent = "Mixed";
    sel.appendChild(mixedOpt);
    state.categories.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = `${cat.emoji} ${cat.label_en}`;
      sel.appendChild(opt);
    });
    if (prev && (prev === "mixed" || state.categories.some((c) => c.id === prev))) sel.value = prev;
  });

  if (state.currentSection !== "home" || els.imageCategoryPills) renderImageList();
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
    const savedUi = localStorage.getItem(UI_LANG_KEY);
    if (savedUi && I18N[savedUi]) state.uiLang = savedUi;
    state.koAltReading = localStorage.getItem("kitai-ko-alt") === "1";
  } catch (_) {}
}

// Reflect the current language in the UI: keep the picker in sync and hide the
// Japanese-only script tracks (Hiragana/Katakana/Kanji) when not in Japanese.
function applyLangToUI() {
  if (els.langSelect) els.langSelect.value = state.lang;
  if (els.uiLangSelect) els.uiLangSelect.value = state.uiLang;
  if (els.koAltToggle) els.koAltToggle.checked = state.koAltReading;
  const kana = langCfg().kana;
  document.querySelectorAll('.tile[data-track="hiragana"], .tile[data-track="katakana"], .tile[data-track="kanji"]').forEach((tile) => {
    tile.classList.toggle("hidden", !kana);
  });
}

// Switch the app's own interface language and re-render all the chrome. Doesn't
// touch the language being taught (state.lang) — the two are independent.
function setUiLanguage(uiLang) {
  if (!I18N[uiLang]) return;
  state.uiLang = uiLang;
  try { localStorage.setItem(UI_LANG_KEY, uiLang); } catch (_) {}
  applyI18n();
  // Relabel the mode buttons in the new language without dropping the player's
  // current mode (updateModeButtonsForTrack resets it, so save + restore).
  const savedType = state.currentGameType;
  updateModeButtonsForTrack(state.currentTrack);
  state.currentGameType = savedType;
  setActiveModeButton(savedType);
  if (state.currentSection === "game") startRound();
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

const MAX_PHOTOS_PER_ITEM = 30;

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
  return { items: {}, deleted: {}, categories: {}, deletedCategories: {} };
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
    jaKana: item.jaKana || "",
    jaRomaji: item.jaRomaji || "",
    updatedAt: ts || item.updatedAt || Date.now(),
  };
  if (item.ko) w.ko = item.ko;
  if (item.koRomaji) w.koRomaji = item.koRomaji;
  if (item.jaSpeech) w.jaSpeech = item.jaSpeech;
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
    jaKana: w.jaKana || "",
    jaRomaji: w.jaRomaji || "",
    jaSpeech: w.jaSpeech || "",
    ko: w.ko || "",
    koRomaji: w.koRomaji || "",
    imagePath: placeholderImage(cat ? cat.emoji : "⭐"),
    aliases: [],
    custom: true,
    updatedAt: w.updatedAt || 0,
  };
  if (w.photoUrl) item.photoUrl = w.photoUrl;
  return item;
}

// Patch an existing (built-in) item in place with a manifest record's reading
// fields — used when a parent fixes a built-in word's pronunciation.
function applyWordOverride(item, w) {
  if (w.en) item.en = w.en;
  if (w.jaKana) item.jaKana = w.jaKana;
  if ("jaRomaji" in w) item.jaRomaji = w.jaRomaji;
  if ("jaSpeech" in w) item.jaSpeech = w.jaSpeech;
  if (w.ko) item.ko = w.ko;
  if ("koRomaji" in w) item.koRomaji = w.koRomaji;
  if (w.photoUrl) item.photoUrl = w.photoUrl;
}

// Rebuild state.categories from the built-in list (vocab.json) plus any custom
// categories in the manifest, honoring category tombstones. Custom categories
// sort after built-ins by creation time.
function applyCategoryManifestToState() {
  const m = state.wordManifest || emptyManifest();
  const deleted = m.deletedCategories || {};
  const builtin = (state.builtinCategories || []).filter((c) => !deleted[c.id]);
  const customIds = new Set(builtin.map((c) => c.id));
  const custom = Object.values(m.categories || {})
    .filter((c) => c && c.id && !deleted[c.id] && !customIds.has(c.id))
    .sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0))
    .map((c) => ({
      id: c.id,
      emoji: c.emoji || "📦",
      label_en: c.label_en || c.id,
      label_ja: c.label_ja || c.label_en || c.id,
      label_ko: c.label_ko || c.label_en || c.id,
      custom: true,
    }));
  state.categories = builtin.concat(custom);
}

function applyWordManifestToState() {
  applyCategoryManifestToState();
  const m = state.wordManifest || emptyManifest();
  // Honor deletions for built-in words too (not just custom ones), so a parent
  // can remove any word from the games. The tombstone syncs across devices.
  // Clone built-ins so reading overrides never mutate the originals (keeps
  // re-applying idempotent — we always start from the pristine built-in list).
  const builtinIds = new Set((state.builtinItems || []).map((it) => it.id));
  const base = (state.builtinItems || []).filter((it) => !m.deleted[it.id]).map((it) => ({ ...it }));
  const byId = new Map(base.map((it) => [it.id, it]));
  const extras = [];
  Object.values(m.items).forEach((w) => {
    if (builtinIds.has(w.id)) {
      // A record keyed by a built-in id is a reading override, not a new word.
      const it = byId.get(w.id);
      if (it) applyWordOverride(it, w);
    } else {
      extras.push(wordToItem(w));
    }
  });
  state.items = base.concat(extras);
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
  // Same last-write-wins merge for custom categories + their tombstones.
  const catIds = new Set([
    ...Object.keys(a.categories || {}),
    ...Object.keys(b.categories || {}),
    ...Object.keys(a.deletedCategories || {}),
    ...Object.keys(b.deletedCategories || {}),
  ]);
  catIds.forEach((id) => {
    const ac = (a.categories || {})[id];
    const bc = (b.categories || {})[id];
    const cat = ac && bc ? ((ac.updatedAt || 0) >= (bc.updatedAt || 0) ? ac : bc) : ac || bc;
    const catTs = cat ? cat.updatedAt || 0 : 0;
    const delTs = Math.max((a.deletedCategories || {})[id] || 0, (b.deletedCategories || {})[id] || 0);
    if (delTs && delTs >= catTs) {
      out.deletedCategories[id] = delTs;
    } else if (cat) {
      out.categories[id] = cat;
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
  // The kitai-images bucket only accepts image MIME types, so the manifest
  // (JSON) is stored under an image content-type. The bytes are still JSON and
  // fetch's res.json() parses them back fine regardless of content-type.
  const body = new Blob([JSON.stringify(m)], { type: "image/svg+xml" });
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${wordsCloudPath(prefix)}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "x-upsert": "true",
      "Content-Type": "image/svg+xml",
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
    refreshCategoryUI();
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

// Tabbed Parent Settings: show one panel at a time.
function setupSettingsTabs() {
  if (!els.settingsTabs) return;
  const tabs = Array.from(els.settingsTabs.querySelectorAll(".settings-tab"));
  const panels = Array.from(document.querySelectorAll("#settings .settings-panel"));
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.toggle("active", t === tab));
      panels.forEach((p) => p.classList.toggle("hidden", p.dataset.panel !== tab.dataset.tab));
    });
  });
}

// --- English → Japanese/Korean word suggestions --------------------------
//
// The parent can type just the English word and let the app propose the native
// spelling(s) to pick from. We translate with a free, no-key, CORS-friendly
// endpoint (same philosophy as the Wikimedia photo search), then offer the
// native form plus hiragana/katakana variants. Everything is a *suggestion* the
// parent taps to accept and can still edit, so an imperfect reading is fine —
// the "Edit word" reading editor exists precisely to fix it.

// Hepburn-ish romaji → hiragana. Deterministic and compact; covers the kana a
// toddler word list needs. Longer keys are matched first by the tokenizer.
const ROMAJI_TO_HIRAGANA = {
  a: "あ", i: "い", u: "う", e: "え", o: "お",
  ka: "か", ki: "き", ku: "く", ke: "け", ko: "こ",
  ga: "が", gi: "ぎ", gu: "ぐ", ge: "げ", go: "ご",
  sa: "さ", shi: "し", si: "し", su: "す", se: "せ", so: "そ",
  za: "ざ", ji: "じ", zi: "じ", zu: "ず", ze: "ぜ", zo: "ぞ",
  ta: "た", chi: "ち", ti: "ち", tsu: "つ", tu: "つ", te: "て", to: "と",
  da: "だ", di: "ぢ", du: "づ", de: "で", do: "ど",
  na: "な", ni: "に", nu: "ぬ", ne: "ね", no: "の",
  ha: "は", hi: "ひ", fu: "ふ", hu: "ふ", he: "へ", ho: "ほ",
  ba: "ば", bi: "び", bu: "ぶ", be: "べ", bo: "ぼ",
  pa: "ぱ", pi: "ぴ", pu: "ぷ", pe: "ぺ", po: "ぽ",
  ma: "ま", mi: "み", mu: "む", me: "め", mo: "も",
  ya: "や", yu: "ゆ", yo: "よ",
  ra: "ら", ri: "り", ru: "る", re: "れ", ro: "ろ",
  wa: "わ", wo: "を", wi: "うぃ", we: "うぇ",
  va: "ゔぁ", vi: "ゔぃ", vu: "ゔ", ve: "ゔぇ", vo: "ゔぉ",
  fa: "ふぁ", fi: "ふぃ", fe: "ふぇ", fo: "ふぉ",
  kya: "きゃ", kyu: "きゅ", kyo: "きょ",
  gya: "ぎゃ", gyu: "ぎゅ", gyo: "ぎょ",
  sha: "しゃ", shu: "しゅ", sho: "しょ", sya: "しゃ", syu: "しゅ", syo: "しょ",
  ja: "じゃ", ju: "じゅ", jo: "じょ", jya: "じゃ", jyu: "じゅ", jyo: "じょ",
  cha: "ちゃ", chu: "ちゅ", cho: "ちょ", cya: "ちゃ",
  nya: "にゃ", nyu: "にゅ", nyo: "にょ",
  hya: "ひゃ", hyu: "ひゅ", hyo: "ひょ",
  bya: "びゃ", byu: "びゅ", byo: "びょ",
  pya: "ぴゃ", pyu: "ぴゅ", pyo: "ぴょ",
  mya: "みゃ", myu: "みゅ", myo: "みょ",
  rya: "りゃ", ryu: "りゅ", ryo: "りょ",
};

function romajiToHiragana(input) {
  if (!input) return "";
  let s = String(input).toLowerCase();
  // Macrons (Hepburn long vowels) → doubled vowels.
  s = s.replace(/ā/g, "aa").replace(/ī/g, "ii").replace(/ū/g, "uu").replace(/ē/g, "ee").replace(/ō/g, "ou");
  s = s.replace(/[^a-z']/g, "");
  let out = "";
  let i = 0;
  while (i < s.length) {
    // Small tsu (っ) from a doubled consonant, incl. the "tch" spelling.
    if (s.substr(i, 3) === "tch") { out += "っ"; i += 1; continue; }
    const c = s[i];
    if (c !== "n" && /[bcdfghjkmpqrstvwyz]/.test(c) && s[i + 1] === c) { out += "っ"; i += 1; continue; }
    // Syllabic ん before a consonant / end of word.
    if (c === "n" && (i + 1 >= s.length || !/[aiueoy]/.test(s[i + 1]))) {
      out += "ん"; i += 1;
      if (s[i] === "'") i += 1;
      continue;
    }
    let matched = false;
    for (let len = 3; len >= 1; len--) {
      const chunk = s.substr(i, len);
      if (ROMAJI_TO_HIRAGANA[chunk]) { out += ROMAJI_TO_HIRAGANA[chunk]; i += len; matched = true; break; }
    }
    if (!matched) i += 1;
  }
  return out;
}

function hiraToKata(s) {
  return String(s || "").replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
}
function kataToHira(s) {
  return String(s || "").replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}
function isKanaOnly(s) {
  return !!s && /^[぀-ヿーｦ-ﾟ\s]+$/.test(s);
}
function scriptTag(s) {
  if (/[一-鿿]/.test(s)) return "Kanji";
  if (/[ァ-ヿｦ-ﾟ]/.test(s) && !/[぀-ゟ]/.test(s)) return "Katakana";
  if (/[぀-ゟ]/.test(s)) return "Hiragana";
  if (/[가-힣]/.test(s)) return "Hangul";
  return "Word";
}

// Translate one English term. `dt=t` gives the native form; `dt=rm` best-effort
// adds a romaji/romanized reading (may be absent for some words — that's ok).
async function translateWord(text, lang) {
  const base = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&dt=t&dt=rm&tl=";
  const url = base + encodeURIComponent(lang) + "&q=" + encodeURIComponent(text);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("translate http " + res.status);
  const data = await res.json();
  const rows = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : [];
  let native = "";
  let romaji = "";
  rows.forEach((r) => {
    if (!Array.isArray(r)) return;
    if (typeof r[0] === "string") native += r[0];
    // Transliteration rows carry the reading in slot [2] (and sometimes [3]);
    // a translit row has no r[0]. Take the first latin-looking value we find.
    if (!r[0]) {
      const cand = [r[2], r[3]].find((v) => typeof v === "string" && /[a-z]/i.test(v));
      if (cand) romaji += cand;
    }
  });
  return { native: native.trim(), romaji: romaji.trim() };
}

// Build the tappable candidates for an English word in the given language.
async function fetchWordSuggestions(english, lang) {
  const { native, romaji } = await translateWord(english, lang);
  const candidates = [];
  const seen = new Set();
  const push = (value, tag) => {
    const v = (value || "").trim();
    if (v && !seen.has(v)) { seen.add(v); candidates.push({ value: v, tag }); }
  };
  // The kanji form (when there is one) is the best thing to *speak*: it lets the
  // voice's dictionary apply the right pitch accent even if the parent chooses to
  // *display* the plain kana. Only meaningful when kanji is present.
  let speech = "";
  if (lang === "ja") {
    let hira = "";
    if (isKanaOnly(native)) hira = kataToHira(native);
    else if (romaji) hira = romajiToHiragana(romaji);
    const kata = hira ? hiraToKata(hira) : "";
    if (/[一-鿿]/.test(native)) speech = native;
    push(native, scriptTag(native));
    push(hira, "Hiragana");
    push(kata, "Katakana");
  } else {
    push(native, scriptTag(native));
  }
  return { candidates, romaji, speech };
}

// Render suggestion chips into `container`; `onPick(value, romaji)` fires on tap.
async function renderWordSuggestions(container, english, lang, onPick, statusEl) {
  if (!container) return;
  const q = (english || "").trim();
  if (!q) {
    container.innerHTML = '<div class="suggest-status">Type the English word first.</div>';
    return;
  }
  container.innerHTML = '<div class="suggest-status">Thinking…</div>';
  try {
    const { candidates, romaji, speech } = await fetchWordSuggestions(q, lang);
    container.innerHTML = "";
    if (!candidates.length) {
      container.innerHTML = '<div class="suggest-status">No suggestion — type it in below.</div>';
      return;
    }
    if (romaji) {
      const r = document.createElement("div");
      r.className = "suggest-romaji";
      r.textContent = "Reading: " + romaji;
      container.appendChild(r);
    }
    candidates.forEach((c) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "suggest-chip";
      const w = document.createElement("span");
      w.className = "chip-word";
      w.textContent = c.value;
      const t = document.createElement("span");
      t.className = "chip-tag";
      t.textContent = c.tag;
      chip.appendChild(w);
      chip.appendChild(t);
      onTap(chip, () => {
        container.querySelectorAll(".suggest-chip").forEach((el) => el.classList.remove("selected"));
        chip.classList.add("selected");
        onPick(c.value, romaji, speech);
      });
      container.appendChild(chip);
    });
  } catch (_) {
    container.innerHTML =
      '<div class="suggest-status">Couldn\'t reach the translator (needs internet). Type the word in below.</div>';
  }
}

// Look up multiple Japanese writings for a word/reading via Jotoba (CORS-enabled,
// no key). For homophones (はし → 橋 / 端 / 箸) this returns each kanji with its
// reading + English gloss so the parent can hear and pick the right one.
async function fetchJotobaCandidates(query) {
  try {
    const res = await fetch("https://jotoba.de/api/search/words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, language: "English", no_english: false }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const out = [];
    (data.words || []).forEach((w) => {
      const r = w.reading || {};
      const kana = r.kana || "";
      if (!kana) return;
      const gloss = (((w.senses || [])[0] || {}).glosses || []).slice(0, 2).join(", ");
      out.push({ kana, kanji: r.kanji || "", gloss });
    });
    return out.slice(0, 8);
  } catch (_) {
    return [];
  }
}

// A suggestion chip with its own 🔊 (hear it) button + a tappable body (pick it).
function buildSuggestChip(r, container, onPick) {
  const chip = document.createElement("div");
  chip.className = "suggest-chip rich";
  const play = document.createElement("button");
  play.type = "button";
  play.className = "chip-play";
  play.textContent = "🔊";
  play.setAttribute("aria-label", "Hear it");
  play.addEventListener("click", (e) => {
    e.stopPropagation();
    synthesize(r.speech || r.display, { showErrors: false });
  });
  const body = document.createElement("button");
  body.type = "button";
  body.className = "chip-body";
  const w = document.createElement("span");
  w.className = "chip-word";
  w.textContent = r.label;
  body.appendChild(w);
  if (r.sub) {
    const t = document.createElement("span");
    t.className = "chip-tag";
    t.textContent = r.sub;
    body.appendChild(t);
  }
  body.addEventListener("click", () => {
    container.querySelectorAll(".suggest-chip").forEach((el) => el.classList.remove("selected"));
    chip.classList.add("selected");
    onPick(r.display, r.romaji || "", r.speech && r.speech !== r.display ? r.speech : "");
  });
  chip.appendChild(play);
  chip.appendChild(body);
  return chip;
}

// Richer suggestions: Japanese uses Jotoba (multiple kanji per reading, each
// playable) + the translator's kana/katakana forms; Korean/English use the
// translator. `onPick(display, romaji, speech)` fires when a chip is chosen.
async function renderRichSuggestions(container, english, lang, onPick) {
  if (!container) return;
  const q = (english || "").trim();
  if (!q) {
    container.innerHTML = '<div class="suggest-status">Type the word first.</div>';
    return;
  }
  container.innerHTML = '<div class="suggest-status">Thinking…</div>';

  if (lang === "ja") {
    const [jotoba, tr] = await Promise.all([
      fetchJotobaCandidates(q),
      fetchWordSuggestions(q, "ja").catch(() => ({ candidates: [], romaji: "", speech: "" })),
    ]);
    const rows = [];
    const seen = new Set();
    jotoba.forEach((c) => {
      const key = (c.kanji || c.kana) + "|" + c.kana;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({
        display: c.kana,
        speech: c.kanji || c.kana,
        label: c.kanji || c.kana,
        sub: (c.kanji ? c.kana + " · " : "") + (c.gloss || ""),
      });
    });
    (tr.candidates || []).forEach((c) => {
      const key = c.value + "|" + c.value;
      if (seen.has(key)) return;
      seen.add(key);
      const sp = tr.speech && /[一-鿿]/.test(tr.speech) ? tr.speech : c.value;
      rows.push({ display: c.value, speech: sp, label: c.value, sub: c.tag });
    });
    container.innerHTML = "";
    if (!rows.length) {
      container.innerHTML = '<div class="suggest-status">No suggestion — type it in below.</div>';
      return;
    }
    rows.forEach((r) => container.appendChild(buildSuggestChip(r, container, onPick)));
    return;
  }

  try {
    const { candidates, romaji } = await fetchWordSuggestions(q, lang);
    container.innerHTML = "";
    if (!candidates.length) {
      container.innerHTML = '<div class="suggest-status">No suggestion — type it in below.</div>';
      return;
    }
    if (romaji) {
      const rDiv = document.createElement("div");
      rDiv.className = "suggest-romaji";
      rDiv.textContent = "Reading: " + romaji;
      container.appendChild(rDiv);
    }
    candidates.forEach((c) =>
      container.appendChild(
        buildSuggestChip({ display: c.value, speech: c.value, label: c.value, sub: c.tag, romaji }, container, onPick)
      )
    );
  } catch (_) {
    container.innerHTML =
      '<div class="suggest-status">Couldn\'t reach the dictionary (needs internet). Type the word in below.</div>';
  }
}

// The language whose native word we generate/edit. English mode has no reading
// to suggest, so we fall back to Japanese suggestions there.
function suggestLang() {
  return state.lang === "ko" ? "ko" : "ja";
}

// "Add a word" shown right inside the Words tab; pre-fills the category the
// parent is currently viewing (e.g. browsing People → new word defaults to People).
function toggleAddWordForm() {
  if (!els.addWordForm) return;
  const opening = els.addWordForm.classList.contains("hidden");
  els.addWordForm.classList.toggle("hidden", !opening);
  if (opening && els.newWordCategory && state.imageCategoryId && state.imageCategoryId !== "all") {
    els.newWordCategory.value = state.imageCategoryId;
  }
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
  if (!en) {
    setNewWordStatus("Please enter the English name.", true);
    return;
  }
  if (!kana && state.lang !== "en") {
    setNewWordStatus("Please enter the word in the selected language.", true);
    return;
  }
  if (photo && !/^https?:\/\//i.test(photo)) {
    setNewWordStatus("Photo URL must start with http:// or https://", true);
    return;
  }

  const cat = state.categories.find((c) => c.id === categoryId);
  const now = Date.now();
  const id = `custom-${now}-${Math.random().toString(36).slice(2, 7)}`;
  // Store the typed word into whichever language is active so it shows there.
  const word = { id, categoryId, en, updatedAt: now };
  if (state.lang === "ko") {
    word.ko = kana;
    word.koRomaji = romaji;
  } else if (kana) {
    word.jaKana = kana;
    word.jaRomaji = romaji;
    // Kanji spoken form captured from a suggestion — kept only when it differs
    // from the displayed kana, so the voice can apply the correct pitch accent.
    const speech = els.addWordForm ? els.addWordForm.dataset.speech || "" : "";
    if (speech && speech !== kana) word.jaSpeech = speech;
  }
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
  if (els.newWordSuggestions) els.newWordSuggestions.innerHTML = "";
  if (els.addWordForm) delete els.addWordForm.dataset.speech;
  setNewWordStatus(`Added "${en}" to ${cat ? cat.label_en : categoryId}. ✓`);

  renderImageList();
  if (state.currentTrack === "vocab") renderCurrentView();
  syncWordsWithCloud().catch(() => {});

  // Straight into picking pictures for the new word (unless a photo URL was
  // already given). Opens the same Wikimedia picker, seeded with the English.
  if (!photo) promptPhotosForItem(id);
}

// ---- Custom categories -----------------------------------------------------

function setCatAddStatus(msg, isError) {
  if (!els.catAddStatus) return;
  els.catAddStatus.textContent = msg || "";
  els.catAddStatus.classList.toggle("error", !!isError);
}

function toggleCategoryForm() {
  if (!els.catAddForm) return;
  els.catAddForm.classList.toggle("hidden");
  if (!els.catAddForm.classList.contains("hidden") && els.catAddName) els.catAddName.focus();
}

async function addCategoryFromForm() {
  const name = (els.catAddName?.value || "").trim();
  let emoji = (els.catAddEmoji?.value || "").trim();
  if (!name) { setCatAddStatus("Type a category name.", true); return; }
  // Grab the first emoji/character as the icon; default to a box.
  emoji = Array.from(emoji)[0] || "📦";
  const now = Date.now();
  const base = "cat-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  let id = base || "cat-" + now;
  const exists = (cid) => state.categories.some((c) => c.id === cid);
  if (exists(id)) id = `${base}-${Math.random().toString(36).slice(2, 5)}`;

  // Try to localize the label for the spoken languages (nice-to-have; ignore failures).
  let label_ja = name, label_ko = name;
  try { const t = await translateWord(name, "ja"); if (t.native) label_ja = t.native; } catch (_) {}
  try { const t = await translateWord(name, "ko"); if (t.native) label_ko = t.native; } catch (_) {}

  if (!state.wordManifest) state.wordManifest = emptyManifest();
  state.wordManifest.categories[id] = { id, emoji, label_en: name, label_ja, label_ko, updatedAt: now };
  delete state.wordManifest.deletedCategories[id];
  saveWordManifest(state.wordManifest);
  applyWordManifestToState();
  refreshCategoryUI();

  if (els.catAddName) els.catAddName.value = "";
  if (els.catAddEmoji) els.catAddEmoji.value = "";
  setCatAddStatus(`Added category "${emoji} ${name}". ✓`);
  // Point the add-word + picture views at the new category and offer word ideas.
  state.imageCategoryId = id;
  if (els.newWordCategory) els.newWordCategory.value = id;
  if (els.quickAddCategory) els.quickAddCategory.value = id;
  renderImageList();
  suggestWordsForCategory(name, id);
  syncWordsWithCloud().catch(() => {});
}

function removeCustomCategory(id) {
  const cat = state.categories.find((c) => c.id === id);
  if (!cat || !cat.custom) return;
  const n = state.items.filter((i) => i.categoryId === id).length;
  const msg = n
    ? `Remove the category "${cat.label_en}" and its ${n} word${n > 1 ? "s" : ""}?`
    : `Remove the category "${cat.label_en}"?`;
  if (!confirm(msg)) return;
  if (!state.wordManifest) state.wordManifest = emptyManifest();
  const now = Date.now();
  delete state.wordManifest.categories[id];
  state.wordManifest.deletedCategories[id] = now;
  // Tombstone every custom word in it too.
  state.items.filter((i) => i.categoryId === id && i.custom).forEach((i) => {
    delete state.wordManifest.items[i.id];
    state.wordManifest.deleted[i.id] = now;
  });
  saveWordManifest(state.wordManifest);
  if (state.imageCategoryId === id) state.imageCategoryId = "all";
  if (state.categoryId === id) state.categoryId = "mixed";
  applyWordManifestToState();
  refreshCategoryUI();
  if (state.currentTrack === "vocab") renderCurrentView();
  syncWordsWithCloud().catch(() => {});
}

// ---- Word suggestions for a category (keyless) -----------------------------
// A built-in toddler word bank covers common categories; Datamuse fills in
// anything else. Tapping a suggestion adds it (auto-translated) to the category.

const WORD_BANK = {
  animal: ["dog","cat","cow","horse","pig","sheep","goat","chicken","duck","rabbit","mouse","fox","bear","lion","tiger","elephant","monkey","giraffe","zebra","kangaroo","panda","deer","wolf","frog"],
  fruit: ["apple","banana","orange","grape","strawberry","watermelon","peach","pear","cherry","lemon","pineapple","mango","kiwi","melon","plum","blueberry"],
  vegetable: ["carrot","potato","tomato","onion","cucumber","corn","pumpkin","broccoli","pepper","lettuce","peas","mushroom","eggplant","spinach"],
  food: ["rice","bread","egg","milk","cheese","soup","noodles","pizza","sandwich","cookie","cake","apple","banana","fish","meat","yogurt"],
  drink: ["water","milk","juice","tea","coffee","soda","smoothie"],
  color: ["red","blue","green","yellow","orange","purple","pink","brown","black","white","gray"],
  body: ["head","hair","eye","ear","nose","mouth","hand","arm","leg","foot","finger","tooth","tummy","knee"],
  family: ["mom","dad","baby","sister","brother","grandma","grandpa","aunt","uncle"],
  vehicle: ["car","bus","truck","train","airplane","boat","bike","motorcycle","helicopter","fire truck","police car","tractor"],
  clothes: ["shirt","pants","dress","socks","shoes","hat","jacket","gloves","scarf","pajamas"],
  shape: ["circle","square","triangle","star","heart","rectangle","oval","diamond"],
  toy: ["ball","blocks","doll","teddy bear","car","puzzle","kite","balloon","drum","train"],
  nature: ["tree","flower","sun","moon","star","cloud","rain","snow","mountain","river","grass","leaf"],
  weather: ["sunny","rainy","cloudy","snowy","windy","hot","cold","rainbow"],
  house: ["door","window","bed","chair","table","sofa","lamp","clock","cup","spoon","fork","plate"],
  insect: ["ant","bee","butterfly","ladybug","spider","grasshopper","caterpillar","dragonfly"],
  bird: ["chicken","duck","owl","eagle","penguin","parrot","pigeon","swan","peacock"],
  sea: ["fish","whale","dolphin","shark","octopus","crab","turtle","starfish","jellyfish","seahorse"],
  job: ["doctor","teacher","police officer","firefighter","chef","farmer","nurse","pilot","dentist"],
  sport: ["soccer","baseball","basketball","tennis","swimming","running","skiing","cycling"],
  instrument: ["piano","guitar","drum","violin","flute","trumpet"],
  emotion: ["happy","sad","angry","scared","sleepy","surprised","excited"],
};

function lookupWordBank(label) {
  const key = label.toLowerCase().trim().replace(/s$/, "");
  if (WORD_BANK[key]) return WORD_BANK[key].slice();
  // Loose contains-match (e.g. "farm animals" -> animal, "sea creatures" -> sea).
  for (const k of Object.keys(WORD_BANK)) {
    if (key.includes(k) || k.includes(key)) return WORD_BANK[k].slice();
  }
  return [];
}

async function datamuseSuggest(label) {
  try {
    const url = "https://api.datamuse.com/words?max=40&md=p&ml=" + encodeURIComponent(label);
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data
      .filter((w) => (w.tags || []).includes("n")) // nouns only
      .map((w) => w.word)
      .filter((w) => /^[a-z][a-z '-]*$/i.test(w) && w.toLowerCase() !== label.toLowerCase());
  } catch (_) {
    return [];
  }
}

async function suggestWordsForCategory(label, categoryId) {
  const container = els.catSuggestList;
  if (!container) return;
  container.innerHTML = '<div class="suggest-status">Finding ideas…</div>';
  const seen = new Set();
  const words = [];
  const push = (w) => {
    const v = (w || "").trim();
    const k = v.toLowerCase();
    if (v && !seen.has(k)) { seen.add(k); words.push(v.replace(/\b\w/g, (c) => c.toUpperCase())); }
  };
  lookupWordBank(label).forEach(push);
  if (words.length < 12) (await datamuseSuggest(label)).forEach(push);

  // Don't re-suggest words already in the category.
  const have = new Set(
    state.items.filter((i) => i.categoryId === categoryId).map((i) => (i.en || "").toLowerCase())
  );
  const fresh = words.filter((w) => !have.has(w.toLowerCase())).slice(0, 30);

  container.innerHTML = "";
  if (!fresh.length) {
    container.innerHTML = '<div class="suggest-status">No ideas found — add words yourself below.</div>';
    return;
  }
  const hint = document.createElement("div");
  hint.className = "suggest-status";
  hint.textContent = "Tap to add (we fill in the reading). Add as many as you like:";
  container.appendChild(hint);
  fresh.forEach((w) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "suggest-chip cat-suggest-chip";
    chip.textContent = w;
    onTap(chip, async () => {
      if (chip.classList.contains("added")) return;
      chip.disabled = true;
      chip.textContent = w + " …";
      const ok = await addSuggestedWord(w, categoryId);
      chip.classList.add("added");
      chip.textContent = (ok ? "✓ " : "⚠ ") + w;
    });
    container.appendChild(chip);
  });
}

// Add one suggested English word to a category, auto-filling the reading.
async function addSuggestedWord(en, categoryId) {
  const now = Date.now();
  const id = `custom-${now}-${Math.random().toString(36).slice(2, 7)}`;
  const word = { id, categoryId, en, updatedAt: now };
  if (state.lang !== "en") {
    try {
      const { candidates, romaji, speech } = await fetchWordSuggestions(en, suggestLang());
      const best = candidates[0];
      if (state.lang === "ko") {
        word.ko = best ? best.value : en;
        if (romaji) word.koRomaji = romaji;
      } else {
        word.jaKana = best ? best.value : en;
        if (romaji) word.jaRomaji = romaji;
        if (speech && best && speech !== best.value) word.jaSpeech = speech;
      }
    } catch (_) { /* keep English-only; parent can fix the reading later */ }
  }
  if (!state.wordManifest) state.wordManifest = emptyManifest();
  state.wordManifest.items[id] = word;
  delete state.wordManifest.deleted[id];
  saveWordManifest(state.wordManifest);
  applyWordManifestToState();
  renderImageList();
  if (state.currentTrack === "vocab") renderCurrentView();
  syncWordsWithCloud().catch(() => {});
  return true;
}

// Open the per-word photo modal and jump right into the "Find Photos" search.
function promptPhotosForItem(itemId) {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return;
  openImageModal(item);
  toggleStockSearch();
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

// Save several photos to one word at once (gallery multi-select / batch stock
// pick). saveImageOverride already caps the word at MAX_PHOTOS_PER_ITEM.
async function saveImageOverridesBatch(itemId, files) {
  for (const file of files) {
    if (file) await saveImageOverride(itemId, file);
  }
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
      // The bucket only accepts image MIME types; default to one if the file
      // somehow has no type (otherwise the upload is rejected with 415).
      "Content-Type": (file.type && file.type.startsWith("image/")) ? file.type : "image/jpeg",
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
  // ...and so does the premium voice setup, so signing in on a new device or
  // login lands on the same voice without pasting the key again.
  if (state.eleven.key) pushElevenCloudSettings().catch(() => {});
  else pullElevenCloudSettings().catch(() => {});
}

function setupVoiceOptions() {
  els.voiceSelect.innerHTML = "";
  const prefix = langCfg().prefix;
  const voices = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith(prefix));
  state.voices = voices;

  if (!voices.length) {
    els.voiceWarning.textContent = `No ${langCfg().label} voice found. Playing without speech.`;
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

// --- Premium voice settings + cross-login sync ----------------------------

function elevenSay(msg, color) {
  const el = els.elevenStatus;
  if (!el) return;
  el.style.color = color || "#5a5564";
  el.textContent = msg;
}

function loadElevenPrefs() {
  const e = state.eleven;
  try {
    e.enabled = localStorage.getItem("kitai-eleven-enabled") === "1";
    e.key = localStorage.getItem("kitai-eleven-key") || "";
    e.voiceId = localStorage.getItem("kitai-eleven-voice") || "";
    e.voiceName = localStorage.getItem("kitai-eleven-voice-name") || "";
    e.model = localStorage.getItem("kitai-eleven-model") || ELEVEN_DEFAULT_MODEL;
    e.syncKey = localStorage.getItem("kitai-eleven-sync") === "1";
  } catch (_) {}
  applyElevenPrefsToUI();
}

function applyElevenPrefsToUI() {
  const e = state.eleven;
  if (els.elevenToggle) els.elevenToggle.checked = e.enabled;
  if (els.elevenKeyInput) els.elevenKeyInput.value = e.key;
  if (els.elevenModelSelect) els.elevenModelSelect.value = e.model || ELEVEN_DEFAULT_MODEL;
  if (els.elevenSyncKeyToggle) els.elevenSyncKeyToggle.checked = e.syncKey;
  renderElevenVoiceOptions();
}

function saveElevenPrefs() {
  const e = state.eleven;
  try {
    localStorage.setItem("kitai-eleven-enabled", e.enabled ? "1" : "0");
    localStorage.setItem("kitai-eleven-key", e.key || "");
    localStorage.setItem("kitai-eleven-voice", e.voiceId || "");
    localStorage.setItem("kitai-eleven-voice-name", e.voiceName || "");
    localStorage.setItem("kitai-eleven-model", e.model || ELEVEN_DEFAULT_MODEL);
    localStorage.setItem("kitai-eleven-sync", e.syncKey ? "1" : "0");
  } catch (_) {}
  if (e.syncKey) pushElevenCloudSettings().catch(() => {});
}

// The saved voice may not be in the freshly-loaded list (different account, or
// the list hasn't been fetched on this device yet) — keep showing it either way
// so a synced setup isn't silently dropped.
function renderElevenVoiceOptions() {
  const sel = els.elevenVoiceSelect;
  if (!sel) return;
  const e = state.eleven;
  sel.innerHTML = "";
  const list = e.voices.slice();
  if (e.voiceId && !list.some((v) => v.voice_id === e.voiceId)) {
    list.unshift({ voice_id: e.voiceId, name: e.voiceName || "Saved voice", category: "saved" });
  }
  if (!list.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "— paste your key, then tap “Load my voices” —";
    sel.appendChild(opt);
    return;
  }
  list.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v.voice_id;
    // Clones are the whole point of this feature — label them so a parent can
    // spot their own voice among the stock ones.
    const cloned = v.category === "cloned" || v.category === "professional";
    opt.textContent = `${cloned ? "👤 " : ""}${v.name}${cloned ? " (your clone)" : ""}`;
    sel.appendChild(opt);
  });
  sel.value = e.voiceId || list[0].voice_id;
}

async function elevenLoadVoices() {
  const e = state.eleven;
  if (!e.key) {
    elevenSay("⚠ Paste your ElevenLabs API key first.", "#d62828");
    return;
  }
  elevenSay("⟳ Loading your voices…");
  try {
    const res = await fetch(`${ELEVEN_API}/voices`, { headers: { "xi-api-key": e.key }, cache: "no-store" });
    if (!res.ok) {
      elevenSay(
        res.status === 401
          ? "⚠ ElevenLabs rejected that key. Check it, and that it allows “Voices: read”."
          : `⚠ Couldn't load voices (HTTP ${res.status}).`,
        "#d62828"
      );
      return;
    }
    const json = await res.json();
    e.voices = json.voices || [];
    if (e.voiceId && !e.voices.some((v) => v.voice_id === e.voiceId)) e.voiceId = "";
    if (!e.voiceId && e.voices.length) {
      // Default to the parent's own clone when they have one.
      const clone = e.voices.find((v) => v.category === "cloned" || v.category === "professional");
      const pick = clone || e.voices[0];
      e.voiceId = pick.voice_id;
      e.voiceName = pick.name;
    }
    renderElevenVoiceOptions();
    saveElevenPrefs();
    const clones = e.voices.filter((v) => v.category === "cloned" || v.category === "professional").length;
    elevenSay(
      `✓ ${e.voices.length} voice${e.voices.length === 1 ? "" : "s"} loaded${clones ? ` — ${clones} of them your own clone${clones === 1 ? "" : "s"}` : ""}.`,
      "#2a9d8f"
    );
    elevenShowQuota();
  } catch (_) {
    elevenSay("⚠ Couldn't reach ElevenLabs. Check your internet.", "#d62828");
  }
}

// Credits left, appended to whatever the status line already says. Purely
// informational, so a failure here is silent.
async function elevenShowQuota() {
  const e = state.eleven;
  if (!e.key) return;
  try {
    const res = await fetch(`${ELEVEN_API}/user/subscription`, { headers: { "xi-api-key": e.key }, cache: "no-store" });
    if (!res.ok) return;
    const s = await res.json();
    const used = s.character_count || 0;
    const limit = s.character_limit || 0;
    if (!limit) return;
    const left = Math.max(0, limit - used);
    const el = els.elevenStatus;
    if (el) el.textContent += ` · ${left.toLocaleString()} of ${limit.toLocaleString()} credits left this month.`;
  } catch (_) {}
}

async function elevenTestVoice() {
  const e = state.eleven;
  if (!e.key || !e.voiceId) {
    elevenSay("⚠ Add your key and pick a voice first.", "#d62828");
    return;
  }
  elevenSay("🔊 Generating a sample…");
  const phrase = langCfg().sample;
  try {
    const blob = await elevenGenerate(phrase);
    putCachedClip(ttsCacheKey(phrase), blob);
    playClipBlob(blob, {
      onStart: () => {
        elevenSay(`✓ Working — “${e.voiceName || "your voice"}” speaking ${langCfg().label}.`, "#2a9d8f");
        elevenShowQuota();
      },
      onFail: () => elevenSay("⚠ Audio generated but wouldn't play. Tap anywhere in the app first, then retry.", "#d62828"),
    });
  } catch (err) {
    elevenSay(`⚠ ${(err && err.message) || "ElevenLabs request failed"}.`, "#d62828");
  }
}

// Every word in the current language, generated once and stored. Turns the
// premium voice into an offline voice and makes the cost a single known
// up-front number instead of a slow drip.
async function elevenPregenerate() {
  const e = state.eleven;
  if (!e.key || !e.voiceId) {
    elevenSay("⚠ Add your key and pick a voice first.", "#d62828");
    return;
  }
  const phrases = Array.from(
    new Set(state.items.map((i) => speechText(i)).filter(Boolean))
  );
  const pending = [];
  for (const p of phrases) {
    if (!(await getCachedClip(ttsCacheKey(p)))) pending.push(p);
  }
  if (!pending.length) {
    elevenSay(`✓ All ${phrases.length} ${langCfg().label} words are already saved. Nothing to download.`, "#2a9d8f");
    return;
  }
  const chars = pending.reduce((n, p) => n + p.length, 0);
  const ok = confirm(
    `Generate ${pending.length} word${pending.length === 1 ? "" : "s"} in ${langCfg().label}?\n\n` +
      `This costs about ${chars.toLocaleString()} ElevenLabs credits, once. ` +
      `After that these words play instantly and work offline.`
  );
  if (!ok) return;

  let done = 0;
  let failed = 0;
  for (const phrase of pending) {
    elevenSay(`⟳ Downloading voices… ${done + failed} / ${pending.length}`);
    try {
      const blob = await elevenGenerate(phrase);
      await putCachedClip(ttsCacheKey(phrase), blob);
      done++;
    } catch (err) {
      failed++;
      // Out of credits or a revoked key won't fix itself — stop rather than
      // hammering the API once per remaining word.
      if (failed >= 3) {
        elevenSay(`⚠ Stopped after ${done} saved — ${(err && err.message) || "generation failed"}.`, "#d62828");
        refreshElevenCacheLine();
        return;
      }
    }
  }
  elevenSay(`✓ Saved ${done} word${done === 1 ? "" : "s"}${failed ? ` (${failed} failed)` : ""}. They now play offline.`, "#2a9d8f");
  elevenShowQuota();
}

async function refreshElevenCacheLine() {
  const stats = await ttsCacheStats();
  if (!stats.count) return;
  elevenSay(`${stats.count} word${stats.count === 1 ? "" : "s"} saved on this device (${Math.round(stats.bytes / 1024)} KB).`);
}

// --- Encrypted cross-login sync -------------------------------------------
//
// The Shared Library prefix is a hash of phone + PIN, and the bucket is
// world-readable by path, so a raw API key parked there would be exposed to
// anyone who guessed the PIN. The key is therefore AES-GCM encrypted with a
// PBKDF2 key derived from the PIN itself before it ever leaves the device —
// the cloud copy is useless without the PIN the parent already knows.
function elevenCloudPath(prefix) {
  return `${prefix}/__settings__/voice.json`;
}

async function libraryCryptoKey() {
  const pin = (state.libraryConfig.pin || "").trim();
  const id = (state.libraryConfig.libraryId || "").trim();
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: new TextEncoder().encode(`kitai-voice::${id}`), iterations: 250000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function bytesToB64(bytes) {
  let s = "";
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s);
}

function b64ToBytes(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function encryptForLibrary(text) {
  const key = await libraryCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text));
  return { iv: bytesToB64(iv), ct: bytesToB64(new Uint8Array(ct)) };
}

async function decryptForLibrary(payload) {
  if (!payload || !payload.iv || !payload.ct) return "";
  const key = await libraryCryptoKey();
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64ToBytes(payload.iv) },
    key,
    b64ToBytes(payload.ct)
  );
  return new TextDecoder().decode(pt);
}

async function pushElevenCloudSettings() {
  if (!isLibraryConfigured() || !state.eleven.syncKey || !crypto.subtle) return;
  const e = state.eleven;
  const prefix = await ensureStoragePrefix();
  const payload = {
    v: 1,
    enabled: e.enabled,
    voiceId: e.voiceId,
    voiceName: e.voiceName,
    model: e.model,
    key: e.key ? await encryptForLibrary(e.key) : null,
  };
  // Same image-MIME workaround the word manifest uses — the bucket only
  // accepts image content types, but the bytes are still JSON.
  const body = new Blob([JSON.stringify(payload)], { type: "image/svg+xml" });
  await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${elevenCloudPath(prefix)}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "x-upsert": "true",
      "Content-Type": "image/svg+xml",
    },
    body,
  });
}

async function pullElevenCloudSettings() {
  if (!isLibraryConfigured() || !crypto.subtle) return false;
  const prefix = await ensureStoragePrefix();
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${elevenCloudPath(prefix)}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const p = await res.json();
    const e = state.eleven;
    e.enabled = !!p.enabled;
    e.voiceId = p.voiceId || "";
    e.voiceName = p.voiceName || "";
    e.model = p.model || ELEVEN_DEFAULT_MODEL;
    e.syncKey = true;
    if (p.key) {
      try {
        e.key = await decryptForLibrary(p.key);
      } catch (_) {
        // Wrong PIN for this blob — leave whatever key this device already has.
      }
    }
    try {
      localStorage.setItem("kitai-eleven-enabled", e.enabled ? "1" : "0");
      localStorage.setItem("kitai-eleven-key", e.key || "");
      localStorage.setItem("kitai-eleven-voice", e.voiceId || "");
      localStorage.setItem("kitai-eleven-voice-name", e.voiceName || "");
      localStorage.setItem("kitai-eleven-model", e.model);
      localStorage.setItem("kitai-eleven-sync", "1");
    } catch (_) {}
    applyElevenPrefsToUI();
    return true;
  } catch (_) {
    return false;
  }
}

function bindElevenUI() {
  if (els.elevenToggle) {
    els.elevenToggle.addEventListener("change", (ev) => {
      state.eleven.enabled = ev.target.checked;
      saveElevenPrefs();
      if (state.eleven.enabled && !state.eleven.voiceId) {
        elevenSay("⚠ Add your key and tap “Load my voices” to finish setting this up.", "#d62828");
      }
    });
  }
  if (els.elevenKeyInput) {
    els.elevenKeyInput.addEventListener("change", (ev) => {
      state.eleven.key = ev.target.value.trim();
      saveElevenPrefs();
      if (state.eleven.key) elevenLoadVoices();
    });
  }
  if (els.elevenVoiceSelect) {
    els.elevenVoiceSelect.addEventListener("change", (ev) => {
      const e = state.eleven;
      e.voiceId = ev.target.value;
      const found = e.voices.find((v) => v.voice_id === e.voiceId);
      e.voiceName = found ? found.name : e.voiceName;
      saveElevenPrefs();
    });
  }
  if (els.elevenModelSelect) {
    els.elevenModelSelect.addEventListener("change", (ev) => {
      state.eleven.model = ev.target.value;
      saveElevenPrefs();
      elevenSay("Quality changed — words will regenerate once each on their next tap.");
    });
  }
  if (els.elevenSyncKeyToggle) {
    els.elevenSyncKeyToggle.addEventListener("change", (ev) => {
      state.eleven.syncKey = ev.target.checked;
      saveElevenPrefs();
      if (state.eleven.syncKey && !isLibraryConfigured()) {
        elevenSay("⚠ Connect a Shared Library (Account tab) first — that's what carries this to your other logins.", "#d62828");
      } else if (state.eleven.syncKey) {
        elevenSay("✓ Voice setup synced. Sign in to the same Shared Library elsewhere to pick it up.", "#2a9d8f");
      }
    });
  }
  if (els.elevenLoadVoicesBtn) els.elevenLoadVoicesBtn.addEventListener("click", elevenLoadVoices);
  if (els.elevenTestBtn) els.elevenTestBtn.addEventListener("click", elevenTestVoice);
  if (els.elevenPregenBtn) els.elevenPregenBtn.addEventListener("click", elevenPregenerate);
  if (els.elevenClearCacheBtn) {
    els.elevenClearCacheBtn.addEventListener("click", async () => {
      if (!confirm("Delete the saved voice clips on this device? Words will be generated again (and billed again) on their next tap.")) return;
      await clearTtsCache();
      elevenSay("✓ Voice cache cleared.", "#2a9d8f");
    });
  }
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
  bindElevenUI();
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
    if (state.currentGameType === "flash") startFlashSession();
    else if (state.currentGameType === "memory") startMemorySession();
    else startRound();
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
      if (state.currentGameType === "flash") startFlashSession();
      else if (state.currentGameType === "memory") startMemorySession();
      else startRound();
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

  if (els.uiLangSelect) {
    els.uiLangSelect.addEventListener("change", (e) => setUiLanguage(e.target.value));
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
  if (els.newWordSuggest) {
    els.newWordSuggest.addEventListener("click", () => {
      renderRichSuggestions(
        els.newWordSuggestions,
        els.newWordEn?.value,
        suggestLang(),
        (value, romaji, speech) => {
          if (els.newWordKana) els.newWordKana.value = value;
          if (els.newWordRomaji && romaji) els.newWordRomaji.value = romaji;
          // Stash the kanji form so the new word speaks with the right accent
          // even if the parent chose a kana chip to display.
          if (els.addWordForm) els.addWordForm.dataset.speech = speech || "";
        }
      );
    });
  }
  setupSettingsTabs();
  if (els.wordAddToggle) {
    els.wordAddToggle.addEventListener("click", toggleAddWordForm);
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
  if (els.imageModalEdit) {
    els.imageModalEdit.addEventListener("click", toggleReadingEditor);
  }
  if (els.readingSuggest) {
    els.readingSuggest.addEventListener("click", () => {
      const item = state.items.find((i) => i.id === state.imageModalItemId);
      if (!item) return;
      renderRichSuggestions(
        els.readingSuggestions,
        item.en,
        suggestLang(),
        (value, romaji, speech) => {
          if (els.readingInput) els.readingInput.value = value;
          if (els.readingRomaji && romaji) els.readingRomaji.value = romaji;
          if (els.readingSpeech && speech && state.lang !== "ko") els.readingSpeech.value = speech;
        }
      );
    });
  }
  if (els.readingSave) {
    els.readingSave.addEventListener("click", saveWordReading);
  }
  if (els.stockSearchGo) {
    els.stockSearchGo.addEventListener("click", () => searchStockPhotos(els.stockSearchInput?.value));
  }
  if (els.stockSearchInput) {
    els.stockSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); searchStockPhotos(els.stockSearchInput.value); }
    });
  }
  if (els.stockAdd) {
    els.stockAdd.addEventListener("click", addSelectedStockPhotos);
  }
  if (els.imageModalReset) {
    els.imageModalReset.addEventListener("click", () => {
      if (state.imageModalItemId) removeAllImagesForItem(state.imageModalItemId);
    });
  }
  if (els.imageModalFile) {
    els.imageModalFile.addEventListener("change", async () => {
      const id = els.imageModalFile.dataset.itemId;
      const files = Array.from(els.imageModalFile.files || []);
      els.imageModalFile.value = "";
      if (id && files.length) await saveImageOverridesBatch(id, files);
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
        if (state.currentGameType === "flash") { startFlashSession(); return; }
        if (state.currentGameType === "memory") { startMemorySession(); return; }
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

  if (els.quickAddBtn) els.quickAddBtn.addEventListener("click", quickAddWord);
  if (els.quickAddInput) {
    els.quickAddInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); quickAddWord(); }
    });
  }

  if (els.flashAgain) onTap(els.flashAgain, () => {
    if (state.currentGameType === "memory") startMemorySession();
    else startFlashSession();
  });
  if (els.flashHome) onTap(els.flashHome, () => { hideFlashComplete(); goHome(); });
  if (els.flashFinish) onTap(els.flashFinish, () => endFlashSession());

  if (els.catAddToggle) els.catAddToggle.addEventListener("click", toggleCategoryForm);
  if (els.catAddBtn) els.catAddBtn.addEventListener("click", addCategoryFromForm);
  if (els.catAddName) {
    els.catAddName.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); addCategoryFromForm(); }
    });
  }

  if (els.stockUrlAdd) els.stockUrlAdd.addEventListener("click", addStockPhotoByUrl);
  if (els.stockUrlInput) {
    els.stockUrlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); addStockPhotoByUrl(); }
    });
  }

  // Google image-search creds (optional) — persisted on this device.
  try {
    state.googleImgKey = localStorage.getItem("kitai-gimg-key") || "";
    state.googleImgCx = localStorage.getItem("kitai-gimg-cx") || "";
  } catch (_) {}
  if (els.googleImgKey) {
    els.googleImgKey.value = state.googleImgKey;
    els.googleImgKey.addEventListener("change", (e) => {
      state.googleImgKey = e.target.value.trim();
      try { localStorage.setItem("kitai-gimg-key", state.googleImgKey); } catch (_) {}
    });
  }
  if (els.googleImgCx) {
    els.googleImgCx.value = state.googleImgCx;
    els.googleImgCx.addEventListener("change", (e) => {
      state.googleImgCx = e.target.value.trim();
      try { localStorage.setItem("kitai-gimg-cx", state.googleImgCx); } catch (_) {}
    });
  }

  if (els.lockButton) onTap(els.lockButton, () => lockApp());
  if (els.lockBadge) {
    els.lockBadge.addEventListener("pointerdown", beginUnlockHold);
    els.lockBadge.addEventListener("pointerup", endUnlockHold);
    els.lockBadge.addEventListener("pointerleave", endUnlockHold);
    els.lockBadge.addEventListener("pointercancel", endUnlockHold);
    els.lockBadge.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  // Re-grab the wake lock when the tab becomes visible again (it's dropped on hide).
  document.addEventListener("visibilitychange", () => {
    if (state.locked && document.visibilityState === "visible") requestWakeLock();
  });

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
    const makePill = (id, label, cat) => {
      const btn = document.createElement("button");
      btn.className = "pill-btn";
      if (id === state.imageCategoryId) btn.classList.add("active");
      btn.textContent = cat ? `${cat.emoji} ${label}` : label;
      btn.addEventListener("click", () => {
        state.imageCategoryId = id;
        renderImageList();
      });
      // Custom categories get a small ✕ to delete (with confirm).
      if (cat && cat.custom) {
        const x = document.createElement("span");
        x.className = "pill-del";
        x.textContent = "✕";
        x.setAttribute("role", "button");
        x.setAttribute("aria-label", `Delete category ${label}`);
        x.addEventListener("click", (e) => {
          e.stopPropagation();
          removeCustomCategory(id);
        });
        btn.appendChild(x);
      }
      return btn;
    };
    els.imageCategoryPills.appendChild(makePill("all", "All"));
    state.categories.forEach((cat) => {
      els.imageCategoryPills.appendChild(makePill(cat.id, cat.label_en, cat));
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

function setImageModalTitle(item) {
  if (!els.imageModalTitle) return;
  const native = [item.jaKana, item.ko].filter(Boolean).join(" · ");
  els.imageModalTitle.textContent = native ? `${item.en} (${native})` : item.en;
}

function openImageModal(item) {
  if (!els.imageModal || !els.imageModalTitle) return;
  state.imageModalItemId = item.id;
  setImageModalTitle(item);
  hideStockSearch();
  hideReadingEditor();
  // Editing a reading only makes sense in a spoken language (not English mode).
  if (els.imageModalEdit) els.imageModalEdit.classList.toggle("hidden", state.lang === "en");
  renderImageModalContent();
  els.imageModal.classList.remove("hidden");
}

// --- Reading / inflection editor (correct how a word is shown & spoken) ---

function hideReadingEditor() {
  if (els.readingEditor) els.readingEditor.classList.add("hidden");
  if (els.readingSuggestions) els.readingSuggestions.innerHTML = "";
  if (els.readingStatus) els.readingStatus.textContent = "";
}

function toggleReadingEditor() {
  if (!els.readingEditor) return;
  const opening = els.readingEditor.classList.contains("hidden");
  if (!opening) { hideReadingEditor(); return; }
  hideStockSearch();
  const item = state.items.find((i) => i.id === state.imageModalItemId);
  if (!item) return;
  const isKo = state.lang === "ko";
  if (els.readingInput) els.readingInput.value = isKo ? item.ko || "" : item.jaKana || "";
  if (els.readingRomaji) els.readingRomaji.value = isKo ? item.koRomaji || "" : item.jaRomaji || "";
  // The "say it as" (accent) field is Japanese-only.
  if (els.readingSpeechRow) els.readingSpeechRow.classList.toggle("hidden", isKo);
  if (els.readingSpeech) els.readingSpeech.value = isKo ? "" : item.jaSpeech || "";
  if (els.readingSuggestions) els.readingSuggestions.innerHTML = "";
  if (els.readingStatus) els.readingStatus.textContent = "";
  els.readingEditor.classList.remove("hidden");
  if (els.readingInput) els.readingInput.focus();
}

function saveWordReading() {
  const itemId = state.imageModalItemId;
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return;
  const kana = (els.readingInput?.value || "").trim();
  const romaji = (els.readingRomaji?.value || "").trim();
  const speech = (els.readingSpeech?.value || "").trim();
  if (!kana) {
    if (els.readingStatus) {
      els.readingStatus.textContent = "Please enter the word.";
      els.readingStatus.style.color = "#d62828";
    }
    return;
  }

  if (!state.wordManifest) state.wordManifest = emptyManifest();
  const existing = state.wordManifest.items[itemId];
  const rec = existing
    ? { ...existing }
    : {
        id: item.id,
        categoryId: item.categoryId,
        en: item.en,
        jaKana: item.jaKana || "",
        jaRomaji: item.jaRomaji || "",
        ko: item.ko || "",
        koRomaji: item.koRomaji || "",
      };
  if (item.photoUrl && !rec.photoUrl) rec.photoUrl = item.photoUrl;
  if (state.lang === "ko") {
    rec.ko = kana;
    rec.koRomaji = romaji;
  } else {
    rec.jaKana = kana;
    rec.jaRomaji = romaji;
    // Blank clears it (falls back to speaking the kana); non-blank overrides.
    rec.jaSpeech = speech && speech !== kana ? speech : "";
  }
  rec.updatedAt = Date.now();
  state.wordManifest.items[itemId] = rec;
  delete state.wordManifest.deleted[itemId];
  saveWordManifest(state.wordManifest);
  applyWordManifestToState();

  if (els.readingStatus) {
    els.readingStatus.textContent = "Saved. ✓";
    els.readingStatus.style.color = "#2a9d8f";
  }
  const fresh = state.items.find((i) => i.id === itemId);
  if (fresh) setImageModalTitle(fresh);
  renderImageList();
  if (state.currentTrack === "vocab") renderCurrentView();
  syncWordsWithCloud().catch(() => {});
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
  hideReadingEditor();
}

// --- Photo search --------------------------------------------------------
// Each result is { thumb, full }: `thumb` is a small CORS-friendly image for the
// grid; `full` is the best-quality download (falls back to thumb if it won't
// fetch). Sources: Google (real image search, opt-in key) + Openverse (~700M
// open images) + Wikimedia Commons — all merged for lots of options per word.

// key -> { thumb, full } for the results the parent has tapped to add.
const stockSelected = new Map();

function updateStockAddButton() {
  if (!els.stockAdd) return;
  const n = stockSelected.size;
  els.stockAdd.disabled = n === 0;
  els.stockAdd.textContent = n ? `Add ${n} photo${n > 1 ? "s" : ""}` : "Add selected";
}

function hideStockSearch() {
  if (els.imageModalStock) els.imageModalStock.classList.add("hidden");
  if (els.stockSearchResults) { els.stockSearchResults.innerHTML = ""; els.stockSearchResults.onscroll = null; }
  if (els.stockSearchDots) els.stockSearchDots.innerHTML = "";
  stockSelected.clear();
  updateStockAddButton();
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

function hasGoogleImageSearch() {
  return !!(state.googleImgKey && state.googleImgCx);
}

// Real Google image results via the official Programmable Search JSON API
// (CORS-enabled). Needs a free API key + search-engine id (cx). Paginates to
// pull many results (10 per page). Returns [{thumb, full}].
async function searchGoogleImages(q) {
  if (!hasGoogleImageSearch()) return [];
  const out = [];
  for (const start of [1, 11, 21]) {
    try {
      const url =
        "https://www.googleapis.com/customsearch/v1?searchType=image&num=10&safe=active" +
        "&key=" + encodeURIComponent(state.googleImgKey) +
        "&cx=" + encodeURIComponent(state.googleImgCx) +
        "&start=" + start +
        "&q=" + encodeURIComponent(q);
      const res = await fetch(url);
      if (!res.ok) break; // out of quota / bad key — stop early
      const data = await res.json();
      (data.items || []).forEach((it) => {
        const full = it.link;
        const thumb = (it.image && it.image.thumbnailLink) || full;
        if (full) out.push({ thumb, full });
      });
      if (!data.items || data.items.length < 10) break;
    } catch (_) {
      break;
    }
  }
  return out;
}

async function searchOpenverse(q) {
  const out = [];
  for (const page of [1, 2]) {
    try {
      const url =
        "https://api.openverse.org/v1/images/?mature=false&page_size=40&page=" + page +
        "&q=" + encodeURIComponent(q);
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) break;
      const data = await res.json();
      (data.results || []).forEach((r) => {
        const thumb = r.thumbnail || r.url;
        if (thumb) out.push({ thumb, full: r.url || thumb });
      });
      if (!data.results || data.results.length < 40) break;
    } catch (_) {
      break;
    }
  }
  return out;
}

async function searchWikimediaPhotos(q) {
  try {
    const url =
      "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*" +
      "&generator=search&gsrnamespace=6&gsrlimit=40&prop=imageinfo&iiprop=url|mime" +
      "&iiurlwidth=500&gsrsearch=" + encodeURIComponent(q + " -icon -logo -map -diagram");
    const res = await fetch(url);
    const data = await res.json();
    const pages = data.query && data.query.pages ? Object.values(data.query.pages) : [];
    return pages
      .map((p) => p.imageinfo && p.imageinfo[0])
      .filter((ii) => ii && ii.thumburl && /image\/(jpeg|png|webp)/.test(ii.mime || ""))
      .map((ii) => ({ thumb: ii.thumburl, full: ii.url || ii.thumburl }));
  } catch (_) {
    return [];
  }
}

async function searchStockPhotos(query) {
  const grid = els.stockSearchResults;
  if (!grid) return;
  const q = (query || "").trim();
  stockSelected.clear();
  updateStockAddButton();
  if (els.stockSearchDots) els.stockSearchDots.innerHTML = "";
  grid.onscroll = null;
  if (!q) { grid.innerHTML = ""; return; }
  grid.innerHTML = '<div class="stock-status">Searching…</div>';

  const [google, openverse, commons] = await Promise.all([
    searchGoogleImages(q),
    searchOpenverse(q),
    searchWikimediaPhotos(q),
  ]);

  // Google first (most relevant), then interleave the open sources. Dedupe on
  // the download URL.
  const seen = new Set();
  const photos = [];
  const add = (r) => {
    if (r && r.thumb && !seen.has(r.full || r.thumb)) {
      seen.add(r.full || r.thumb);
      photos.push(r);
    }
  };
  google.forEach(add);
  const maxLen = Math.max(openverse.length, commons.length);
  for (let i = 0; i < maxLen; i++) {
    add(openverse[i]);
    add(commons[i]);
  }

  grid.innerHTML = "";
  if (els.stockSearchDots) els.stockSearchDots.innerHTML = "";
  if (!photos.length) {
    grid.innerHTML = '<div class="stock-status">No photos found. Try a different word.</div>';
    return;
  }

  // Show the results as swipeable pages of 6 (2 rows × 3) instead of one long
  // vertical stack — much easier to skim on a phone. Swipe left/right to reach
  // the next page.
  const PER_PAGE = 6;
  const shown = photos.slice(0, 90);
  const pageCount = Math.ceil(shown.length / PER_PAGE);
  for (let p = 0; p < pageCount; p++) {
    const page = document.createElement("div");
    page.className = "stock-page";
    shown.slice(p * PER_PAGE, p * PER_PAGE + PER_PAGE).forEach((r) => {
      const key = r.full || r.thumb;
      const btn = document.createElement("button");
      btn.className = "stock-result";
      const img = document.createElement("img");
      img.src = r.thumb;
      img.loading = "lazy";
      img.alt = "";
      btn.appendChild(img);
      onTap(btn, () => {
        if (stockSelected.has(key)) {
          stockSelected.delete(key);
          btn.classList.remove("selected");
        } else {
          stockSelected.set(key, r);
          btn.classList.add("selected");
        }
        updateStockAddButton();
      });
      page.appendChild(btn);
    });
    grid.appendChild(page);
  }

  // Pagination dots that reflect / drive the current page.
  if (els.stockSearchDots && pageCount > 1) {
    const dots = [];
    for (let p = 0; p < pageCount; p++) {
      const dot = document.createElement("button");
      dot.className = "stock-dot" + (p === 0 ? " active" : "");
      dot.setAttribute("aria-label", `Page ${p + 1}`);
      onTap(dot, () => {
        grid.scrollTo({ left: p * grid.clientWidth, behavior: "smooth" });
      });
      els.stockSearchDots.appendChild(dot);
      dots.push(dot);
    }
    let raf = 0;
    grid.onscroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const idx = Math.round(grid.scrollLeft / grid.clientWidth);
        dots.forEach((d, i) => d.classList.toggle("active", i === idx));
      });
    };
  }
}

// Download a cross-origin image as a Blob. Primary path is a direct CORS
// fetch; if that's blocked/empty, fall back to drawing it onto a canvas via a
// crossOrigin <img> and reading the pixels back out.
async function fetchImageBlob(url) {
  const looksGif = /\.gif(\?|#|$)/i.test(url);
  try {
    const res = await fetch(url, { mode: "cors", cache: "no-store" });
    if (res && res.ok) {
      const blob = await res.blob();
      if (blob && blob.size > 0 && (blob.type || "").startsWith("image/")) return blob;
    }
  } catch (_) {}
  // The canvas fallback re-encodes to a single static JPEG frame — for a GIF
  // that silently kills the animation. Refuse to flatten it; the caller tells
  // the user to download the GIF and add it as a file (which keeps the motion).
  if (looksGif) throw new Error("gif-needs-download");
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d").drawImage(img, 0, 0);
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.9);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = url;
  });
}

// Try the best-quality URL first; if that's blocked (CORS/canvas taint), fall
// back to the small thumbnail so the photo still gets added.
async function downloadStockPhoto(result, itemId) {
  const primary = typeof result === "string" ? result : result.full || result.thumb;
  const backup = typeof result === "string" ? null : result.thumb;
  let blob;
  try {
    blob = await fetchImageBlob(primary);
  } catch (e) {
    if (backup && backup !== primary) blob = await fetchImageBlob(backup);
    else throw e;
  }
  const ext = ((blob.type.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "")) || "jpg";
  const file = new File([blob], `stock-${itemId}-${Date.now()}.${ext}`, { type: blob.type || "image/jpeg" });
  await saveImageOverride(itemId, file); // stores offline + syncs to the library
}

async function addSelectedStockPhotos() {
  const itemId = state.imageModalItemId;
  if (!itemId || stockSelected.size === 0) return;
  const results = Array.from(stockSelected.values());
  if (els.stockAdd) { els.stockAdd.disabled = true; els.stockAdd.textContent = "Adding…"; }
  let failed = 0;
  for (const r of results) {
    try { await downloadStockPhoto(r, itemId); } catch (_) { failed++; }
  }
  hideStockSearch();
  if (failed) alert(`Added ${results.length - failed} photo(s); ${failed} couldn't be added.`);
}

// Paste any image URL (e.g. copied from a Google Images search in the browser).
async function addStockPhotoByUrl() {
  const itemId = state.imageModalItemId;
  const input = els.stockUrlInput;
  const url = (input?.value || "").trim();
  if (!itemId || !url) return;
  if (!/^https?:\/\//i.test(url)) { alert("Paste a link that starts with http:// or https://"); return; }
  const btn = els.stockUrlAdd;
  if (btn) { btn.disabled = true; btn.textContent = "Adding…"; }
  try {
    await downloadStockPhoto(url, itemId);
    if (input) input.value = "";
    renderImageModalContent();
  } catch (e) {
    if (e && e.message === "gif-needs-download") {
      alert("That site blocked the GIF from downloading directly. Save the GIF to your device, then use + Add Photo to keep it animated.");
    } else {
      alert("Couldn't fetch that image. Some sites block downloads — try a different link or save the picture and use + Add Photo.");
    }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Add URL"; }
  }
}

function setActiveModeButton(type) {
  els.modeButtons.forEach((b) => b.classList.remove("active"));
  const match = Array.from(els.modeButtons).find((b) => b.dataset.gametype === type);
  if (match) match.classList.add("active");
}

function updateModeButtonsForTrack(track) {
  const [btn1, btn2, btn3, btn4, btn5] = els.modeButtons;
  if (track === "vocab") {
    if (els.categoryQuick) els.categoryQuick.parentElement.classList.remove("hidden");
    btn1.dataset.gametype = "tap";
    btn1.textContent = t("mode_tap");
    btn1.classList.remove("hidden");
    btn1.disabled = false;
    btn2.dataset.gametype = "drag-complete";
    btn2.textContent = t("mode_drag");
    btn2.classList.remove("hidden");
    btn2.disabled = false;
    if (btn3) {
      btn3.dataset.gametype = "find";
      btn3.textContent = t("mode_find");
      btn3.classList.remove("hidden");
      btn3.disabled = false;
    }
    if (btn4) {
      btn4.dataset.gametype = "flash";
      btn4.textContent = t("mode_flash");
      btn4.classList.remove("hidden");
      btn4.disabled = false;
    }
    if (btn5) {
      btn5.dataset.gametype = "memory";
      btn5.textContent = t("mode_memory");
      btn5.classList.remove("hidden");
      btn5.disabled = false;
    }
    state.currentGameType = "tap";
    setActiveModeButton("tap");
  } else if (track === "hiragana" || track === "katakana") {
    if (els.categoryQuick) els.categoryQuick.parentElement.classList.add("hidden");
    btn1.dataset.gametype = "kana-tap";
    btn1.textContent = t("mode_kana_tap");
    btn1.classList.remove("hidden");
    btn1.disabled = false;
    btn2.dataset.gametype = "kana-complete";
    btn2.textContent = t("mode_drag");
    btn2.classList.remove("hidden");
    btn2.disabled = false;
    if (btn3) {
      btn3.dataset.gametype = "kana-alphabet";
      btn3.textContent = t("mode_alphabet");
      btn3.classList.remove("hidden");
      btn3.disabled = false;
    }
    if (btn4) {
      btn4.dataset.gametype = "kana-alphabet-quiz";
      btn4.textContent = t("mode_quiz");
      btn4.classList.remove("hidden");
      btn4.disabled = false;
    }
    if (btn5) btn5.classList.add("hidden");
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
  if (state.locked) return; // child lock hides the gear, but never open it while locked
  if (els.quickAddCategory && state.imageCategoryId && state.imageCategoryId !== "all") {
    els.quickAddCategory.value = state.imageCategoryId;
  }
  els.overlay.classList.remove("hidden");
  updateWordSyncIndicator();
  refreshElevenCacheLine();
}

function hideSettings() {
  els.overlay.classList.add("hidden");
}

function goHome() {
  if (state.locked) return;
  clearTimeout(state.memoryFlipTimer);
  state.memoryArmed = false;
  hideFlashComplete();
  state.currentSection = "home";
  els.homeScreen.classList.remove("hidden");
  els.gameScreen.classList.add("hidden");
}

// ---- Child Lock ------------------------------------------------------------
// A kiosk-ish lock: fullscreen + wake lock + hidden nav so a toddler stays put.
// It can't block the OS home gesture (only Guided Access / Screen Pinning can),
// but it keeps them inside the activity. Unlock = press-and-hold the badge 3s.

async function lockApp() {
  state.locked = true;
  document.body.classList.add("locked");
  if (els.lockBadge) els.lockBadge.classList.remove("hidden");
  if (els.lockButton) els.lockButton.textContent = "🔒";
  cancelLongPress();
  try {
    const el = document.documentElement;
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  } catch (_) {}
  requestWakeLock();
}

function unlockApp() {
  state.locked = false;
  document.body.classList.remove("locked");
  if (els.lockBadge) els.lockBadge.classList.add("hidden");
  if (els.lockButton) els.lockButton.textContent = "🔓";
  try {
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
  } catch (_) {}
  releaseWakeLock();
}

async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator && navigator.wakeLock && navigator.wakeLock.request) {
      state.wakeLock = await navigator.wakeLock.request("screen");
    }
  } catch (_) {}
}

function releaseWakeLock() {
  try {
    if (state.wakeLock) { state.wakeLock.release(); state.wakeLock = null; }
  } catch (_) {}
}

let lockHoldRaf = 0;
let lockHoldStart = 0;
const LOCK_HOLD_MS = 3000;
const LOCK_RING_CIRC = 2 * Math.PI * 44;

function beginUnlockHold(e) {
  if (!state.locked) return;
  if (e && e.preventDefault) e.preventDefault();
  lockHoldStart = performance.now();
  if (els.lockBadge) els.lockBadge.classList.add("holding");
  const tick = (now) => {
    const p = Math.min(1, (now - lockHoldStart) / LOCK_HOLD_MS);
    if (els.lockRingFill) els.lockRingFill.style.strokeDashoffset = String(LOCK_RING_CIRC * (1 - p));
    if (p >= 1) { endUnlockHold(); unlockApp(); return; }
    lockHoldRaf = requestAnimationFrame(tick);
  };
  lockHoldRaf = requestAnimationFrame(tick);
}

function endUnlockHold() {
  cancelAnimationFrame(lockHoldRaf);
  if (els.lockBadge) els.lockBadge.classList.remove("holding");
  if (els.lockRingFill) els.lockRingFill.style.strokeDashoffset = String(LOCK_RING_CIRC);
}

// ---- Quick add -------------------------------------------------------------
// "Just type the word" — one English field. We auto-translate to the current
// language, fill the reading/romaji, save it, then jump straight into photos.

function setQuickAddStatus(msg, isError) {
  if (!els.quickAddStatus) return;
  els.quickAddStatus.textContent = msg || "";
  els.quickAddStatus.classList.toggle("error", !!isError);
}

async function quickAddWord() {
  const raw = (els.quickAddInput?.value || "").trim();
  const categoryId = els.quickAddCategory ? els.quickAddCategory.value : "";
  if (!categoryId) { setQuickAddStatus("Please pick a category.", true); return; }
  if (!raw) { setQuickAddStatus("Type a word first.", true); return; }

  const cat = state.categories.find((c) => c.id === categoryId);
  const now = Date.now();
  const id = `custom-${now}-${Math.random().toString(36).slice(2, 7)}`;
  const word = { id, categoryId, en: raw, updatedAt: now };
  let readingNote = "";

  if (state.lang !== "en") {
    setQuickAddStatus("Finding the reading…");
    if (els.quickAddBtn) els.quickAddBtn.disabled = true;
    try {
      const { candidates, romaji, speech } = await fetchWordSuggestions(raw, suggestLang());
      const best = candidates[0];
      if (state.lang === "ko") {
        word.ko = best ? best.value : raw;
        if (romaji) word.koRomaji = romaji;
      } else {
        word.jaKana = best ? best.value : raw;
        if (romaji) word.jaRomaji = romaji;
        if (speech && best && speech !== best.value) word.jaSpeech = speech;
      }
      if (!best) readingNote = " (couldn't auto-fill the reading — fix it in the word's card)";
    } catch (_) {
      word[state.lang === "ko" ? "ko" : "jaKana"] = raw;
      readingNote = " (no internet for the reading — fix it later)";
    } finally {
      if (els.quickAddBtn) els.quickAddBtn.disabled = false;
    }
  }

  if (!state.wordManifest) state.wordManifest = emptyManifest();
  state.wordManifest.items[id] = word;
  delete state.wordManifest.deleted[id];
  saveWordManifest(state.wordManifest);
  applyWordManifestToState();

  if (els.quickAddInput) els.quickAddInput.value = "";
  setQuickAddStatus(`Added "${raw}" to ${cat ? cat.label_en : categoryId}. ✓${readingNote}`, !!readingNote);
  renderImageList();
  if (state.currentTrack === "vocab") renderCurrentView();
  syncWordsWithCloud().catch(() => {});
  promptPhotosForItem(id); // straight into picking pictures
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

// ---- Flash Cards & Memory --------------------------------------------------
// A "clear the deck" session over the current category. Each word starts in the
// deck once; a correct tap removes it, a miss marks it weak and reshuffles it
// deeper so it comes back around. Cleared deck → celebration + stats. Memory
// mode shares this whole session; it differs only in how a round is presented
// (peek, then flip the cards face-down before the child guesses the spot).

function startFlashSession() {
  state.currentGameType = "flash";
  setActiveModeButton("flash");
  runDeckSession(t("mode_flash"));
}

function startMemorySession() {
  state.currentGameType = "memory";
  setActiveModeButton("memory");
  runDeckSession(t("mode_memory"));
}

function runDeckSession(emptyLabel) {
  clearTimeout(state.memoryFlipTimer);
  state.memoryArmed = false;
  showGame();
  const pool = pickPool();
  if (!pool.length) {
    hideFlashComplete();
    hideAllGameViews();
    showPromptArea(true);
    els.modeLabel.textContent = emptyLabel;
    els.feedback.textContent = t("fb_no_words");
    if (els.cards) els.cards.innerHTML = "";
    if (els.promptWord) els.promptWord.textContent = "—";
    return;
  }
  state.flash.deck = shuffle([...pool]);
  state.flash.wrong = {};
  state.flash.total = pool.length;
  state.flash.firstTryOk = 0;
  state.flash.answered = 0;
  state.flash.correct = 0;
  state.flash.startTime = Date.now();
  state.flash.active = true;
  state.flash.missedThisCard = false;
  hideFlashComplete();
  startRound();
}

function chooseFlashItems() {
  const pool = pickPool();
  const target = state.flash.deck[0];
  state.flash.missedThisCard = false;
  const others = pool.filter((i) => i.id !== target.id);
  shuffle(others);
  const count = state.choiceCount;
  const distractors = others.slice(0, Math.max(1, count - 1));
  const choices = shuffle([target, ...distractors]).slice(0, count);
  state.currentTarget = target;
  state.currentChoices = choices;
}

function renderFlashView() {
  hideFlashComplete();
  hideAllGameViews();
  showPromptArea(true);
  els.cards.classList.remove("hidden");
  if (els.flashBar) els.flashBar.classList.remove("hidden");
  renderCards(state.currentChoices);
  els.promptWord.textContent = wordText(state.currentTarget);
  const cleared = state.flash.total - state.flash.deck.length;
  els.modeLabel.textContent = `${t("mode_flash")} · ${cleared}/${state.flash.total}`;
  updateFlashLiveScore();
}

function updateFlashLiveScore() {
  if (!els.flashLiveScore) return;
  const a = state.flash.answered;
  const emptyMsg = state.currentGameType === "memory" ? t("mem_watch") : t("flash_live_default");
  els.flashLiveScore.textContent = a ? `${state.flash.correct}/${a} correct` : emptyMsg;
}

// ---- Memory mode -----------------------------------------------------------
// How long the pictures stay face-up (child sees them + hears the word) before
// the cards flip face-down and they have to remember where the right one was.
const MEMORY_PEEK_MS = 1700;

function renderMemoryView() {
  hideFlashComplete();
  hideAllGameViews();
  showPromptArea(true);
  els.cards.classList.remove("hidden");
  if (els.flashBar) els.flashBar.classList.remove("hidden");
  renderCards(state.currentChoices); // renders face-up, each card with a .card-back overlay
  els.promptWord.textContent = wordText(state.currentTarget);
  const cleared = state.flash.total - state.flash.deck.length;
  els.modeLabel.textContent = `${t("mode_memory")} · ${cleared}/${state.flash.total}`;
  updateFlashLiveScore();
  els.feedback.textContent = t("mem_look_listen");
}

// Schedule the face-down flip after the peek window. Taps are ignored until the
// cards are actually down (memoryArmed), so an eager tap during the peek can't
// count as a guess.
function startMemoryPeek() {
  clearTimeout(state.memoryFlipTimer);
  state.memoryArmed = false;
  state.memoryFlipTimer = setTimeout(memoryFlipDown, MEMORY_PEEK_MS);
}

function memoryFlipDown() {
  if (state.currentGameType !== "memory" || !state.flash.active) return;
  if (!els.cards) return;
  els.cards.querySelectorAll(".card").forEach((c) => c.classList.add("face-down"));
  state.memoryArmed = true;
  els.feedback.textContent = t("mem_where");
}

function handleMemoryTap(item, cardEl) {
  if (!state.memoryArmed) return; // still peeking or mid-flip — ignore stray taps
  state.memoryArmed = false;      // one guess per round
  lockForCorrectAdvance();
  cardEl.classList.remove("face-down"); // reveal what they picked
  if (item.id === state.currentTarget.id) {
    cardEl.classList.add("correct");
    els.feedback.textContent = t("mem_remembered");
    flashOnCorrect();
    playCorrect();
    showCorrectOverlay();
    setTimeout(() => startRound(), CORRECT_ADVANCE_MS + 200);
  } else {
    cardEl.classList.add("wrong");
    flashOnWrong();
    revealCorrectMemoryCard(); // flip the right one up so they learn where it was
    els.feedback.textContent = t("mem_was_here");
    buzz();
    showWrongOverlay();
    setTimeout(() => startRound(), CORRECT_ADVANCE_MS + 500);
  }
}

function revealCorrectMemoryCard() {
  if (!els.cards || !state.currentTarget) return;
  const sel = `.card[data-id="${CSS.escape(state.currentTarget.id)}"]`;
  const el = els.cards.querySelector(sel);
  if (el) { el.classList.remove("face-down"); el.classList.add("correct"); }
}

function flashOnCorrect() {
  const target = state.currentTarget;
  state.flash.answered++;
  state.flash.correct++;
  if (!state.flash.wrong[target.id]) state.flash.firstTryOk++;
  state.flash.deck = state.flash.deck.filter((i) => i.id !== target.id);
}

function flashOnWrong() {
  const target = state.currentTarget;
  state.flash.answered++;
  state.flash.wrong[target.id] = (state.flash.wrong[target.id] || 0) + 1;
  state.flash.missedThisCard = true;
  reshuffleFlashTarget();
}

// Stop the session early and show the score for what was done so far.
function endFlashSession() {
  if (!state.flash.active) return;
  showFlashComplete(true);
}

// Move the current (front) card to a random deeper spot so it isn't the very
// next one shown but does come back around before the deck clears.
function reshuffleFlashTarget() {
  const deck = state.flash.deck;
  if (deck.length <= 1) return;
  const [t] = deck.splice(0, 1);
  const pos = 1 + Math.floor(Math.random() * deck.length);
  deck.splice(pos, 0, t);
}

function highlightCorrectFlashCard() {
  if (!els.cards || !state.currentTarget) return;
  const sel = `.card[data-id="${CSS.escape(state.currentTarget.id)}"]`;
  const el = els.cards.querySelector(sel);
  if (el) el.classList.add("correct");
}

function formatFlashTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function showFlashComplete(partial) {
  state.flash.active = false;
  clearTimeout(state.memoryFlipTimer);
  state.memoryArmed = false;
  if (els.flashBar) els.flashBar.classList.add("hidden");
  const elapsed = Math.max(0, Math.round((Date.now() - state.flash.startTime) / 1000));
  const cleared = state.flash.total - state.flash.deck.length;
  const answered = state.flash.answered;
  if (els.flashCompleteTitle) {
    els.flashCompleteTitle.textContent = partial && state.flash.deck.length > 0 ? t("done_nice") : t("done_all");
  }
  if (els.flashCompleteEmoji) {
    els.flashCompleteEmoji.textContent = partial && state.flash.deck.length > 0 ? "👏" : "🎉";
  }
  if (els.flashStatScore) els.flashStatScore.textContent = `${state.flash.correct}/${answered || 0}`;
  if (els.flashStatFirst) els.flashStatFirst.textContent = String(state.flash.firstTryOk);
  if (els.flashStatCleared) els.flashStatCleared.textContent = `${cleared}/${state.flash.total}`;
  if (els.flashStatTime) els.flashStatTime.textContent = formatFlashTime(elapsed);

  const weakIds = Object.keys(state.flash.wrong).filter((id) => state.flash.wrong[id] > 0);
  if (els.flashWeakList) {
    els.flashWeakList.innerHTML = "";
    weakIds
      .map((id) => state.items.find((i) => i.id === id))
      .filter(Boolean)
      .forEach((item) => {
        const chip = document.createElement("div");
        chip.className = "flash-weak-chip";
        const img = document.createElement("img");
        applyItemImage(img, item);
        img.alt = item.en;
        const label = document.createElement("div");
        label.className = "flash-weak-word";
        label.textContent = wordText(item);
        chip.appendChild(img);
        chip.appendChild(label);
        els.flashWeakList.appendChild(chip);
      });
  }
  if (els.flashWeakSection) els.flashWeakSection.classList.toggle("hidden", weakIds.length === 0);
  if (els.flashComplete) els.flashComplete.classList.remove("hidden");
  playCorrect();
  launchFireworks();
}

function hideFlashComplete() {
  stopFireworks();
  if (els.flashComplete) els.flashComplete.classList.add("hidden");
}

let fireworksTimer = null;
function launchFireworks() {
  const stage = els.flashComplete ? els.flashComplete.querySelector(".flash-fireworks") : null;
  if (!stage) return;
  stopFireworks();
  stage.innerHTML = "";
  const colors = ["#ffce54", "#fc6e51", "#48cfad", "#5d9cec", "#ec87c0", "#a0d468"];
  let n = 0;
  const fire = () => {
    const burst = document.createElement("div");
    burst.className = "firework";
    burst.style.left = 10 + Math.random() * 80 + "%";
    burst.style.top = 12 + Math.random() * 50 + "%";
    const color = colors[n % colors.length];
    for (let i = 0; i < 20; i++) {
      const p = document.createElement("span");
      p.className = "fw-particle";
      const ang = (Math.PI * 2 * i) / 20;
      const dist = 55 + Math.random() * 45;
      p.style.setProperty("--dx", Math.cos(ang) * dist + "px");
      p.style.setProperty("--dy", Math.sin(ang) * dist + "px");
      p.style.background = color;
      burst.appendChild(p);
    }
    stage.appendChild(burst);
    setTimeout(() => burst.remove(), 1300);
    n++;
    fireworksTimer = setTimeout(fire, 380 + Math.random() * 320);
  };
  fire();
}

function stopFireworks() {
  clearTimeout(fireworksTimer);
  fireworksTimer = null;
  const stage = els.flashComplete ? els.flashComplete.querySelector(".flash-fireworks") : null;
  if (stage) stage.innerHTML = "";
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
      els.feedback.textContent = t("fb_no_words");
      if (els.cards) els.cards.innerHTML = "";
      if (els.promptWord) els.promptWord.textContent = "—";
      return;
    }
    if (state.currentGameType === "flash") {
      if (!state.flash.active) { startFlashSession(); return; }
      if (!state.flash.deck.length) { showFlashComplete(); return; }
      chooseFlashItems();
      renderCurrentView();
      speakCurrent();
      return;
    }
    if (state.currentGameType === "memory") {
      if (!state.flash.active) { startMemorySession(); return; }
      if (!state.flash.deck.length) { showFlashComplete(); return; }
      chooseFlashItems();
      renderCurrentView();       // cards render face-up
      speakCurrent();            // read the word…
      startMemoryPeek();         // …then, after a beat, flip them face-down
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
    } else if (state.currentGameType === "flash") {
      renderFlashView();
    } else if (state.currentGameType === "memory") {
      renderMemoryView();
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
  if (els.flashBar) els.flashBar.classList.add("hidden");
}

function renderTapView() {
  els.modeLabel.textContent = t("mode_tap");
  hideAllGameViews();
  showPromptArea(true);
  els.cards.classList.remove("hidden");
  renderCards(state.currentChoices);
  els.promptWord.textContent = wordText(state.currentTarget);
}

function renderFindView() {
  els.modeLabel.textContent = t("mode_find");
  hideAllGameViews();
  showPromptArea(true);
  if (els.findCountBar) els.findCountBar.classList.remove("hidden");
  updateFindCountButtons();
  els.cards.classList.remove("hidden");
  renderCards(state.currentChoices);
  els.promptWord.textContent = wordText(state.currentTarget);
}

function renderDragCompleteView() {
  els.modeLabel.textContent = t("mode_drag");
  hideAllGameViews();
  showPromptArea(true);
  els.completeWordSection.classList.remove("hidden");
  buildDragCompleteRound(state.currentTarget);
}

function renderKanaTapView() {
  els.modeLabel.textContent = t("mode_kana_tap");
  hideAllGameViews();
  showPromptArea(true);
  els.cards.classList.remove("hidden");
  renderKanaCards(state.currentChoices);
  els.promptWord.textContent = "🔊 Listen & pick";
}

function renderKanaCompleteView() {
  els.modeLabel.textContent = t("mode_drag");
  hideAllGameViews();
  showPromptArea(true);
  els.completeWordSection.classList.remove("hidden");
  buildKanaCompleteRound(state.currentTarget);
}

function getAlphabetSet() {
  return state.currentTrack === "katakana" ? state.kataChars : state.kanaChars;
}

function renderAlphabetView() {
  els.modeLabel.textContent = t("mode_alphabet");
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

// --- Premium voice: the parent's own ElevenLabs account -------------------
//
// Same bring-your-own-key shape as the VoiceRSS and Google-image creds above:
// the key lives on the device and the browser calls ElevenLabs directly
// (api.elevenlabs.io answers preflights with `access-control-allow-origin: *`,
// so no server of ours sits in the middle).
//
// Cloned voices come back from GET /v1/voices exactly like stock ones, so a
// parent who clones their own voice on elevenlabs.io just picks it here.
//
// EVERY clip is cached in IndexedDB keyed by voice+model+language+text. A
// toddler taps the same word hundreds of times; uncached that would be
// hundreds of billed generations. Cached, a word costs credits once and then
// plays instantly and offline forever after.
const ELEVEN_API = "https://api.elevenlabs.io/v1";
const ELEVEN_DEFAULT_MODEL = "eleven_flash_v2_5";

let ttsDb = null;
function getTtsDb() {
  if (ttsDb) return Promise.resolve(ttsDb);
  if (!("indexedDB" in window)) return Promise.reject(new Error("no-indexeddb"));
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("kitai-tts", 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("clips")) {
        req.result.createObjectStore("clips", { keyPath: "id" });
      }
    };
    req.onsuccess = () => { ttsDb = req.result; resolve(ttsDb); };
    req.onerror = () => reject(req.error);
  });
}

// Voice and model are part of the key so switching either re-renders rather
// than serving the old voice from cache.
function ttsCacheKey(text) {
  const e = state.eleven;
  return `${e.voiceId}|${e.model || ELEVEN_DEFAULT_MODEL}|${state.lang}|${text}`;
}

async function getCachedClip(id) {
  try {
    const db = await getTtsDb();
    const rec = await requestToPromise(db.transaction("clips", "readonly").objectStore("clips").get(id));
    return rec ? rec.blob : null;
  } catch (_) {
    return null;
  }
}

async function putCachedClip(id, blob) {
  try {
    const db = await getTtsDb();
    db.transaction("clips", "readwrite")
      .objectStore("clips")
      .put({ id, blob, bytes: blob.size, addedAt: Date.now() });
  } catch (_) {}
}

async function ttsCacheStats() {
  try {
    const db = await getTtsDb();
    const all = await requestToPromise(db.transaction("clips", "readonly").objectStore("clips").getAll());
    return { count: all.length, bytes: all.reduce((n, r) => n + (r.bytes || 0), 0) };
  } catch (_) {
    return { count: 0, bytes: 0 };
  }
}

async function clearTtsCache() {
  try {
    const db = await getTtsDb();
    await requestToPromise(db.transaction("clips", "readwrite").objectStore("clips").clear());
  } catch (_) {}
}

function elevenReady() {
  const e = state.eleven;
  return !!(e.enabled && e.key && e.voiceId);
}

// One generation. Throws with a short reason the settings screen can show.
async function elevenPost(body) {
  const e = state.eleven;
  const res = await fetch(
    `${ELEVEN_API}/text-to-speech/${encodeURIComponent(e.voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": e.key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = (j && j.detail && (j.detail.message || j.detail.status)) || "";
    } catch (_) {}
    const err = new Error(detail || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return await res.blob();
}

async function elevenGenerate(text) {
  const model = state.eleven.model || ELEVEN_DEFAULT_MODEL;
  const body = { text, model_id: model };

  // Multilingual v2 picks the language up from the text itself and rejects an
  // explicit language_code; every other model takes one, and pinning it stops
  // "ゴリラ" being read as if it were English.
  const code = (langCfg().prefix || "").slice(0, 2);
  if (code && model !== "eleven_multilingual_v2") {
    body.language_code = code;
    // The language-aware normalizer is Japanese-only, and it needs the
    // language_code above — without one the API answers "not supported for
    // language code 'None'" and we lose the whole generation.
    if (state.lang === "ja") body.apply_language_text_normalization = true;
  }

  try {
    return await elevenPost(body);
  } catch (err) {
    // A plan or model that won't take these hints shouldn't cost the child the
    // premium voice — drop them and try once more before falling back.
    const tunable = "language_code" in body || "apply_language_text_normalization" in body;
    if (!tunable || !(err.status >= 400 && err.status < 500)) throw err;
    delete body.language_code;
    delete body.apply_language_text_normalization;
    return await elevenPost(body);
  }
}

let elevenObjectUrl = null;
function playClipBlob(blob, handlers) {
  try {
    if (elevenObjectUrl) URL.revokeObjectURL(elevenObjectUrl);
    elevenObjectUrl = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.addEventListener("playing", () => handlers.onStart && handlers.onStart(), { once: true });
    audio.addEventListener("error", () => handlers.onFail && handlers.onFail("playback"), { once: true });
    audio.src = elevenObjectUrl;
    const p = audio.play();
    if (p && p.catch) p.catch(() => handlers.onFail && handlers.onFail("playback"));
    onlineAudio = audio;
  } catch (_) {
    handlers.onFail && handlers.onFail("playback");
  }
}

// Cache-first: the first tap of a word generates and stores it, every tap
// after that is free and instant.
function elevenSpeak(phrase, handlers) {
  const id = ttsCacheKey(phrase);
  getCachedClip(id).then((cached) => {
    if (cached) {
      playClipBlob(cached, handlers);
      return;
    }
    elevenGenerate(phrase)
      .then((blob) => {
        putCachedClip(id, blob);
        playClipBlob(blob, handlers);
      })
      .catch((err) => handlers.onFail && handlers.onFail((err && err.message) || "eleven-failed"));
  });
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

  const freeVoices = (err) => {
    if (state.preferOnlineVoice || !("speechSynthesis" in window)) goOnline(err);
    else deviceSpeak(phrase, { onStart: () => succeed("device"), onFail: (e2) => goOnline(e2) });
  };

  // Premium voice wins when it's configured, but never at the cost of silence:
  // an expired key, an empty credit balance or no signal all fall straight
  // through to the free voices below.
  if (elevenReady()) {
    elevenSpeak(phrase, { onStart: () => succeed("eleven"), onFail: (err) => freeVoices(err) });
    return;
  }
  freeVoices("device-unavailable");
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
  els.modeLabel.textContent = t("mode_quiz");
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

    // Memory mode: a flip-over back that hides the picture once the cards turn.
    if (state.currentGameType === "memory") {
      const back = document.createElement("div");
      back.className = "card-back";
      back.textContent = "?";
      back.setAttribute("aria-hidden", "true");
      card.appendChild(back);
    }

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
  if (state.currentGameType === "memory") { handleMemoryTap(item, cardEl); return; }
  if (item.id === state.currentTarget.id) {
    lockForCorrectAdvance();
    cardEl.classList.add("correct");
    els.feedback.textContent = t("fb_great");
    if (state.currentGameType === "find") state.findRepsDone++;
    if (state.currentGameType === "flash") flashOnCorrect();
    playCorrect();
    showCorrectOverlay();
    setTimeout(() => startRound(), CORRECT_ADVANCE_MS);
  } else if (state.currentGameType === "flash") {
    // Flash Cards: a miss doesn't stick the child on one card — it shows the
    // right picture briefly, reshuffles the word back in, and moves on.
    lockForCorrectAdvance();
    flashOnWrong();
    cardEl.classList.add("wrong");
    highlightCorrectFlashCard();
    els.feedback.textContent = t("fb_see_again");
    buzz();
    showWrongOverlay();
    setTimeout(() => startRound(), CORRECT_ADVANCE_MS);
  } else {
    state.lockUntil = Date.now() + WRONG_DEAD_MS;
    cardEl.classList.add("wrong");
    els.feedback.textContent = t("fb_try_again");
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
    els.feedback.textContent = t("fb_great");
    playCorrect();
    showCorrectOverlay();
    setTimeout(() => startRound(), 900);
  } else {
    els.feedback.textContent = t("fb_try_again");
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
    els.feedback.textContent = t("fb_great");
    playCorrect();
    showCorrectOverlay();
    setTimeout(() => startRound(), CORRECT_ADVANCE_MS);
  } else {
    state.lockUntil = Date.now() + WRONG_DEAD_MS;
    cardEl.classList.add("wrong");
    els.feedback.textContent = t("fb_try_again");
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
    els.feedback.textContent = t("fb_great");
    playCorrect();
    showCorrectOverlay();
    setTimeout(() => startRound(), 900);
  } else {
    els.feedback.textContent = t("fb_try_again");
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
    els.feedback.textContent = t("fb_great");
    playCorrect();
    showCorrectOverlay();
    setTimeout(() => startRound(), 900);
  } else {
    els.feedback.textContent = t("fb_try_again");
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
    els.dropzone.textContent = t("fb_try_again");
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
      : speechText(state.currentTarget);

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
