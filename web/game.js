"use strict";
/* ANTES O DESPUÉS — motor v3
   Mejoras añadidas:
   1. Reto Diario (seed por fecha, 10 cartas iguales para todos, compartible)
   2. ¿Sabías qué? (extracto de Wikipedia debajo del año, cacheado)
   3. Combo multiplicador (×2 a las 3 seguidas, ×3 a las 5, ×5 a las 10)
   4. Compartir resultado (Web Share API + clipboard fallback)
   5. Animación de cuenta-atrás del año al revelarlo
   6. Ken Burns continuo en las imágenes
   7. Transición slide entre rondas
   8. Comodines: Saltar (1) + Pista de siglo (1) por partida
   9. Modo Timeline: ordena 4 eventos cronológicamente
  10. Estadísticas por categoría + récords por modo
*/

// ---------- Constantes ----------
const MODES = {
  classic:    { label: "CLÁSICO",      sub: "Sin límite — un fallo y se acabó" },
  express:    { label: "CONTRARRELOJ", sub: "60 segundos. Fallar resta tiempo" },
  hard:       { label: "DIFÍCIL",      sub: "Años cercanos entre sí" },
  daily:      { label: "RETO DIARIO",  sub: "10 cartas — las mismas para todo el mundo" },
  timeline:   { label: "TIMELINE",     sub: "Ordena 4 cartas por fecha" },
  year_exact: { label: "AÑO EXACTO",   sub: "Adivina el año con margen" },
  decade:     { label: "DÉCADA",       sub: "Elige la década correcta" },
  multi:      { label: "MULTIJUGADOR", sub: "Pase-y-juega entre amigos" },
};
const HARD_THRESHOLD   = 20;
const EXPRESS_SECONDS  = 60;
const EXPRESS_PENALTY  = 5;
const IMG_SIZE         = 900;
const IMG_CACHE_KEY    = "ad_img_cache_v3";
const SUM_CACHE_KEY    = "ad_sum_cache_v2";
const STATS_KEY        = "ad_stats_v1";
const PREFS_KEY        = "ad_prefs_v1";
const DAILY_LENGTH     = 10;
const TIMELINE_LENGTH  = 4;
const SHARE_URL        = (typeof location !== "undefined" && location.href) || "";
const REACTION_MS      = 2500;   // <2.5s = bonus
const STREAK_KEY       = "ad_streak_v1";
const ACHIEV_KEY       = "ad_achiev_v1";
const THEME_KEY        = "ad_theme_v1";

// --- ICONOS (Lucide via Iconify) ---
const CAT_ICONS = {
  tech:       "lucide:cpu",
  internet:   "lucide:globe",
  cine:       "lucide:film",
  musica:     "lucide:disc-3",
  deporte:    "lucide:trophy",
  historia:   "lucide:landmark",
  ciencia:    "lucide:flask-conical",
  arte:       "lucide:palette",
  famosos:    "lucide:star",
  juegos:     "lucide:gamepad-2",
  gastro:     "lucide:utensils-crossed",
  espana:     "lucide:flag",
  anime:      "lucide:message-square-text",
  naturaleza: "lucide:trees",
};
const MODE_ICONS = {
  classic:    "lucide:infinity",
  express:    "lucide:timer",
  hard:       "lucide:flame",
  timeline:   "lucide:ruler",
  year_exact: "lucide:target",
  decade:     "lucide:calendar-days",
  daily:      "lucide:sparkles",
  multi:      "lucide:users-round",
};

// --- LOGROS ---
const ACHIEVEMENTS = [
  { id: "first_correct", icon: "🎯", name: "Primer acierto",   desc: "Acierta tu primera carta",          check: s => s.correct >= 1 },
  { id: "answered_50",   icon: "📚", name: "50 cartas",         desc: "Responde 50 cartas",                check: s => s.answered >= 50 },
  { id: "answered_500",  icon: "📖", name: "500 cartas",        desc: "Responde 500 cartas",               check: s => s.answered >= 500 },
  { id: "answered_2000", icon: "🦉", name: "Sabelotodo",        desc: "Responde 2000 cartas",              check: s => s.answered >= 2000 },
  { id: "combo_5",       icon: "🔥", name: "En racha",          desc: "5 aciertos seguidos",               check: s => (s.maxCombo||0) >= 5 },
  { id: "combo_10",      icon: "⚡", name: "Imparable",         desc: "10 aciertos seguidos",              check: s => (s.maxCombo||0) >= 10 },
  { id: "combo_25",      icon: "💎", name: "Leyenda",           desc: "25 aciertos seguidos",              check: s => (s.maxCombo||0) >= 25 },
  { id: "combo_50",      icon: "👑", name: "Dios histórico",    desc: "50 aciertos seguidos",              check: s => (s.maxCombo||0) >= 50 },
  { id: "best_classic_25", icon: "♾️", name: "Maratoniano",   desc: "25+ en Clásico",                  check: s => (s.bestByMode?.classic||0) >= 25 },
  { id: "best_express_20", icon: "⏱️", name: "Velocista",      desc: "20+ en Contrarreloj",              check: s => (s.bestByMode?.express||0) >= 20 },
  { id: "best_hard_15",    icon: "🌶️", name: "Hardcore",        desc: "15+ en Difícil",                    check: s => (s.bestByMode?.hard||0) >= 15 },
  { id: "daily_perfect",   icon: "💯", name: "Día perfecto",    desc: "10/10 en Reto Diario",              check: s => (s.bestByMode?.daily||0) >= 10 },
  { id: "timeline_perfect",icon: "📏", name: "Cronólogo",       desc: "4/4 en Timeline",                   check: s => (s.timelinePerfects||0) >= 1 },
  { id: "year_close",      icon: "🎯", name: "Buen ojo",        desc: "Acierta el año exacto",             check: s => (s.exactYears||0) >= 1 },
  { id: "year_close_10",   icon: "🏹", name: "Tirador",         desc: "Acierta 10 años exactos",           check: s => (s.exactYears||0) >= 10 },
  { id: "decade_master",   icon: "📅", name: "Por décadas",     desc: "20+ en modo Década",                check: s => (s.bestByMode?.decade||0) >= 20 },
  { id: "streak_3",        icon: "📆", name: "3 días seguidos", desc: "Reto diario 3 días seguidos",       check: s => (s.dailyStreak||0) >= 3 },
  { id: "streak_7",        icon: "🗓️", name: "Semana perfecta", desc: "Reto diario 7 días seguidos",       check: s => (s.dailyStreak||0) >= 7 },
  { id: "streak_30",       icon: "📈", name: "Mes constante",   desc: "Reto diario 30 días seguidos",      check: s => (s.dailyStreak||0) >= 30 },
  { id: "cine_50",         icon: "🎬", name: "Cinéfilo",        desc: "50 aciertos en Cine",               check: s => (s.byCat?.cine?.c||0) >= 50 },
  { id: "musica_50",       icon: "🎵", name: "Melómano",        desc: "50 aciertos en Música",             check: s => (s.byCat?.musica?.c||0) >= 50 },
  { id: "deporte_50",      icon: "⚽", name: "Atleta",          desc: "50 aciertos en Deporte",            check: s => (s.byCat?.deporte?.c||0) >= 50 },
  { id: "historia_50",     icon: "🏛️", name: "Historiador",     desc: "50 aciertos en Historia",           check: s => (s.byCat?.historia?.c||0) >= 50 },
  { id: "tech_50",         icon: "💻", name: "Tecnófilo",       desc: "50 aciertos en Tech",               check: s => (s.byCat?.tech?.c||0) >= 50 },
  { id: "espana_50",       icon: "🇪🇸", name: "Patriota",       desc: "50 aciertos en España",             check: s => (s.byCat?.espana?.c||0) >= 50 },
  { id: "juegos_50",       icon: "🎮", name: "Gamer",           desc: "50 aciertos en Videojuegos",        check: s => (s.byCat?.juegos?.c||0) >= 50 },
  { id: "anime_50",        icon: "🗾", name: "Otaku",           desc: "50 aciertos en Anime",              check: s => (s.byCat?.anime?.c||0) >= 50 },
  { id: "gastro_50",       icon: "🍔", name: "Sibarita",        desc: "50 aciertos en Gastronomía",        check: s => (s.byCat?.gastro?.c||0) >= 50 },
  { id: "famosos_50",      icon: "⭐", name: "Cotilla",         desc: "50 aciertos en Famosos",            check: s => (s.byCat?.famosos?.c||0) >= 50 },
  { id: "fast_10",         icon: "💨", name: "Rayo",            desc: "10 aciertos en menos de 2.5s",      check: s => (s.fastAnswers||0) >= 10 },
  { id: "fast_50",         icon: "🚀", name: "Supersónico",     desc: "50 aciertos rápidos",               check: s => (s.fastAnswers||0) >= 50 },
  { id: "ancient",         icon: "🏺", name: "Anticuario",      desc: "Acierta una carta antes del año 0", check: s => (s.ancientCorrect||0) >= 1 },
  { id: "all_cats",        icon: "🌈", name: "Todólogo",        desc: "Acierta en las 14 categorías",      check: s => Object.values(s.byCat||{}).filter(x => x.c>0).length >= 14 },
  { id: "first_share",     icon: "📤", name: "Compartido",      desc: "Comparte tu primer resultado",      check: s => s.shared },
  { id: "powerup_user",    icon: "🎁", name: "Coleccionista",   desc: "Usa 5 power-ups",                   check: s => (s.powerupsUsed||0) >= 5 },
];

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const el = {
  app: $("app"), menu: $("menu"),
  score: $("score"), best: $("best"),
  timerBox: $("timerBox"), timer: $("timer"),
  comboBox: $("comboBox"), comboNum: $("comboNum"), comboMult: $("comboMult"),
  dailyBadge: $("dailyBadge"), dailyProgress: $("dailyProgress"),
  cards: $("cards"), cardTop: $("cardTop"), cardBottom: $("cardBottom"),
  btnBefore: $("btnBefore"), btnAfter: $("btnAfter"),
  btnMenu: $("btnMenu"),
  gameOver: $("gameOver"), goScore: $("goScore"),
  goTitle: $("goTitle"), goSub: $("goSub"), goBest: $("goBest"),
  btnRestart: $("btnRestart"), btnBack: $("btnBack"),
  btnShare: $("btnShare"), btnStats: $("btnStats"),
  modeList: $("modeList"), catList: $("catList"),
  catAll: $("catAll"), catNone: $("catNone"),
  poolCount: $("poolCount"), btnPlay: $("btnPlay"),
  btnOpenStats: $("btnOpenStats"),
  hintBefore: $("hintBefore"), hintAfter: $("hintAfter"),
  btnSkip: $("btnSkip"), btnHint: $("btnHint"),
  skipCount: $("skipCount"), hintCount: $("hintCount"),
  lifelines: $("lifelines"), actions: $("actions"),
  timeline: $("timeline"), tlList: $("tlList"),
  tlSubmit: $("tlSubmit"), tlNext: $("tlNext"),
  dailyCard: $("dailyCard"), daySub: $("daySub"), dayIcon: $("dayIcon"),
  stats: $("stats"), closeStats: $("closeStats"),
  statGames: $("statGames"), statAnswered: $("statAnswered"), statAccuracy: $("statAccuracy"),
  statRecords: $("statRecords"), statCats: $("statCats"),
  achievToast: $("achievToast"), achievName: $("achievName"), achievDesc: $("achievDesc"),
  review: $("review"), reviewList: $("reviewList"), closeReview: $("closeReview"),
  btnReview: $("btnReview"), btnShareImg: $("btnShareImg"),
  streakChip: $("streakChip"), streakNum: $("streakNum"),
  achievsGrid: $("achievsGrid"), achievCount: $("achievCount"),
  themeButtons: $("themeButtons"),
  yearInput: $("yearInput"), yiField: $("yiField"), yiSubmit: $("yiSubmit"), yiFeedback: $("yiFeedback"),
  decadeInput: $("decadeInput"), decGrid: $("decGrid"),
  decPrev: $("decPrev"), decNext: $("decNext"), decRangeLabel: $("decRangeLabel"),
  powerups: $("powerups"),
  multiSetup: $("multiSetup"), multiPlayers: $("multiPlayers"),
  multiAdd: $("multiAdd"), multiStart: $("multiStart"), multiCancel: $("multiCancel"),
  btnMulti: $("btnMulti"), multiTurn: $("multiTurn"),
};

// ---------- Estado ----------
let mode = "classic";
let selectedCats = new Set();
let pool = [];
let queue = [];
let topEvent = null;
let bottomEvent = null;
let score = 0;
let best = 0;
let combo = 0;
let locked = false;
let timerId = null;
let timeLeft = 0;
let lifelines = { skip: 1, hint: 1 };
let dailyRoster = [];   // 11 events when in daily mode
let dailyRound = 0;     // current round index (1..10)
let timelineEvents = [];
let timelineOrder = []; // current order in timeline mode
let timelineRevealed = false;
let timelineRound = 0;
let answerLog = [];          // {event, isCorrect, userAnswer, deltaMs} for review
let questionStartMs = 0;     // for reaction bonus
let activePowerups = [];     // [{type}]
let pendingDoublePoints = false;
let pendingExtraLife = false;
let pendingImmune = false;
let pendingInvert = false;
let pendingFog = false;
let pendingBlur = false;
let decadeRangeStart = 1900; // decade input view start
// multiplayer
let multiPlayersList = [];   // [{name, lives, score}]
let multiCurrentIdx = 0;

// ---------- Persistencia ----------
const STORE = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};
function bestKey(m) { return "ad_best_" + m; }

// ---------- Stats globales ----------
let stats = STORE.get(STATS_KEY, {
  games: 0, answered: 0, correct: 0, byCat: {}, bestByMode: {},
  maxCombo: 0, fastAnswers: 0, exactYears: 0, ancientCorrect: 0,
  timelinePerfects: 0, powerupsUsed: 0, dailyStreak: 0, shared: false,
});
function saveStats() { STORE.set(STATS_KEY, stats); }
function trackAnswer(cat, isCorrect) {
  stats.answered++;
  if (isCorrect) stats.correct++;
  if (!stats.byCat[cat]) stats.byCat[cat] = { c: 0, t: 0 };
  stats.byCat[cat].t++;
  if (isCorrect) stats.byCat[cat].c++;
  saveStats();
  checkAchievements();
}
function trackGameEnd() {
  stats.games++;
  const cur = stats.bestByMode[mode] || 0;
  if (score > cur) stats.bestByMode[mode] = score;
  saveStats();
  checkAchievements();
}

// --- LOGROS / ACHIEVEMENTS ---
let achievUnlocked = new Set(STORE.get(ACHIEV_KEY, []));
function saveAchievs() { STORE.set(ACHIEV_KEY, Array.from(achievUnlocked)); }
let achievToastQueue = [];
let achievToastBusy = false;
function showAchievToast(ach) {
  achievToastQueue.push(ach);
  if (!achievToastBusy) flushAchievToasts();
}
function flushAchievToasts() {
  if (!achievToastQueue.length) { achievToastBusy = false; return; }
  achievToastBusy = true;
  const ach = achievToastQueue.shift();
  el.achievToast.classList.remove("hidden");
  el.achievToast.querySelector(".achiev-ico").textContent = ach.icon;
  el.achievName.textContent = ach.name;
  el.achievDesc.textContent = ach.desc;
  requestAnimationFrame(() => el.achievToast.classList.add("show"));
  Sound.milestone();
  setTimeout(() => {
    el.achievToast.classList.remove("show");
    setTimeout(() => { el.achievToast.classList.add("hidden"); flushAchievToasts(); }, 450);
  }, 3200);
}
function checkAchievements() {
  for (const a of ACHIEVEMENTS) {
    if (achievUnlocked.has(a.id)) continue;
    try {
      if (a.check(stats)) {
        achievUnlocked.add(a.id); saveAchievs();
        if (typeof BIG_ACHIEVEMENTS !== "undefined" && BIG_ACHIEVEMENTS.has(a.id)) {
          showAchievBig(a);
        } else {
          showAchievToast(a);
        }
      }
    } catch (e) {}
  }
}

// --- RACHA DIARIA (streak) ---
let streakState = STORE.get(STREAK_KEY, { count: 0, lastDate: null });
function saveStreak() { STORE.set(STREAK_KEY, streakState); }
function diffDays(a, b) {
  const da = new Date(a), db = new Date(b);
  return Math.round((db - da) / 86400000);
}
function updateStreakOnDailyDone() {
  const today = dailyDateKey();
  if (streakState.lastDate === today) return;
  if (streakState.lastDate) {
    const d = diffDays(streakState.lastDate, today);
    if (d === 1) streakState.count++;
    else streakState.count = 1;
  } else {
    streakState.count = 1;
  }
  streakState.lastDate = today;
  saveStreak();
  stats.dailyStreak = streakState.count;
  saveStats();
}
function isStreakAlive() {
  if (!streakState.lastDate) return false;
  const d = diffDays(streakState.lastDate, dailyDateKey());
  return d === 0 || d === 1;
}

// --- TEMA ---
function applyTheme(t) {
  if (!t || t === "default") document.body.removeAttribute("data-theme");
  else document.body.setAttribute("data-theme", t);
  STORE.set(THEME_KEY, t || "default");
  document.querySelectorAll(".theme-btn").forEach(b => b.classList.toggle("active", (b.dataset.theme || "default") === (t || "default")));
}

// ---------- Audio ----------
const Sound = {
  ctx: null, ready: false,
  init() {
    if (this.ready) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.ready = true;
    } catch (e) {}
  },
  beep(freq, dur, type = "sine", vol = 0.18) {
    if (!this.ready) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.start(now); o.stop(now + dur + 0.02);
  },
  correct() { this.beep(660, 0.10, "triangle", 0.15); setTimeout(() => this.beep(990, 0.16, "triangle", 0.15), 90); },
  wrong()   { this.beep(180, 0.40, "sawtooth", 0.22); setTimeout(() => this.beep(120, 0.50, "sawtooth", 0.20), 80); },
  click()   { this.beep(1200, 0.03, "square", 0.06); },
  tick()    { this.beep(800, 0.04, "sine", 0.05); },
  combo(n)  { this.beep(700 + n * 60, 0.08, "triangle", 0.14); },
  milestone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.beep(f, 0.18, "triangle", 0.16), i * 90)); },
};

// ---------- Imágenes ----------
let imgCache = STORE.get(IMG_CACHE_KEY, {});
function saveImgCache() { STORE.set(IMG_CACHE_KEY, imgCache); }

async function fetchImageFor(wikiTitle) {
  if (imgCache[wikiTitle]) return imgCache[wikiTitle];   // sólo cache de éxitos
  // 1) action API con pithumbsize (mejor resolución)
  for (const lang of ["en", "es"]) {
    try {
      const u = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&prop=pageimages&piprop=thumbnail&pithumbsize=${IMG_SIZE}&titles=${wikiTitle}&origin=*&redirects=1`;
      const r = await fetch(u);
      if (!r.ok) continue;
      const j = await r.json();
      const pages = j.query && j.query.pages;
      const url = pages && pages[0] && pages[0].thumbnail && pages[0].thumbnail.source;
      if (url) { imgCache[wikiTitle] = url; saveImgCache(); return url; }
    } catch (e) {}
  }
  // 2) REST summary como fallback (sigue redirects automáticamente)
  for (const lang of ["en", "es"]) {
    try {
      const r = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${wikiTitle}?redirect=true`);
      if (!r.ok) continue;
      const j = await r.json();
      const url = (j.originalimage && j.originalimage.source) || (j.thumbnail && j.thumbnail.source);
      if (url) { imgCache[wikiTitle] = url; saveImgCache(); return url; }
    } catch (e) {}
  }
  return "";   // sin cachear: se reintenta en la próxima sesión
}
function preloadImage(event) {
  if (!event) return;
  fetchImageFor(event.w).then(url => { if (url) { const i = new Image(); i.src = url; } });
}

// ---------- Resumen (Sabías qué) ----------
let sumCache = STORE.get(SUM_CACHE_KEY, {});
function saveSumCache() { STORE.set(SUM_CACHE_KEY, sumCache); }
function truncateAt(s, n) {
  if (!s || s.length <= n) return s;
  const cut = s.slice(0, n);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 60 ? cut.slice(0, lastSpace) : cut) + '…';
}
async function fetchSummary(wikiTitle) {
  if (sumCache[wikiTitle]) return sumCache[wikiTitle];   // sólo cache de éxitos
  for (const lang of ["es", "en"]) {
    try {
      const r = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${wikiTitle}?redirect=true`);
      if (!r.ok) continue;
      const j = await r.json();
      const text = (j.extract || "").replace(/\s+/g, " ").trim();
      if (text) {
        const short = truncateAt(text, 140);
        sumCache[wikiTitle] = short;
        saveSumCache();
        return short;
      }
    } catch (e) {}
  }
  return "";   // sin cachear: se reintenta
}

// ---------- Seeded RNG (para Reto Diario) ----------
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = seed;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function seededShuffle(arr, seed) {
  const rng = mulberry32(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function dailyDateKey() {
  const d = new Date();
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function dailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
function dailyResultKey() { return "ad_daily_" + dailyDateKey(); }
function getDailyRoster() { return seededShuffle(EVENTS, dailySeed()).slice(0, DAILY_LENGTH + 1); }
function dailyResult() { return STORE.get(dailyResultKey(), null); }

// ---------- Animación de año ----------
function animateYear(elem, targetYear, ms = 550) {
  const isBC = targetYear < 0;
  const abs = Math.abs(targetYear);
  const span = Math.min(abs, 250);
  const start = abs - span;
  const startT = performance.now();
  elem.dataset.animToken = String(Date.now() + Math.random());
  const token = elem.dataset.animToken;
  function frame(now) {
    if (elem.dataset.animToken !== token) return;
    const t = Math.min(1, (now - startT) / ms);
    const eased = 1 - Math.pow(1 - t, 4);
    const cur = Math.round(start + (abs - start) * eased);
    elem.textContent = isBC ? cur + " a.C." : String(cur);
    if (t < 1) requestAnimationFrame(frame);
    else elem.textContent = isBC ? abs + " a.C." : String(abs);
  }
  requestAnimationFrame(frame);
}

// ---------- Render de carta ----------
function isLogoUrl(url) {
  return /\/svg\/|logo|\.svg\.png|\.svg$/i.test(url);
}

function setBtnLabels(inverted) {
  const beforeHTML = inverted
    ? '<span class="btn-main">DESPUÉS <iconify-icon icon="lucide:chevron-right"></iconify-icon></span><span class="btn-sub">que la referencia</span>'
    : '<span class="btn-main"><iconify-icon icon="lucide:chevron-left"></iconify-icon> ANTES</span><span class="btn-sub">que la referencia</span>';
  const afterHTML = inverted
    ? '<span class="btn-main"><iconify-icon icon="lucide:chevron-left"></iconify-icon> ANTES</span><span class="btn-sub">que la referencia</span>'
    : '<span class="btn-main">DESPUÉS <iconify-icon icon="lucide:chevron-right"></iconify-icon></span><span class="btn-sub">que la referencia</span>';
  el.btnBefore.innerHTML = beforeHTML;
  el.btnAfter.innerHTML  = afterHTML;
}

function renderCard(card, event, showYear) {
  const titleEl = card.querySelector(".card-title");
  const yearEl  = card.querySelector(".card-year");
  const factEl  = card.querySelector(".card-fact");
  const imgEl   = card.querySelector(".card-img");
  const fbEl    = card.querySelector(".card-fallback");
  const catEl   = card.querySelector(".card-cat");
  const catIco  = card.querySelector(".cat-ico");
  const catLab  = card.querySelector(".cat-label");

  titleEl.textContent = event.t;
  if (showYear) {
    yearEl.textContent = fmtYear(event.y);
    yearEl.classList.remove("hidden-q");
    yearEl.style.color = "";
  } else {
    yearEl.textContent = "?";
    yearEl.classList.add("hidden-q");
    yearEl.style.color = "";
  }

  const cat = CATEGORIES[event.c];
  const catIcoName = CAT_ICONS[event.c] || "lucide:tag";
  if (cat) {
    catEl.style.display = "";
    if (catIco && catIco.tagName.toLowerCase() === "iconify-icon") catIco.setAttribute("icon", catIcoName);
    else if (catIco) catIco.textContent = cat.icon;
    catLab.textContent = cat.label;
    if (fbEl && fbEl.tagName.toLowerCase() === "iconify-icon") fbEl.setAttribute("icon", catIcoName);
    else if (fbEl) fbEl.textContent = cat.icon;
  } else {
    catEl.style.display = "none";
    if (fbEl && fbEl.tagName.toLowerCase() === "iconify-icon") fbEl.setAttribute("icon", "lucide:help-circle");
  }

  // Fun fact only for revealed cards (top during play)
  if (factEl) {
    factEl.textContent = "";
    factEl.classList.remove("show");
    if (showYear) {
      fetchSummary(event.w).then(text => {
        if (card.dataset.eid !== event.w) return;
        if (!text) return;
        factEl.textContent = text;
        factEl.classList.add("show");
      });
    }
  }

  imgEl.classList.remove("loaded", "is-logo", "blurred");
  imgEl.removeAttribute("src");
  imgEl.alt = event.t;
  const skEl = card.querySelector(".card-skeleton");
  if (skEl) skEl.style.opacity = "";   // restore shimmer

  // Power-ups troll que afectan visualmente la próxima carta inferior
  if (card === el.cardBottom && !showYear) {
    card.classList.toggle("fog", pendingFog);
    if (pendingBlur) imgEl.classList.add("blurred");
    setBtnLabels(pendingInvert);
  }

  fetchImageFor(event.w).then(url => {
    if (card.dataset.eid !== event.w) return;
    if (!url) { if (skEl) skEl.style.opacity = "0"; return; }
    if (isLogoUrl(url)) imgEl.classList.add("is-logo");
    imgEl.onload  = () => imgEl.classList.add("loaded");
    imgEl.onerror = () => { if (skEl) skEl.style.opacity = "0"; };
    imgEl.src = url;
  });
  card.dataset.eid = event.w;
}

function updateScore() {
  animateNumber(el.score, score);
  el.best.textContent = best;
}
function animateNumber(node, target, ms = 450) {
  const start = parseInt(node.textContent, 10) || 0;
  if (start === target) return;
  const startT = performance.now();
  node.dataset.animToken = String(Date.now() + Math.random());
  const token = node.dataset.animToken;
  function frame(now) {
    if (node.dataset.animToken !== token) return;
    const t = Math.min(1, (now - startT) / ms);
    const eased = 1 - Math.pow(1 - t, 3);
    const cur = Math.round(start + (target - start) * eased);
    node.textContent = cur;
    if (t < 1) requestAnimationFrame(frame);
    else node.textContent = target;
  }
  requestAnimationFrame(frame);
}

// ---------- Combo ----------
function comboMultiplier(c) {
  if (c >= 10) return 5;
  if (c >= 5) return 3;
  if (c >= 3) return 2;
  return 1;
}
function updateComboUI(bump) {
  const m = comboMultiplier(combo);
  el.comboNum.textContent = combo;
  el.comboMult.textContent = `×${m}`;
  el.comboBox.classList.toggle("show", combo >= 3);
  // Llama escala con el combo
  const flame = el.comboBox.querySelector(".flame");
  if (flame) {
    const scale = Math.min(1.8, 1 + combo * 0.04);
    flame.style.fontSize = (16 * scale) + "px";
  }
  if (bump) {
    el.comboBox.classList.remove("bump");
    void el.comboBox.offsetWidth;
    el.comboBox.classList.add("bump");
  }
}

// ---------- Pool & selección ----------
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function buildPool() { return EVENTS.filter(e => selectedCats.has(e.c)); }

function pickNext(currentTop) {
  if (!queue.length) queue = shuffle(pool.filter(e => e.w !== currentTop.w));
  if (mode === "hard") {
    for (let i = queue.length - 1; i >= 0; i--) {
      const c = queue[i];
      const diff = Math.abs(c.y - currentTop.y);
      if (diff > 0 && diff <= HARD_THRESHOLD && c.w !== currentTop.w) {
        queue.splice(i, 1); return c;
      }
    }
    for (let i = queue.length - 1; i >= 0; i--) {
      const c = queue[i];
      const diff = Math.abs(c.y - currentTop.y);
      if (diff <= 40 && c.w !== currentTop.w) { queue.splice(i, 1); return c; }
    }
  }
  return queue.pop();
}

// ---------- Timer (express) ----------
function startTimer() {
  stopTimer();
  timeLeft = EXPRESS_SECONDS;
  el.timer.textContent = timeLeft;
  el.timerBox.classList.add("show");
  el.timerBox.classList.remove("warn");
  timerId = setInterval(() => {
    timeLeft--;
    el.timer.textContent = Math.max(0, timeLeft);
    if (timeLeft <= 10) {
      el.timerBox.classList.add("warn");
      if (timeLeft > 0) Sound.tick();
    }
    if (timeLeft <= 0) { stopTimer(); gameOver(true); }
  }, 1000);
}
function stopTimer() {
  if (timerId) { clearInterval(timerId); timerId = null; }
  el.timerBox.classList.remove("show", "warn");
}

// ---------- Comodines (lifelines) ----------
function setLifelinesEnabled(enabled) {
  el.btnSkip.disabled = !enabled || lifelines.skip <= 0;
  el.btnHint.disabled = !enabled || lifelines.hint <= 0;
}
function resetLifelines() {
  lifelines = { skip: 1, hint: 1 };
  el.skipCount.textContent = lifelines.skip;
  el.hintCount.textContent = lifelines.hint;
  setLifelinesEnabled(true);
}
function useSkip() {
  if (locked || lifelines.skip <= 0) return;
  lifelines.skip--; el.skipCount.textContent = lifelines.skip;
  setLifelinesEnabled(true);
  Sound.click();
  // Replace bottomEvent without scoring
  bottomEvent = pickNext(topEvent);
  el.cardBottom.classList.add("slideIn");
  renderCard(el.cardBottom, bottomEvent, false);
  setTimeout(() => el.cardBottom.classList.remove("slideIn"), 550);
}
function useHint() {
  if (locked || lifelines.hint <= 0 || !bottomEvent) return;
  lifelines.hint--; el.hintCount.textContent = lifelines.hint;
  setLifelinesEnabled(true);
  Sound.click();
  const c = centuryHint(bottomEvent.y);
  const titleEl = el.cardBottom.querySelector(".card-title");
  const original = titleEl.textContent;
  titleEl.textContent = `${original}  ·  ${c}`;
  setTimeout(() => { if (titleEl.textContent.endsWith(c)) titleEl.textContent = original; }, 4000);
}
function centuryHint(y) {
  const abs = Math.abs(y);
  const c = Math.ceil(abs / 100);
  const era = y < 0 ? " a.C." : "";
  const roman = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV","XVI","XVII","XVIII","XIX","XX","XXI"];
  if (c >= 1 && c <= 21) return `🕰️ siglo ${roman[c-1]}${era}`;
  return `🕰️ año ~${y}`;
}

// ---------- Partida ----------
function newGame() {
  if (mode === "daily") return newDailyGame();
  if (mode === "timeline") return newTimelineGame();
  if (mode === "year_exact") return newYearGame();
  if (mode === "decade") return newDecadeGame();
  if (mode === "multi") return newMultiGame();

  setupModeUI();

  pool = buildPool();
  if (pool.length < 2) { showMenu(); return; }
  queue = shuffle(pool);
  topEvent = queue.pop();
  bottomEvent = pickNext(topEvent);

  score = 0; combo = 0;
  answerLog = [];
  activePowerups = [];
  pendingDoublePoints = false;
  pendingExtraLife = false;
  pendingImmune = false;
  pendingInvert = false;
  pendingFog = false;
  pendingBlur = false;
  renderPowerups();
  best = STORE.get(bestKey(mode), 0);
  updateScore();
  updateComboUI(false);
  resetLifelines();

  renderCard(el.cardTop, topEvent, true);
  renderCard(el.cardBottom, bottomEvent, false);
  el.gameOver.classList.add("hidden");
  setButtons(true);
  locked = false;
  questionStartMs = Date.now();

  if (mode === "express") startTimer(); else stopTimer();
}

function setButtons(enabled) {
  el.btnBefore.disabled = !enabled;
  el.btnAfter.disabled  = !enabled;
  setLifelinesEnabled(enabled);
}

function popText(text, x, y, color) {
  const d = document.createElement("div");
  d.className = "pop";
  d.textContent = text;
  d.style.left = (x - 30) + "px";
  d.style.top = y + "px";
  if (color) d.style.color = color;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 1000);
}

function confetti(count = 40) {
  const colors = ["#ffd166", "#06d6a0", "#ef476f", "#4361ee", "#f77f00"];
  for (let i = 0; i < count; i++) {
    const c = document.createElement("div");
    c.className = "confetti";
    c.style.left = (Math.random() * 100) + "vw";
    c.style.top = "-10px";
    c.style.background = colors[Math.floor(Math.random() * colors.length)];
    c.style.animationDelay = (Math.random() * 0.4) + "s";
    c.style.animationDuration = (1.4 + Math.random() * 0.8) + "s";
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 2500);
  }
}

function onGuess(isBefore) {
  if (locked || !bottomEvent) return;
  locked = true;
  setButtons(false);
  Sound.click();

  // 💣 Invert troll: invierte el significado del botón
  if (pendingInvert) isBefore = !isBefore;

  let correct = (bottomEvent.y === topEvent.y)
    ? true
    : (isBefore ? bottomEvent.y < topEvent.y : bottomEvent.y > topEvent.y);

  // 🍀 Inmune: la próxima cuenta como correcta
  if (pendingImmune) { correct = true; pendingImmune = false; }

  // Reset visual trolls una vez confirmada la respuesta
  if (pendingFog || pendingBlur || pendingInvert) {
    pendingFog = false; pendingBlur = false; pendingInvert = false;
    el.cardBottom.classList.remove("fog");
    const imgEl = el.cardBottom.querySelector(".card-img");
    if (imgEl) imgEl.classList.remove("blurred");
    setBtnLabels(false);
  }

  // Reaction time bonus
  const reactionMs = Date.now() - questionStartMs;
  const isFast = correct && reactionMs > 100 && reactionMs < REACTION_MS;
  if (isFast) { stats.fastAnswers = (stats.fastAnswers||0) + 1; saveStats(); }

  // Reveal year with animated count-up
  const yearEl = el.cardBottom.querySelector(".card-year");
  yearEl.classList.remove("hidden-q");
  yearEl.style.color = correct ? "var(--green)" : "var(--red)";
  animateYear(yearEl, bottomEvent.y, 550);

  trackAnswer(bottomEvent.c, correct);
  answerLog.push({ event: bottomEvent, isCorrect: correct, userAnswer: isBefore ? "antes" : "después", deltaMs: reactionMs });

  if (correct && bottomEvent.y < 0) { stats.ancientCorrect = (stats.ancientCorrect||0) + 1; saveStats(); }

  if (correct) {
    haptic(15);
    flipCard(el.cardBottom);
    combo++;
    if ((stats.maxCombo||0) < combo) { stats.maxCombo = combo; saveStats(); checkAchievements(); }
    let mult = comboMultiplier(combo);
    if (pendingDoublePoints) { mult *= 2; pendingDoublePoints = false; }
    let gain = mult + (isFast ? 1 : 0);
    score += gain;
    const cb = el.cardBottom.getBoundingClientRect();
    spawnParticles(cb.left + cb.width / 2, cb.top + cb.height / 2, 14);
    if (score > best && mode !== "daily") {
      best = score;
      STORE.set(bestKey(mode), best);
    }
    if (combo >= 3) Sound.combo(combo);
    else Sound.correct();
    if (combo === 3 || combo === 5 || combo === 10) Sound.milestone();
    updateComboUI(true);
    el.cardBottom.classList.add("correct");

    const r = el.cardBottom.getBoundingClientRect();
    const txt = isFast ? `+${gain} 💨` : (mult > 1 ? `+${gain} ×${mult}` : `+${gain}`);
    popText(txt, r.left + r.width / 2, r.top + 20);
    maybeDropPowerup(combo);

    if (score === 10 || score === 25 || score === 50 || score === 100) {
      confetti(50 + Math.min(score, 80));
      Sound.milestone();
    }

    setTimeout(() => {
      if (mode === "daily") {
        dailyRound++;
        if (dailyRound >= DAILY_LENGTH) { finishDaily(); return; }
        advanceRound();
      } else if (mode === "multi") {
        multiAdvance(true);
        advanceRound();
      } else {
        advanceRound();
      }
    }, 850);
  } else {
    haptic([80, 30, 80]);
    combo = 0;
    updateComboUI(false);
    Sound.wrong();
    el.cardBottom.classList.add("wrong");

    if (mode === "express") {
      timeLeft = Math.max(0, timeLeft - EXPRESS_PENALTY);
      el.timer.textContent = timeLeft;
      const r = el.cardBottom.getBoundingClientRect();
      popText(`-${EXPRESS_PENALTY}s`, r.left + r.width / 2, r.top + 20, "var(--red)");
      setTimeout(() => {
        el.cardBottom.classList.remove("wrong");
        if (timeLeft <= 0) gameOver(true);
        else advanceRound();
      }, 1100);
    } else if (mode === "daily") {
      setTimeout(() => {
        el.cardBottom.classList.remove("wrong");
        dailyRound++;
        if (dailyRound >= DAILY_LENGTH) { finishDaily(); return; }
        advanceRound();
      }, 1100);
    } else if (mode === "multi") {
      setTimeout(() => {
        el.cardBottom.classList.remove("wrong");
        multiAdvance(false);
        // Si alguien sigue vivo, advance
        const alive = multiPlayersList.filter(p => p.lives > 0);
        if (alive.length > 1) advanceRound();
      }, 1100);
    } else {
      // Clásico/Difícil: si hay vida extra, salva la partida
      if (pendingExtraLife) {
        pendingExtraLife = false;
        const r = el.cardBottom.getBoundingClientRect();
        popText("❤️ SALVADO", r.left + r.width/2, r.top + 20, "var(--green)");
        setTimeout(() => {
          el.cardBottom.classList.remove("wrong");
          advanceRound();
        }, 1100);
      } else {
        setTimeout(() => {
          el.cardBottom.classList.remove("wrong");
          gameOver(false);
        }, 1100);
      }
    }
  }
}

function advanceRound() {
  const isMobile = window.matchMedia("(max-width: 700px)").matches;
  el.cardTop.classList.add(isMobile ? "slideOutV" : "slideOutH");

  setTimeout(() => {
    el.cardTop.classList.remove("slideOutV", "slideOutH", "correct");
    topEvent = bottomEvent;
    if (mode === "daily") {
      bottomEvent = dailyRoster[dailyRound + 1] || null;
    } else {
      bottomEvent = pickNext(topEvent);
    }
    renderCard(el.cardTop, topEvent, true);
    el.cardTop.classList.add(isMobile ? "movedToTopV" : "movedToTopH");

    if (bottomEvent) {
      renderCard(el.cardBottom, bottomEvent, false);
      el.cardBottom.classList.remove("correct", "wrong");
      el.cardBottom.classList.add("slideIn");
    }

    setTimeout(() => {
      el.cardTop.classList.remove("movedToTopH", "movedToTopV");
      el.cardBottom.classList.remove("slideIn");
    }, 550);

    if (mode !== "daily" && queue.length) preloadImage(queue[queue.length - 1]);

    updateScore();
    locked = false;
    setButtons(true);
    questionStartMs = Date.now();

    if (mode === "daily") {
      el.dailyProgress.textContent = `${dailyRound}/${DAILY_LENGTH}`;
    }
    if (mode === "multi") updateMultiTurn();
  }, 480);
}

function gameOver(byTimeout) {
  stopTimer();
  trackGameEnd();
  const m = MODES[mode];
  el.goTitle.textContent = byTimeout ? "¡SE ACABÓ EL TIEMPO!" : "FIN DEL JUEGO";
  el.goSub.textContent = "Modo " + m.label;
  el.goScore.textContent = score;
  const prevBest = mode === "daily" ? 0 : STORE.get(bestKey(mode), 0);
  if (score > 0 && score >= prevBest && mode !== "daily") {
    el.goBest.innerHTML = `<span class="new-record">★ Nuevo récord: ${score}</span>`;
  } else if (mode === "daily") {
    el.goBest.textContent = `Reto de hoy completado`;
  } else {
    el.goBest.textContent = `Récord: ${prevBest}`;
  }
  el.btnShare.classList.remove("copied");
  el.btnShare.innerHTML = "<iconify-icon icon=\"lucide:share-2\"></iconify-icon> COMPARTIR";
  el.gameOver.classList.remove("hidden");
}

// ---------- Modo Daily ----------
function newDailyGame() {
  const existing = dailyResult();
  if (existing) {
    score = existing.score;
    mode = "daily";
    el.gameOver.classList.remove("hidden");
    el.goTitle.textContent = "RETO DE HOY";
    el.goSub.textContent = `Ya lo jugaste — ${score}/${DAILY_LENGTH}`;
    el.goScore.textContent = score;
    el.goBest.textContent = `Vuelve mañana para un reto nuevo`;
    el.btnShare.classList.remove("copied");
    el.btnShare.innerHTML = "<iconify-icon icon=\"lucide:share-2\"></iconify-icon> COMPARTIR";
    return;
  }

  el.timeline.classList.add("hidden");
  el.cards.classList.remove("hidden");
  el.actions.style.display = "";
  el.lifelines.style.display = "none";  // no comodines en daily
  el.dailyBadge.classList.add("show");

  dailyRoster = getDailyRoster();
  dailyRound = 0;
  topEvent = dailyRoster[0];
  bottomEvent = dailyRoster[1];
  score = 0; combo = 0;
  best = stats.bestByMode["daily"] || 0;
  updateScore();
  updateComboUI(false);
  el.dailyProgress.textContent = `${dailyRound}/${DAILY_LENGTH}`;

  renderCard(el.cardTop, topEvent, true);
  renderCard(el.cardBottom, bottomEvent, false);
  el.gameOver.classList.add("hidden");
  setButtons(true);
  locked = false;
  stopTimer();
}
function finishDaily() {
  STORE.set(dailyResultKey(), { score, date: dailyDateKey() });
  trackGameEnd();
  updateStreakOnDailyDone();
  refreshStreakChip();
  el.dailyBadge.classList.remove("show");
  el.goTitle.textContent = "RETO COMPLETADO";
  el.goSub.textContent = `Acertaste ${score} de ${DAILY_LENGTH}`;
  el.goScore.textContent = score;
  el.goBest.textContent = `Comparte el resultado 👇`;
  el.btnShare.classList.remove("copied");
  el.btnShare.innerHTML = "<iconify-icon icon=\"lucide:share-2\"></iconify-icon> COMPARTIR";
  el.gameOver.classList.remove("hidden");
  if (score === DAILY_LENGTH) confetti(80);
}

// ---------- Modo Timeline ----------
function newTimelineGame() {
  el.cards.classList.add("hidden");
  el.timeline.classList.remove("hidden");
  el.actions.style.display = "none";
  el.lifelines.style.display = "none";
  el.dailyBadge.classList.remove("show");
  stopTimer();

  pool = buildPool();
  if (pool.length < TIMELINE_LENGTH) { showMenu(); return; }

  score = 0;
  combo = 0;
  timelineRound = 0;
  best = STORE.get(bestKey(mode), 0);
  updateScore();
  updateComboUI(false);

  el.gameOver.classList.add("hidden");
  startTimelineRound();
}
function startTimelineRound() {
  timelineRevealed = false;
  el.tlSubmit.style.display = "";
  el.tlNext.classList.remove("show");
  // Pick TIMELINE_LENGTH distinct events
  const shuffled = shuffle(pool);
  const picked = [];
  const usedYears = new Set();
  for (const e of shuffled) {
    if (picked.length >= TIMELINE_LENGTH) break;
    if (usedYears.has(e.y)) continue;
    picked.push(e);
    usedYears.add(e.y);
  }
  timelineEvents = picked;
  // Randomize initial order (not sorted)
  timelineOrder = shuffle(picked);
  renderTimeline();
}
function renderTimeline() {
  el.tlList.innerHTML = "";
  timelineOrder.forEach((event, idx) => {
    const row = document.createElement("div");
    row.className = "tl-row";
    if (timelineRevealed) {
      const sorted = [...timelineEvents].sort((a, b) => a.y - b.y);
      const correctIdx = sorted.indexOf(event);
      row.classList.add(correctIdx === idx ? "correct" : "wrong");
      row.classList.add("revealed");
    }
    const cat = CATEGORIES[event.c] || { icon: "❔", label: "?" };
    const icoName = CAT_ICONS[event.c] || "lucide:tag";
    row.innerHTML = `
      <div class="tl-img-wrap"><img alt=""></div>
      <div class="tl-body">
        <div class="tl-title">${event.t}</div>
        <div class="tl-meta">
          <span class="tl-cat"><iconify-icon icon="${icoName}" style="vertical-align:-2px;"></iconify-icon> ${cat.label}</span>
          <span class="tl-year">${fmtYear(event.y)}</span>
        </div>
      </div>
      <div class="tl-actions">
        <button data-action="up" ${idx === 0 ? "disabled" : ""}><iconify-icon icon="lucide:chevron-up"></iconify-icon></button>
        <button data-action="down" ${idx === timelineOrder.length - 1 ? "disabled" : ""}><iconify-icon icon="lucide:chevron-down"></iconify-icon></button>
      </div>`;
    el.tlList.appendChild(row);

    const img = row.querySelector("img");
    fetchImageFor(event.w).then(url => {
      if (!url) return;
      img.onload = () => img.classList.add("loaded");
      img.src = url;
    });

    row.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        if (timelineRevealed) return;
        Sound.click();
        const a = btn.dataset.action;
        const i = idx;
        if (a === "up" && i > 0) {
          [timelineOrder[i], timelineOrder[i-1]] = [timelineOrder[i-1], timelineOrder[i]];
          renderTimeline();
        } else if (a === "down" && i < timelineOrder.length - 1) {
          [timelineOrder[i], timelineOrder[i+1]] = [timelineOrder[i+1], timelineOrder[i]];
          renderTimeline();
        }
      });
    });
  });
}
function submitTimeline() {
  if (timelineRevealed) return;
  timelineRevealed = true;
  const sorted = [...timelineEvents].sort((a, b) => a.y - b.y);
  let correctCount = 0;
  timelineOrder.forEach((ev, i) => { if (sorted.indexOf(ev) === i) correctCount++; });
  // Score: +1 per correctly placed
  score += correctCount;
  if (score > best) { best = score; STORE.set(bestKey(mode), best); }
  updateScore();
  // Track each
  timelineEvents.forEach((ev, i) => trackAnswer(ev.c, sorted.indexOf(ev) === timelineOrder.indexOf(ev)));
  renderTimeline();
  if (correctCount === TIMELINE_LENGTH) {
    Sound.milestone(); confetti(40);
    stats.timelinePerfects = (stats.timelinePerfects||0) + 1;
    saveStats();
    checkAchievements();
  }
  else if (correctCount > 0) Sound.correct();
  else Sound.wrong();
  el.tlSubmit.style.display = "none";
  el.tlNext.classList.add("show");
  timelineRound++;
}
function nextTimelineRound() {
  // If pool exhausted, finish; else next
  if (timelineRound >= 10) { gameOver(false); return; }
  startTimelineRound();
}

// ---------- Compartir ----------
function buildShareText() {
  const m = MODES[mode];
  const catIcons = mode === "daily"
    ? Object.values(CATEGORIES).slice(0, 6).map(c => c.icon).join("")
    : Array.from(selectedCats).map(c => (CATEGORIES[c] && CATEGORIES[c].icon) || "").join("");
  let head;
  if (mode === "daily") head = `🟡 ANTES o DESPUÉS — Reto ${dailyDateKey()}: ${score}/${DAILY_LENGTH}`;
  else if (mode === "timeline") head = `📏 ANTES o DESPUÉS — Timeline: ${score} aciertos`;
  else head = `🟡 ANTES o DESPUÉS — ${score} seguidas (${m.label})`;
  const body = mode === "daily"
    ? squares(score, DAILY_LENGTH)
    : `${catIcons || "🎯"}`;
  const url = SHARE_URL || "";
  return `${head}\n${body}\n${url}`.trim();
}
function squares(correct, total) {
  let s = "";
  for (let i = 0; i < total; i++) s += i < correct ? "🟩" : "⬜";
  return s;
}
async function shareResult() {
  Sound.click();
  const text = buildShareText();
  let shared = false;
  if (navigator.share) {
    try { await navigator.share({ text }); shared = true; } catch (e) {}
  }
  if (!shared && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      el.btnShare.classList.add("copied");
      el.btnShare.textContent = "✓ COPIADO";
      setTimeout(() => {
        el.btnShare.classList.remove("copied");
        el.btnShare.innerHTML = "<iconify-icon icon=\"lucide:share-2\"></iconify-icon> COMPARTIR";
      }, 1800);
    } catch (e) {}
  }
}

// ---------- Stats screen ----------
function openStats() {
  el.statGames.textContent = stats.games;
  el.statAnswered.textContent = stats.answered;
  const acc = stats.answered ? Math.round(100 * stats.correct / stats.answered) : 0;
  el.statAccuracy.textContent = `${acc}%`;
  // Records by mode
  el.statRecords.innerHTML = "";
  ["classic", "express", "hard", "daily", "timeline", "year_exact", "decade"].forEach(m => {
    const r = stats.bestByMode[m] || 0;
    const ico = MODE_ICONS[m] || "lucide:circle";
    const row = document.createElement("div");
    row.className = "cat-row";
    row.innerHTML = `<div class="cat-name"><iconify-icon icon="${ico}" style="vertical-align:-2px;color:var(--gold);"></iconify-icon> ${MODES[m].label}</div><div class="cat-bar-wrap"><div class="cat-bar" style="width:${Math.min(100, r * 4)}%"></div></div><div class="cat-pct">${r}</div>`;
    el.statRecords.appendChild(row);
  });
  // Categories
  el.statCats.innerHTML = "";
  const cats = Object.entries(stats.byCat).sort((a, b) => b[1].t - a[1].t);
  if (!cats.length) {
    el.statCats.innerHTML = `<div style="color:var(--dim);font-size:12px;text-align:center;padding:8px;">Aún no hay datos</div>`;
  } else {
    cats.forEach(([catKey, st]) => {
      const cat = CATEGORIES[catKey];
      if (!cat) return;
      const ico = CAT_ICONS[catKey] || "lucide:tag";
      const pct = Math.round(100 * st.c / st.t);
      const row = document.createElement("div");
      row.className = "cat-row";
      row.innerHTML = `<div class="cat-name"><iconify-icon icon="${ico}" style="vertical-align:-2px;color:var(--gold);"></iconify-icon> ${cat.label}</div><div class="cat-bar-wrap"><div class="cat-bar" style="width:${pct}%"></div></div><div class="cat-pct">${pct}% (${st.c}/${st.t})</div>`;
      el.statCats.appendChild(row);
    });
  }
  renderAchievs();
  el.stats.classList.remove("hidden");
}
function closeStats() { el.stats.classList.add("hidden"); }

// ---------- Menú ----------
function renderCategoryChips() {
  el.catList.innerHTML = "";
  const counts = {};
  for (const e of EVENTS) counts[e.c] = (counts[e.c] || 0) + 1;
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    const n = counts[key] || 0;
    if (!n) continue;
    const ico = CAT_ICONS[key] || "lucide:tag";
    const chip = document.createElement("div");
    chip.className = "cat-chip" + (selectedCats.has(key) ? " active" : "");
    chip.dataset.cat = key;
    chip.innerHTML = `<iconify-icon class="ico" icon="${ico}"></iconify-icon><span>${cat.label}</span><span class="count">${n}</span>`;
    chip.addEventListener("click", () => {
      if (selectedCats.has(key)) selectedCats.delete(key);
      else selectedCats.add(key);
      chip.classList.toggle("active");
      persistCats();
      updatePoolCount();
    });
    el.catList.appendChild(chip);
  }
}
function updatePoolCount() {
  const n = buildPool().length;
  el.poolCount.textContent = n;
  let needs = 2;
  if (mode === "timeline") needs = TIMELINE_LENGTH;
  else if (mode === "year_exact" || mode === "decade") needs = 1;
  el.btnPlay.disabled = n < needs && mode !== "daily";
  if (mode === "daily") {
    el.btnPlay.textContent = "▸ JUGAR LIBRE";
  } else {
    el.btnPlay.textContent = n < needs ? `Elige al menos ${needs} categorías` : "▸ EMPEZAR";
  }
}
function persistCats() { STORE.set("ad_cats_v2", Array.from(selectedCats)); }
function setMode(m) {
  if (!MODES[m]) m = "classic";
  mode = m;
  document.querySelectorAll(".mode").forEach(n => n.classList.toggle("active", n.dataset.mode === m));
  if (m !== "daily" && m !== "multi") STORE.set("ad_mode", m);
  best = STORE.get(bestKey(mode), 0);
  el.best.textContent = best;
  updatePoolCount();
}
function showMenu() {
  stopTimer();
  el.menu.classList.remove("hidden");
  el.app.classList.add("hidden");
  el.gameOver.classList.add("hidden");
  el.stats.classList.add("hidden");
  best = STORE.get(bestKey(mode), 0);
  el.best.textContent = best;
  updatePoolCount();
  refreshDailyCardUI();
  refreshOnThisDay();
}
function startFromMenu() {
  if (mode !== "daily" && buildPool().length < 2) return;
  el.menu.classList.add("slide-out");
  setTimeout(() => {
    el.menu.classList.remove("slide-out");
    el.menu.classList.add("hidden");
    el.app.classList.remove("hidden");
    el.app.classList.add("slide-in");
    setTimeout(() => el.app.classList.remove("slide-in"), 450);
    newGame();
  }, 320);
}
function refreshDailyCardUI() {
  const r = dailyResult();
  const setIcon = (name) => {
    if (el.dayIcon.tagName.toLowerCase() === "iconify-icon") el.dayIcon.setAttribute("icon", name);
    else el.dayIcon.textContent = name;
  };
  if (r) {
    el.dailyCard.classList.add("done");
    setIcon("lucide:check-circle-2");
    el.daySub.textContent = `Hoy ${dailyDateKey()} — ${r.score}/${DAILY_LENGTH}. Vuelve mañana.`;
  } else {
    el.dailyCard.classList.remove("done");
    setIcon("lucide:sparkles");
    el.daySub.textContent = `Hoy ${dailyDateKey()} — 10 cartas iguales para todo el mundo`;
  }
  refreshStreakChip();
}
function refreshStreakChip() {
  if (!el.streakChip || !el.streakNum) return;
  if (streakState.count > 0 && isStreakAlive()) {
    el.streakChip.style.display = "";
    el.streakNum.textContent = streakState.count;
  } else {
    el.streakChip.style.display = "none";
  }
}

// ---------- Swipe (móvil) ----------
function setupSwipe() {
  let sx = 0, sy = 0, t0 = 0, tracking = false;
  const surface = el.cards;
  surface.addEventListener("touchstart", (e) => {
    if (locked || mode === "timeline") return;
    const t = e.touches[0];
    sx = t.clientX; sy = t.clientY; t0 = Date.now(); tracking = true;
    el.hintBefore.classList.remove("show");
    el.hintAfter.classList.remove("show");
  }, { passive: true });
  surface.addEventListener("touchmove", (e) => {
    if (!tracking) return;
    const t = e.touches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
      el.hintBefore.classList.toggle("show", dx < 0);
      el.hintAfter.classList.toggle("show", dx > 0);
    }
  }, { passive: true });
  surface.addEventListener("touchend", (e) => {
    if (!tracking) return;
    tracking = false;
    el.hintBefore.classList.remove("show");
    el.hintAfter.classList.remove("show");
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy, dt = Date.now() - t0;
    if (dt < 600 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      Sound.init();
      onGuess(dx < 0);
    }
  }, { passive: true });
}

// ---------- Setup UI por modo ----------
function setupModeUI() {
  el.cards.classList.remove("hidden");
  el.timeline.classList.add("hidden");
  el.actions.style.display = "";
  el.yearInput.classList.add("hidden");
  el.decadeInput.classList.add("hidden");
  el.lifelines.style.display = "";
  el.multiTurn.classList.remove("show");
  document.querySelector(".vs").style.display = "";
  el.cardTop.style.display = "";
  el.dailyBadge.classList.remove("show");

  if (mode === "year_exact" || mode === "decade") {
    el.cardTop.style.display = "none";
    document.querySelector(".vs").style.display = "none";
    el.actions.style.display = "none";
    el.lifelines.style.display = "none";
    if (mode === "year_exact") el.yearInput.classList.remove("hidden");
    else el.decadeInput.classList.remove("hidden");
  }
  if (mode === "multi") el.multiTurn.classList.add("show");
}

// ---------- Modo Año Exacto ----------
let yearRound = 0;
const YEAR_LENGTH = 10;
function newYearGame() {
  setupModeUI();
  pool = buildPool();
  if (pool.length < 1) { showMenu(); return; }
  queue = shuffle(pool);
  score = 0; combo = 0; yearRound = 0;
  answerLog = [];
  best = STORE.get(bestKey(mode), 0);
  updateScore();
  updateComboUI(false);
  el.gameOver.classList.add("hidden");
  locked = false;
  stopTimer();
  bottomEvent = queue.pop();
  renderCard(el.cardBottom, bottomEvent, false);
  questionStartMs = Date.now();
  el.yiField.value = "";
  el.yiFeedback.textContent = "";
  setTimeout(() => el.yiField.focus(), 200);
}
function onYearSubmit() {
  if (locked || !bottomEvent) return;
  const v = parseInt(el.yiField.value, 10);
  if (isNaN(v) || v < -3000 || v > 2030) { el.yiField.focus(); return; }
  locked = true;
  Sound.click();
  const dist = Math.abs(v - bottomEvent.y);
  let gain = 0, label, color;
  if (dist === 0)      { gain = 10; label = "🎯 ¡EXACTO! +10"; color = "var(--green)"; stats.exactYears = (stats.exactYears||0)+1; saveStats(); }
  else if (dist <= 2)  { gain = 5;  label = `±${dist} años · +5`; color = "var(--green)"; }
  else if (dist <= 5)  { gain = 3;  label = `±${dist} años · +3`; color = "var(--gold)"; }
  else if (dist <= 10) { gain = 1;  label = `±${dist} años · +1`; color = "var(--gold)"; }
  else                 { gain = 0;  label = `±${dist} años · 0`;   color = "var(--red)"; }
  score += gain;
  if (score > best) { best = score; STORE.set(bestKey(mode), best); }
  answerLog.push({ event: bottomEvent, isCorrect: gain >= 5, userAnswer: String(v), deltaMs: Date.now() - questionStartMs });
  trackAnswer(bottomEvent.c, gain >= 5);
  const yearEl = el.cardBottom.querySelector(".card-year");
  yearEl.classList.remove("hidden-q");
  animateYear(yearEl, bottomEvent.y, 550);
  yearEl.style.color = color;
  el.yiFeedback.textContent = label;
  el.yiFeedback.style.color = color;
  if (gain >= 5) Sound.correct(); else if (gain > 0) Sound.click(); else Sound.wrong();
  updateScore();
  setTimeout(() => {
    yearRound++;
    if (yearRound >= YEAR_LENGTH) { gameOver(false); return; }
    if (!queue.length) queue = shuffle(pool);
    bottomEvent = queue.pop();
    el.cardBottom.classList.add("slideIn");
    renderCard(el.cardBottom, bottomEvent, false);
    setTimeout(() => el.cardBottom.classList.remove("slideIn"), 550);
    el.yiField.value = "";
    el.yiFeedback.textContent = "";
    questionStartMs = Date.now();
    locked = false;
    setTimeout(() => el.yiField.focus(), 150);
  }, 1700);
}

// ---------- Modo Década ----------
let decadeRound = 0;
const DECADE_LENGTH = 10;
function newDecadeGame() {
  setupModeUI();
  pool = buildPool();
  if (pool.length < 1) { showMenu(); return; }
  queue = shuffle(pool);
  score = 0; combo = 0; decadeRound = 0;
  answerLog = [];
  best = STORE.get(bestKey(mode), 0);
  updateScore();
  updateComboUI(false);
  el.gameOver.classList.add("hidden");
  locked = false;
  stopTimer();
  bottomEvent = queue.pop();
  renderCard(el.cardBottom, bottomEvent, false);
  setupDecadeForEvent(bottomEvent);
  questionStartMs = Date.now();
}
function setupDecadeForEvent(event) {
  // Centra el rango: 5 décadas antes y 4 después del año del evento (10 total)
  const evDecade = Math.floor(event.y / 10) * 10;
  decadeRangeStart = evDecade - 50;
  renderDecadeButtons();
}
function renderDecadeButtons() {
  el.decGrid.innerHTML = "";
  for (let i = 0; i < 10; i++) {
    const decade = decadeRangeStart + i * 10;
    const btn = document.createElement("button");
    btn.className = "dec-btn";
    btn.textContent = decade < 0 ? `${Math.abs(decade)} a.C.` : `${decade}s`;
    btn.addEventListener("click", () => onDecadePick(decade));
    el.decGrid.appendChild(btn);
  }
  const end = decadeRangeStart + 90;
  el.decRangeLabel.textContent = `${decadeRangeStart < 0 ? Math.abs(decadeRangeStart) + " a.C." : decadeRangeStart + "s"} → ${end < 0 ? Math.abs(end) + " a.C." : end + "s"}`;
}
function onDecadePick(picked) {
  if (locked || !bottomEvent) return;
  locked = true;
  Sound.click();
  const evDecade = Math.floor(bottomEvent.y / 10) * 10;
  const diff = Math.abs(picked - evDecade);
  let gain = 0;
  if (diff === 0) gain = 5;
  else if (diff === 10) gain = 2;
  else if (diff === 20) gain = 1;
  score += gain;
  if (score > best) { best = score; STORE.set(bestKey(mode), best); }
  trackAnswer(bottomEvent.c, gain >= 2);
  answerLog.push({ event: bottomEvent, isCorrect: gain >= 2, userAnswer: `${picked}s`, deltaMs: Date.now() - questionStartMs });
  const yearEl = el.cardBottom.querySelector(".card-year");
  yearEl.classList.remove("hidden-q");
  animateYear(yearEl, bottomEvent.y, 550);
  yearEl.style.color = gain >= 5 ? "var(--green)" : gain > 0 ? "var(--gold)" : "var(--red)";
  if (gain >= 5) Sound.correct(); else if (gain > 0) Sound.click(); else Sound.wrong();
  updateScore();
  setTimeout(() => {
    decadeRound++;
    if (decadeRound >= DECADE_LENGTH) { gameOver(false); return; }
    if (!queue.length) queue = shuffle(pool);
    bottomEvent = queue.pop();
    el.cardBottom.classList.add("slideIn");
    renderCard(el.cardBottom, bottomEvent, false);
    setupDecadeForEvent(bottomEvent);
    setTimeout(() => el.cardBottom.classList.remove("slideIn"), 550);
    questionStartMs = Date.now();
    locked = false;
  }, 1500);
}

// ---------- Power-ups ----------
const POWERUPS = {
  // Positivos
  time:    { icon: "lucide:timer-reset",     name: "+Tiempo",       type: "positive", desc: "+10s o +2 pts" },
  double:  { icon: "lucide:gem",             name: "x2 puntos",     type: "positive", desc: "Doble en la próxima" },
  reveal:  { icon: "lucide:sparkles",        name: "Pista siglo",   type: "positive", desc: "Te dice el siglo" },
  life:    { icon: "lucide:heart",           name: "Vida extra",    type: "positive", desc: "Salva del próximo fallo" },
  reroll:  { icon: "lucide:dices",           name: "Cambia carta",  type: "positive", desc: "Sustituye la carta actual" },
  combo3:  { icon: "lucide:rocket",          name: "Combo +3",      type: "positive", desc: "Suma 3 al combo" },
  immune:  { icon: "lucide:clover",          name: "Inmune",        type: "positive", desc: "Próxima cuenta como acierto" },
  // Negativos (troll, auto-trigger)
  invert:  { icon: "lucide:bomb",            name: "Trampa!",        type: "negative", desc: "Botones cambiados" },
  fog:     { icon: "lucide:cloud-fog",       name: "Niebla!",        type: "negative", desc: "Título borroso" },
  blur:    { icon: "lucide:venetian-mask",   name: "Vista nublada!", type: "negative", desc: "Imagen borrosa" },
};
function maybeDropPowerup(comboNow) {
  if (mode === "timeline" || mode === "year_exact" || mode === "decade") return;
  if (Math.random() > 0.15) return;
  const types = Object.keys(POWERUPS);
  const type = types[Math.floor(Math.random() * types.length)];
  const pu = POWERUPS[type];
  if (pu.type === "negative") applyTroll(type);
  else spawnPowerupDrop(type);
}
function applyTroll(type) {
  const pu = POWERUPS[type];
  spawnTrollDrop(pu);
  if (type === "invert") pendingInvert = true;
  else if (type === "fog") pendingFog = true;
  else if (type === "blur") pendingBlur = true;
}
function spawnTrollDrop(pu) {
  const drop = document.createElement("iconify-icon");
  drop.className = "powerup-drop troll";
  drop.setAttribute("icon", pu.icon);
  drop.style.left = "50%";
  drop.style.top = "30%";
  document.body.appendChild(drop);
  const label = document.createElement("div");
  label.className = "troll-label";
  label.textContent = "¡" + pu.desc + "!";
  document.body.appendChild(label);
  Sound.wrong();
  setTimeout(() => { drop.remove(); label.remove(); }, 1800);
}
function spawnPowerupDrop(type) {
  const pu = POWERUPS[type];
  const drop = document.createElement("iconify-icon");
  drop.className = "powerup-drop";
  drop.setAttribute("icon", pu.icon);
  const r = el.powerups.getBoundingClientRect();
  drop.style.left = (r.right - 30) + "px";
  drop.style.top  = (r.top - 100) + "px";
  document.body.appendChild(drop);
  setTimeout(() => {
    drop.remove();
    activePowerups.push({ type });
    renderPowerups();
  }, 1400);
}
function renderPowerups() {
  el.powerups.innerHTML = "";
  activePowerups.forEach((pu, idx) => {
    const pdef = POWERUPS[pu.type];
    const b = document.createElement("button");
    b.className = "powerup";
    b.title = pdef.name + " — " + pdef.desc;
    b.innerHTML = `<iconify-icon icon="${pdef.icon}"></iconify-icon>`;
    b.addEventListener("click", () => usePowerup(idx));
    el.powerups.appendChild(b);
  });
}
function usePowerup(idx) {
  const pu = activePowerups[idx];
  if (!pu) return;
  const r = el.cardBottom.getBoundingClientRect();
  Sound.click();
  if (pu.type === "time") {
    if (mode === "express") {
      timeLeft = Math.min(120, timeLeft + 10);
      if (el.timer) el.timer.textContent = timeLeft;
      popText("⏱️ +10s", r.left + r.width/2, r.top + 20, "var(--gold)");
    } else {
      score += 2;
      updateScore();
      popText("⏱️ +2 pts", r.left + r.width/2, r.top + 20, "var(--gold)");
    }
  } else if (pu.type === "double") {
    pendingDoublePoints = true;
    popText("💎 x2 la próxima", r.left + r.width/2, r.top + 20, "var(--gold)");
  } else if (pu.type === "reveal") {
    if (bottomEvent) {
      const c = centuryHint(bottomEvent.y);
      const titleEl = el.cardBottom.querySelector(".card-title");
      const original = titleEl.textContent;
      titleEl.textContent = `${original}  ·  ${c}`;
      setTimeout(() => { if (titleEl.textContent.endsWith(c)) titleEl.textContent = original; }, 4000);
    }
  } else if (pu.type === "life") {
    pendingExtraLife = true;
    popText("❤️ +VIDA", r.left + r.width/2, r.top + 20, "var(--red)");
  } else if (pu.type === "reroll") {
    if (bottomEvent && !locked) {
      bottomEvent = pickNext(topEvent);
      renderCard(el.cardBottom, bottomEvent, false);
      el.cardBottom.classList.add("slideIn");
      setTimeout(() => el.cardBottom.classList.remove("slideIn"), 550);
      questionStartMs = Date.now();
      popText("🎲", r.left + r.width/2, r.top + 20, "var(--gold)");
    }
  } else if (pu.type === "combo3") {
    combo += 3;
    if ((stats.maxCombo||0) < combo) { stats.maxCombo = combo; saveStats(); checkAchievements(); }
    updateComboUI(true);
    popText("🚀 +3 COMBO", r.left + r.width/2, r.top + 20, "var(--gold)");
  } else if (pu.type === "immune") {
    pendingImmune = true;
    popText("🍀 INMUNE", r.left + r.width/2, r.top + 20, "var(--green)");
  }
  activePowerups.splice(idx, 1);
  renderPowerups();
  stats.powerupsUsed = (stats.powerupsUsed||0) + 1;
  saveStats();
  checkAchievements();
}

// ---------- Resumen post-partida (review) ----------
function openReview() {
  Sound.click();
  el.reviewList.innerHTML = "";
  if (!answerLog.length) {
    el.reviewList.innerHTML = `<div style="text-align:center;color:var(--dim);padding:20px;">No hay respuestas en esta partida</div>`;
  } else {
    answerLog.forEach(entry => {
      const cat = CATEGORIES[entry.event.c] || { icon: "❔", label: "?" };
      const icoName = CAT_ICONS[entry.event.c] || "lucide:tag";
      const row = document.createElement("div");
      row.className = "review-item " + (entry.isCorrect ? "right" : "wrong");
      row.innerHTML = `
        <div class="r-img"><iconify-icon icon="${icoName}" style="font-size:22px;color:var(--dim);"></iconify-icon></div>
        <div class="r-body">
          <div class="r-title">${entry.event.t}</div>
          <div class="r-meta"><iconify-icon icon="${icoName}" style="vertical-align:-2px;font-size:11px;"></iconify-icon> ${cat.label} · ${entry.isCorrect ? "✓" : "✗"} ${entry.userAnswer}</div>
        </div>
        <div class="r-year">${fmtYear(entry.event.y)}</div>`;
      el.reviewList.appendChild(row);
      const img = row.querySelector(".r-img");
      fetchImageFor(entry.event.w).then(url => {
        if (!url) return;
        img.innerHTML = `<img src="${url}" alt="">`;
      });
    });
  }
  el.review.classList.remove("hidden");
}

// ---------- Compartir imagen (PNG via canvas) ----------
async function shareImage() {
  Sound.click();
  const W = 1080, H = 1080;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  // Background gradient
  const g = ctx.createRadialGradient(W/2, H*.35, 100, W/2, H*.5, W);
  g.addColorStop(0, "#1a2240");
  g.addColorStop(1, "#0b1020");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // Title
  ctx.fillStyle = "#f4f1de";
  ctx.textAlign = "center";
  ctx.font = "900 64px -apple-system, Segoe UI, Helvetica, Arial";
  ctx.fillText("ANTES", W/2 - 110, 170);
  ctx.fillStyle = "#ffd166"; ctx.font = "italic 64px Georgia, serif"; ctx.fillText("o", W/2, 170);
  ctx.fillStyle = "#f4f1de"; ctx.font = "900 64px -apple-system, Segoe UI, Helvetica, Arial";
  ctx.fillText("DESPUÉS", W/2 + 130, 170);
  // Mode
  ctx.fillStyle = "#94a3c4"; ctx.font = "800 28px -apple-system";
  const m = MODES[mode];
  ctx.fillText("MODO " + m.label, W/2, 230);
  // Score huge
  ctx.fillStyle = "#ffd166";
  ctx.font = "900 360px -apple-system, Segoe UI, Helvetica, Arial";
  ctx.fillText(String(score), W/2, 600);
  // Sub
  ctx.fillStyle = "#f4f1de"; ctx.font = "700 36px -apple-system";
  const subText = mode === "daily" ? `${score}/${DAILY_LENGTH} ACIERTOS — ${dailyDateKey()}` :
                  mode === "timeline" ? `${score} BIEN COLOCADAS` :
                  mode === "year_exact" ? `${score} PUNTOS` :
                  mode === "decade"     ? `${score} PUNTOS` :
                  `${score} ${score === 1 ? "ACIERTO" : "ACIERTOS"}`;
  ctx.fillText(subText, W/2, 680);
  // Emoji squares (daily)
  if (mode === "daily") {
    ctx.font = "60px -apple-system";
    let row = "";
    for (let i = 0; i < DAILY_LENGTH; i++) row += i < score ? "🟩" : "⬜";
    ctx.fillText(row, W/2, 800);
  } else {
    // Category icons
    ctx.font = "70px -apple-system";
    const icons = Array.from(selectedCats).slice(0, 8).map(c => (CATEGORIES[c]?.icon)||"").join(" ");
    if (icons) ctx.fillText(icons, W/2, 800);
  }
  // URL footer
  ctx.fillStyle = "#94a3c4"; ctx.font = "500 24px -apple-system";
  ctx.fillText("¿a que aciertas más?", W/2, 1000);
  ctx.fillText(SHARE_URL.replace(/^https?:\/\//, ""), W/2, 1040);

  // Convert & share
  c.toBlob(async (blob) => {
    if (!blob) return;
    const file = new File([blob], "antes-o-despues.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: buildShareText() });
        stats.shared = true; saveStats(); checkAchievements();
        return; } catch (e) {}
    }
    // Download fallback
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "antes-o-despues.png";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    stats.shared = true; saveStats(); checkAchievements();
  }, "image/png");
}

// ---------- Multijugador local ----------
function openMultiSetup() {
  Sound.click();
  el.multiSetup.classList.remove("hidden");
  if (!multiPlayersList.length) {
    multiPlayersList = [{ name: "Jugador 1", lives: 3, score: 0 }, { name: "Jugador 2", lives: 3, score: 0 }];
  }
  renderMultiPlayers();
}
function renderMultiPlayers() {
  el.multiPlayers.innerHTML = "";
  multiPlayersList.forEach((p, idx) => {
    const row = document.createElement("div");
    row.className = "multi-player";
    row.innerHTML = `<input type="text" maxlength="14" placeholder="Nombre" value="${p.name}"><button title="Quitar"><iconify-icon icon="lucide:x"></iconify-icon></button>`;
    const input = row.querySelector("input");
    input.addEventListener("input", () => p.name = input.value);
    row.querySelector("button").addEventListener("click", () => {
      if (multiPlayersList.length <= 2) return;
      multiPlayersList.splice(idx, 1);
      renderMultiPlayers();
    });
    el.multiPlayers.appendChild(row);
  });
}
function newMultiGame() {
  el.multiSetup.classList.add("hidden");
  setupModeUI();
  multiPlayersList.forEach(p => { p.lives = 3; p.score = 0; });
  multiCurrentIdx = 0;
  pool = buildPool();
  if (pool.length < 2) { showMenu(); return; }
  queue = shuffle(pool);
  topEvent = queue.pop();
  bottomEvent = pickNext(topEvent);
  score = 0; combo = 0;
  answerLog = [];
  resetLifelines();
  updateScore();
  updateComboUI(false);
  renderCard(el.cardTop, topEvent, true);
  renderCard(el.cardBottom, bottomEvent, false);
  updateMultiTurn();
  el.gameOver.classList.add("hidden");
  locked = false;
  setButtons(true);
  stopTimer();
  questionStartMs = Date.now();
}
function updateMultiTurn() {
  if (mode !== "multi") return;
  const p = multiPlayersList[multiCurrentIdx];
  if (!p) return;
  const livesIcons = "❤️".repeat(Math.max(0, p.lives));
  el.multiTurn.innerHTML = `Turno: <b>${escapeHtml(p.name)}</b> <span class="mlives">${livesIcons}</span>`;
  // Update score for current player
  el.score.textContent = p.score;
}
function multiAdvance(wasCorrect) {
  const p = multiPlayersList[multiCurrentIdx];
  if (wasCorrect) p.score++;
  else p.lives--;
  // Find next alive
  let alive = multiPlayersList.filter(x => x.lives > 0);
  if (alive.length <= 1) {
    multiGameOver();
    return;
  }
  // next
  do { multiCurrentIdx = (multiCurrentIdx + 1) % multiPlayersList.length; } while (multiPlayersList[multiCurrentIdx].lives <= 0);
  updateMultiTurn();
}
function multiGameOver() {
  stopTimer();
  const winner = multiPlayersList.slice().sort((a, b) => (b.lives>0 ? 1 : 0) - (a.lives>0 ? 1 : 0) || b.score - a.score)[0];
  el.goTitle.innerHTML = "<iconify-icon icon=\"lucide:trophy\" style=\"color:var(--gold);vertical-align:-2px;\"></iconify-icon> GANA " + winner.name.toUpperCase();
  el.goSub.textContent = "Multijugador";
  el.goScore.textContent = winner.score;
  el.goBest.innerHTML = multiPlayersList.map(p => `${escapeHtml(p.name)}: ${p.score} (${p.lives>0?"vivo":"💀"})`).join(" · ");
  el.btnShare.classList.remove("copied"); el.btnShare.innerHTML = "<iconify-icon icon=\"lucide:share-2\"></iconify-icon> COMPARTIR";
  el.gameOver.classList.remove("hidden");
}
function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

// ---------- Logros UI en stats ----------
function renderAchievs() {
  el.achievsGrid.innerHTML = "";
  ACHIEVEMENTS.forEach(a => {
    const cell = document.createElement("div");
    cell.className = "achiev-cell" + (achievUnlocked.has(a.id) ? " unlocked" : "");
    cell.dataset.name = a.name;
    cell.dataset.desc = a.desc;
    cell.title = `${a.name} — ${a.desc}`;
    cell.textContent = a.icon;
    el.achievsGrid.appendChild(cell);
  });
  el.achievCount.textContent = `${achievUnlocked.size}/${ACHIEVEMENTS.length}`;
}

// ---------- Arranque ----------
// ---------- Efectos interactivos del fondo ----------
function initBackgroundFX() {
  // Constelación de puntos
  const stars = document.getElementById("bgStars");
  if (stars && !stars.children.length) {
    const N = window.innerWidth < 700 ? 28 : 50;
    for (let i = 0; i < N; i++) {
      const s = document.createElement("div");
      s.className = "bg-star";
      s.style.left = Math.random() * 100 + "%";
      s.style.top  = Math.random() * 100 + "%";
      s.style.animationDelay  = -Math.random() * 3 + "s";
      s.style.animationDuration = (2 + Math.random() * 4) + "s";
      stars.appendChild(s);
    }
  }
  // Spotlight ratón
  const spot = document.getElementById("spotlight");
  if (spot) {
    document.addEventListener("mousemove", (e) => {
      spot.style.setProperty("--mx", e.clientX + "px");
      spot.style.setProperty("--my", e.clientY + "px");
    }, { passive: true });
  }
}

// Tilt 3D en cartas según posición del ratón
function setupCardTilt() {
  const cards = [el.cardTop, el.cardBottom];
  cards.forEach(card => {
    if (!card) return;
    card.addEventListener("mousemove", (e) => {
      const r = card.getBoundingClientRect();
      const cx = (e.clientX - r.left) / r.width;
      const cy = (e.clientY - r.top)  / r.height;
      const ry = (cx - .5) * 8;   // -4° a 4°
      const rx = (.5 - cy) * 8;
      card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.01)`;
      card.style.transition = "transform .12s ease-out";
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
      card.style.transition = "transform .35s cubic-bezier(.2,.8,.2,1)";
    });
  });
}

// ---------- PWA ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

// ---------- Haptics ----------
function haptic(pattern) {
  if (navigator.vibrate) try { navigator.vibrate(pattern); } catch (e) {}
}

// ---------- Sonidos mejorados (acordes Web Audio) ----------
function playChord(freqs, dur, type = "triangle", vol = 0.13) {
  if (!Sound.ready) return;
  const ctx = Sound.ctx, now = ctx.currentTime;
  freqs.forEach((f, i) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
    const g = ctx.createGain(); g.gain.value = vol;
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(vol, now + i * 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.03 + dur);
    o.start(now + i * 0.03); o.stop(now + i * 0.03 + dur + 0.02);
  });
}
const _origCorrect = Sound.correct;
Sound.correct = function() { playChord([523, 659, 784], 0.18); };
const _origWrong = Sound.wrong;
Sound.wrong = function() { playChord([220, 174], 0.35, "sawtooth", 0.16); };

// ---------- Tutorial ----------
const TUT_KEY = "ad_tutorial_seen_v1";
let tutStep = 0;
function maybeShowTutorial() {
  if (STORE.get(TUT_KEY, false)) return;
  document.getElementById("tutorial").classList.remove("hidden");
  tutStep = 0;
  renderTutStep();
}
function renderTutStep() {
  document.querySelectorAll(".tut-step").forEach((n, i) => { n.hidden = i !== tutStep; });
  document.querySelectorAll(".tut-dot").forEach((d, i) => d.classList.toggle("active", i === tutStep));
  const last = tutStep === document.querySelectorAll(".tut-step").length - 1;
  document.getElementById("tutNext").textContent = last ? "¡EMPEZAR!" : "SIGUIENTE";
}
function tutNext() {
  const total = document.querySelectorAll(".tut-step").length;
  tutStep++;
  if (tutStep >= total) { tutClose(); return; }
  renderTutStep();
}
function tutClose() {
  STORE.set(TUT_KEY, true);
  document.getElementById("tutorial").classList.add("hidden");
}

// ---------- Efeméride "Hoy hace X años" ----------
function pickOnThisDay() {
  const today = new Date();
  const cy = today.getFullYear();
  // Deltas redondos interesantes
  const rounds = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 250, 500, 1000];
  const candidates = [];
  for (const e of EVENTS) {
    const delta = cy - e.y;
    if (rounds.includes(delta)) candidates.push({ ev: e, delta });
  }
  if (!candidates.length) return null;
  // Seed por fecha para ser consistente todo el día
  const seed = today.getFullYear() * 10000 + (today.getMonth()+1) * 100 + today.getDate();
  const rng = mulberry32(seed);
  return candidates[Math.floor(rng() * candidates.length)];
}
function refreshOnThisDay() {
  const otd = pickOnThisDay();
  const box = document.getElementById("onThisDay");
  if (!otd || !box) { if (box) box.classList.add("hidden"); return; }
  const txt = document.getElementById("otdText");
  txt.textContent = `Hace ${otd.delta} años: ${otd.ev.t}`;
  box.classList.remove("hidden");
}

// ---------- Partículas doradas (+1 burst) ----------
function spawnParticles(x, y, n = 14) {
  for (let i = 0; i < n; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    p.style.left = x + "px";
    p.style.top = y + "px";
    const angle = (Math.PI * 2 * i) / n + (Math.random() - .5) * 0.6;
    const dist = 50 + Math.random() * 50;
    p.style.setProperty("--px", Math.cos(angle) * dist + "px");
    p.style.setProperty("--py", Math.sin(angle) * dist + "px");
    p.style.animationDuration = (.6 + Math.random() * .5) + "s";
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1200);
  }
}

// ---------- Confetti con formas variadas ----------
const _origConfetti = window.confetti;
function fancyConfetti(count = 50) {
  const colors = ["#ffd166", "#06d6a0", "#ef476f", "#5b6cf5", "#f77f00", "#9b5de5", "#4cc9f0"];
  const shapes = ["", "star", "heart", "bolt"];
  for (let i = 0; i < count; i++) {
    const c = document.createElement("div");
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    c.className = "confetti" + (shape ? " " + shape : "");
    c.style.left = (Math.random() * 100) + "vw";
    c.style.top = "-20px";
    if (!shape) c.style.background = colors[Math.floor(Math.random() * colors.length)];
    c.style.animationDelay = (Math.random() * 0.5) + "s";
    c.style.animationDuration = (1.5 + Math.random() * 0.9) + "s";
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 2800);
  }
}
window.confetti = fancyConfetti;

// ---------- Card flip ----------
function flipCard(card) {
  card.classList.add("flipping");
  setTimeout(() => card.classList.remove("flipping"), 900);
}

// ---------- Modal grande de logro (para hitos importantes) ----------
const BIG_ACHIEVEMENTS = new Set([
  "combo_25", "combo_50", "daily_perfect", "streak_30", "all_cats", "answered_2000"
]);
function showAchievBig(a) {
  document.getElementById("abIco").textContent = a.icon;
  document.getElementById("abName").textContent = a.name;
  document.getElementById("abDesc").textContent = a.desc;
  document.getElementById("achievBig").classList.add("show");
  fancyConfetti(60);
  haptic([20, 60, 20, 60, 100]);
}
function closeAchievBig() { document.getElementById("achievBig").classList.remove("show"); }

// ---------- Accesibilidad ----------
const A11Y_KEY = "ad_a11y_v1";
const LARGE_KEY = "ad_large_v1";
function applyA11y(mode) {
  if (!mode || mode === "default") document.body.removeAttribute("data-a11y");
  else document.body.setAttribute("data-a11y", mode);
  STORE.set(A11Y_KEY, mode || "default");
}
function applyLargeText(on) {
  if (on) document.body.setAttribute("data-large", "1");
  else document.body.removeAttribute("data-large");
  STORE.set(LARGE_KEY, !!on);
}

// ---------- Atajos teclado overlay ----------
function showShortcuts() { document.getElementById("shortcuts").classList.remove("hidden"); }
function closeShortcuts() { document.getElementById("shortcuts").classList.add("hidden"); }

window.addEventListener("DOMContentLoaded", () => {
  initBackgroundFX();
  applyA11y(STORE.get(A11Y_KEY, "default"));
  applyLargeText(STORE.get(LARGE_KEY, false));
  // Tema persistido
  applyTheme(STORE.get(THEME_KEY, "default"));

  const savedMode = STORE.get("ad_mode", "classic");
  setMode(savedMode);

  const savedCats = STORE.get("ad_cats_v2", null);
  if (Array.isArray(savedCats) && savedCats.length) selectedCats = new Set(savedCats.filter(c => CATEGORIES[c]));
  else selectedCats = new Set(Object.keys(CATEGORIES));

  // Sincronizar streak en stats
  stats.dailyStreak = isStreakAlive() ? streakState.count : 0;
  saveStats();

  renderCategoryChips();
  updatePoolCount();
  refreshDailyCardUI();
  refreshStreakChip();

  // Menú
  el.modeList.querySelectorAll(".mode").forEach(n => {
    n.addEventListener("click", () => { Sound.init(); Sound.click(); setMode(n.dataset.mode); });
  });
  el.catAll.addEventListener("click", () => {
    Sound.init();
    selectedCats = new Set(Object.keys(CATEGORIES));
    persistCats(); renderCategoryChips(); updatePoolCount();
  });
  el.catNone.addEventListener("click", () => {
    Sound.init();
    selectedCats = new Set();
    persistCats(); renderCategoryChips(); updatePoolCount();
  });
  el.btnPlay.addEventListener("click", () => { Sound.init(); startFromMenu(); });
  el.dailyCard.addEventListener("click", () => {
    Sound.init();
    setMode("daily");
    el.menu.classList.add("hidden");
    el.app.classList.remove("hidden");
    newDailyGame();
  });
  el.btnOpenStats.addEventListener("click", () => { Sound.init(); openStats(); });

  // Juego
  el.btnBefore.addEventListener("click", () => { Sound.init(); onGuess(true); });
  el.btnAfter.addEventListener("click",  () => { Sound.init(); onGuess(false); });
  el.btnRestart.addEventListener("click", () => {
    Sound.init();
    el.gameOver.classList.add("hidden");
    if (mode === "daily" && dailyResult()) showMenu();
    else newGame();
  });
  el.btnBack.addEventListener("click", () => { Sound.init(); showMenu(); });
  el.btnMenu.addEventListener("click", () => { Sound.init(); showMenu(); });
  el.btnShare.addEventListener("click", () => shareResult());
  el.btnStats.addEventListener("click", () => { Sound.init(); openStats(); });
  el.closeStats.addEventListener("click", () => { Sound.init(); closeStats(); });

  // Lifelines
  el.btnSkip.addEventListener("click", () => { Sound.init(); useSkip(); });
  el.btnHint.addEventListener("click", () => { Sound.init(); useHint(); });

  // Timeline
  el.tlSubmit.addEventListener("click", () => { Sound.init(); submitTimeline(); });
  el.tlNext.addEventListener("click", () => { Sound.init(); nextTimelineRound(); });

  // Año exacto
  el.yiSubmit.addEventListener("click", () => { Sound.init(); onYearSubmit(); });
  el.yiField.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); Sound.init(); onYearSubmit(); }
  });

  // Década nav
  el.decPrev.addEventListener("click", () => { Sound.init(); decadeRangeStart -= 100; renderDecadeButtons(); });
  el.decNext.addEventListener("click", () => { Sound.init(); decadeRangeStart += 100; renderDecadeButtons(); });

  // Resumen
  el.btnReview.addEventListener("click", () => openReview());
  el.closeReview.addEventListener("click", () => { Sound.click(); el.review.classList.add("hidden"); });

  // Imagen compartible
  el.btnShareImg.addEventListener("click", () => shareImage());

  // Multijugador
  el.btnMulti.addEventListener("click", () => openMultiSetup());
  el.multiAdd.addEventListener("click", () => {
    if (multiPlayersList.length >= 6) return;
    multiPlayersList.push({ name: `Jugador ${multiPlayersList.length+1}`, lives: 3, score: 0 });
    renderMultiPlayers();
  });
  el.multiStart.addEventListener("click", () => {
    Sound.init();
    if (multiPlayersList.length < 2) return;
    setMode("multi");
    el.multiSetup.classList.add("hidden");
    el.menu.classList.add("hidden");
    el.app.classList.remove("hidden");
    newMultiGame();
  });
  el.multiCancel.addEventListener("click", () => { Sound.click(); el.multiSetup.classList.add("hidden"); });

  // Temas
  document.querySelectorAll(".theme-btn").forEach(b => {
    b.addEventListener("click", () => { Sound.click(); applyTheme(b.dataset.theme); });
  });

  // Teclado
  document.addEventListener("keydown", (e) => {
    if (!el.menu.classList.contains("hidden")) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startFromMenu(); }
      return;
    }
    if (!el.gameOver.classList.contains("hidden")) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault();
        el.gameOver.classList.add("hidden");
        if (mode === "daily" && dailyResult()) showMenu(); else newGame();
      }
      else if (e.key === "Escape") showMenu();
      return;
    }
    if (!el.stats.classList.contains("hidden")) {
      if (e.key === "Escape" || e.key === "Enter") closeStats();
      return;
    }
    if (e.key === "Escape") { showMenu(); return; }
    if (e.key === "?" || (e.shiftKey && e.key === "?")) { showShortcuts(); return; }
    if (locked) return;
    if (mode === "timeline" || mode === "year_exact" || mode === "decade") return;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "a" || e.key === "A") { Sound.init(); onGuess(true); }
    else if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "d" || e.key === "D") { Sound.init(); onGuess(false); }
    else if (e.key === "s" || e.key === "S") { Sound.init(); useSkip(); }
    else if (e.key === "h" || e.key === "H") { Sound.init(); useHint(); }
  });

  setupSwipe();
  setupCardTilt();

  // Tutorial
  document.getElementById("tutNext").addEventListener("click", tutNext);
  document.getElementById("tutSkip").addEventListener("click", tutClose);

  // Atajos teclado overlay
  document.getElementById("helpBtn").addEventListener("click", showShortcuts);
  document.getElementById("closeShortcuts").addEventListener("click", closeShortcuts);

  // Modal logro grande
  document.getElementById("abClose").addEventListener("click", closeAchievBig);

  // Accesibilidad
  document.querySelectorAll("#a11yButtons [data-a11y]").forEach(b => {
    b.addEventListener("click", () => {
      Sound.click();
      const v = b.dataset.a11y;
      applyA11y(v);
      document.querySelectorAll("#a11yButtons [data-a11y]").forEach(x => x.classList.toggle("active", x.dataset.a11y === v));
    });
  });
  document.getElementById("largeTextBtn").addEventListener("click", () => {
    Sound.click();
    const on = !document.body.hasAttribute("data-large");
    applyLargeText(on);
    document.getElementById("largeTextBtn").classList.toggle("active", on);
  });
  // Set inicial active basado en state
  const initA11y = STORE.get(A11Y_KEY, "default");
  document.querySelectorAll("#a11yButtons [data-a11y]").forEach(b => b.classList.toggle("active", b.dataset.a11y === initA11y));
  if (STORE.get(LARGE_KEY, false)) document.getElementById("largeTextBtn").classList.add("active");

  showMenu();
  refreshOnThisDay();
  setTimeout(maybeShowTutorial, 600);
});
