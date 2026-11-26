"use strict";
/* ---------- Настройки ---------- */
const SB = { url: "https://ftgkjtfzhylmbvuldcfe.supabase.co", key: "sb_publishable_RbyH44pJCkVDO0ljNDY40g_qwR9wnMW" };
const GOAL = 20;                 // заданий в день для огонька
const LESSON = 10;               // карточек в уроке
const BLITZ_SEC = 60;
const MIN = 60e3, DAY = 864e5;
const INTERVALS = [10 * MIN, DAY, 3 * DAY, 7 * DAY, 16 * DAY, 35 * DAY, 90 * DAY];

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const plural = (n, a, b, c) => { const m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k > 1 && k < 5 ? b : k === 1 ? a : c; };
const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

/* ---------- Хранилище ---------- */
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} }
};
const LS_KEY = "orfograf-v1";
const blank = () => ({ v: 1, total: 0, items: {}, days: {}, best: {}, lessons: {}, blitzBest: 0, log: [], medals: {}, medalAt: {}, pins: [], cnt: {}, flags: {}, rank: { d: {}, w: {}, m: {} }, perfectRun: 0, maxPerfectRun: 0 });
let state = blank();
try { const s = JSON.parse(ls.get(LS_KEY) || "null"); if (s && s.v === 1) state = Object.assign(blank(), s); } catch {}
const save = () => ls.set(LS_KEY, JSON.stringify(state));
const prefs = (() => { try { return JSON.parse(ls.get(LS_KEY + "-prefs") || "{}"); } catch { return {}; } })();
const savePrefs = () => ls.set(LS_KEY + "-prefs", JSON.stringify(prefs));

/* Игрок общий с «Формулографом»: оба приложения на одном адресе, ключ тот же */
const ME_KEY = "formulograf-v1-player";
const randHex = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(x => x.toString(16).padStart(2, "0")).join(""); };
const uuid = () => crypto.randomUUID ? crypto.randomUUID() : randHex(16).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-4$3-a$4-$5").slice(0, 36);
function readMe() { try { const m = JSON.parse(ls.get(ME_KEY) || "null"); if (m && m.id && m.secret) return m; } catch {} return null; }
let me = readMe();
if (!me) { me = { id: uuid(), secret: randHex(16), name: "" }; ls.set(ME_KEY, JSON.stringify(me)); }
const saveMe = () => { const cur = readMe(); ls.set(ME_KEY, JSON.stringify(Object.assign(cur && cur.id === me.id ? cur : {}, me))); };
/* те же статусы, что в «Формулографе» */
const AV_EMOJI = ["⚽️", "🥊", "☕️", "🍌", "🌈", "🍄‍🟫", "🐖", "🐓", "🐁", "🐺", "🦅", "🦄", "🙉", "🐷", "🖕", "💪", "🤙", "👌", "🤡", "💩", "😈", "☠️", "😵", "🥱", "🤤", "🤔", "🥶", "🥵", "🤬", "🤓", "🧌", "🏳️‍🌈", "🏴‍☠️", "🇺🇦", "🇷🇺"];
const myAv = () => {
  const ph = /^photo:[a-z0-9]{1,12}$/.test(me.avatar || "") ? me.avatar : "";
  const st = AV_EMOJI.includes(me.status) ? me.status : "";
  return st ? `${ph};${st}` : ph;
};

/* ---------- Задания ---------- */
const VOWELS = "аеёиоуыэюяАЕЁИОУЫЭЮЯ";
const ITEMS = new Map();          // key -> item
for (const t of TOPICS) {
  t.list = t.items.map(raw => {
    const [text, note = ""] = raw.split("#");
    const it = { key: t.id + "|" + text, topic: t, kind: t.kind, text, note };
    if (t.kind === "choice") {
      const m = text.match(/^(.*?)\[([^\]]+)\](.*)$/);
      it.pre = m[1]; it.opts = m[2].split("|"); it.post = m[3];
      it.short = it.opts.every(o => o.length <= 3);
      it.phrase = /\s/.test(text);
    } else if (t.kind === "stress") {
      it.idx = [...text].findIndex(ch => ch !== ch.toLowerCase());
      it.word = [...text.toLowerCase().replace(/ё/g, "е")];
      it.vowels = it.word.map((ch, i) => VOWELS.includes(ch) ? i : -1).filter(i => i >= 0);
    } else {
      const toks = text.split(" ");
      it.words = toks.map(w => w.replace(/,$/, ""));
      it.commas = new Set(toks.map((w, i) => w.endsWith(",") ? i : -1).filter(i => i >= 0));
    }
    ITEMS.set(it.key, it);
    return it;
  });
}
const itemState = it => state.items[it.key] || { b: 0, due: 0, n: 0, ok: 0, bad: 0 };
const isDue = it => { const s = state.items[it.key]; return !!s && s.n > 0 && s.due <= Date.now(); };
const dueAll = () => [...ITEMS.values()].filter(isDue);
const mastery = t => t.list.filter(it => itemState(it).b >= 2).length / t.list.length;
const correctText = it => it.kind === "choice" ? it.pre + it.opts[0] + it.post
  : it.kind === "stress" ? it.word.map((c, i) => i === it.idx ? c.toUpperCase() : c).join("")
  : it.words.map((w, i) => w + (it.commas.has(i) ? "," : "")).join(" ");

/* ---------- Очки, уровень, огонёк ----------
   За верный ответ — очки по сложности темы; +3 за карточку, пришедшую на повторение вовремя;
   комбо от 5 подряд — ×1,5. Бонус за урок: 10/10 — +20, 8–9 — +10. Блиц: +2 за верный, +10 за точность 90%+. */
const TOPIC_PTS = { stress: 5, dict: 5, zsyi: 5, prepri: 6, yo: 6, roots: 7, paro: 7, nn: 8, ne: 8, hyph: 8, commas: 12, suff: 7, verbend: 8, soft: 5, gram: 6, dash: 8 };
const REVIEW_BONUS = 3, BLITZ_PTS = 2;
const basePts = it => TOPIC_PTS[it.topic.id] || 6;
function answerPts(it, combo, wasDue) { const raw = basePts(it) + (wasDue ? REVIEW_BONUS : 0); return combo >= 5 ? Math.round(raw * 1.5) : raw; }
function addBonus(pts) { const k = dayKey(), d = state.days[k] || (state.days[k] = { n: 0, ok: 0, pts: 0 }); d.pts += pts; state.total += pts; }
const today = () => state.days[dayKey()] || { n: 0, ok: 0, pts: 0 };
function addDay(ok, pts) {
  const k = dayKey(), d = state.days[k] || (state.days[k] = { n: 0, ok: 0, pts: 0 });
  d.n++; if (ok) d.ok++; d.pts += pts; state.total += pts;
}
function streak() {
  let s = 0, i = (state.days[dayKey()]?.n || 0) >= GOAL ? 0 : 1;
  for (; ; i++) { const d = state.days[dayKey(daysAgo(i))]; if (d && d.n >= GOAL) s++; else break; }
  return s;
}
function lvl(total = state.total) { let L = 1, need = 100; while (total >= need) { total -= need; L++; need = 100 + 50 * (L - 1); } return { L, cur: total, need }; }
function record(it, ok, combo) {
  const wasDue = isDue(it);
  const s = state.items[it.key] || (state.items[it.key] = { b: 0, due: 0, n: 0, ok: 0, bad: 0 });
  s.n++;
  if (ok) { s.ok++; s.b = Math.min(s.b + 1, INTERVALS.length - 1); s.due = Date.now() + INTERVALS[s.b]; }
  else { s.bad++; s.b = 0; s.due = Date.now() + INTERVALS[0]; }
  const pts = ok ? answerPts(it, combo, wasDue) : 0;
  if (ok && /[ёЁ]/.test(it.kind === "stress" ? it.text : correctText(it))) { state.cnt = state.cnt || {}; state.cnt.yo = (state.cnt.yo || 0) + 1; }
  (state.log || (state.log = [])).push({ k: it.key, ok, t: Date.now() }); if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
  addDay(ok, pts); save();
  return pts;
}

/* ---------- UI: общие ---------- */
let tab = ["learn", "review", "friends", "stats", "profile"].includes(prefs.tab) ? prefs.tab : "learn";
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.tm); toast.tm = setTimeout(() => t.hidden = true, 2600); }
function openSheet(html, onMount) {
  $("#sheet").innerHTML = `<div class="grab"></div>` + html; $("#shade").hidden = false;
  if (onMount) onMount($("#sheet"));
}
function closeSheet() { $("#shade").hidden = true; }
$("#shade").addEventListener("click", e => { if (e.target.id === "shade") closeSheet(); });
const FLAME = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 3 3 3-1-3-1-6 0-8z"/></svg>`;
const COLORS = ["#2F45E0", "#E0567F", "#F26A1B", "#16A66B", "#8B5CFF", "#14A3B8", "#C8502D", "#B8900A", "#4A5568", "#7A5AC8"];
const nameColor = n => { let h = 0; for (const ch of String(n)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return COLORS[h % COLORS.length]; };
const photos = new Map();
const validPhoto = x => typeof x === "string" && x.length <= 40000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(x);
if (/^photo:/.test(me.avatar || "") && validPhoto(me.photo)) photos.set(me.id, me.photo);
function avaHTML(id, name, av, cls = "", frameId) {
  const img = /^photo:/.test(String(av || "")) && photos.get(id);
  const letter = (String(name || "?").trim()[0] || "?").toUpperCase();
  const inner = img ? `<span class="ava ${cls}"><img src="${esc(img)}" alt=""></span>` : `<span class="ava ${cls}" style="background:${nameColor(name || "?")}">${esc(letter)}</span>`;
  const fr = frameId !== undefined ? frameId : (typeof frameOf === "function" ? frameOf(id) : "none");
  return fr && fr !== "none" ? `<span class="avw fr ${cls}">${inner}${frameSVG(fr)}</span>` : inner;
}
const statusOf = av => { const s = String(av || "").split(";")[1] || ""; return AV_EMOJI.includes(s) ? `<span class="stemo">${s}</span>` : ""; };
async function loadPhotos(rows) {
  const need = [...new Set(rows.filter(r => /^photo:/.test(r.avatar || "") && !photos.has(r.player_id)).map(r => r.player_id))].filter(id => /^[0-9a-f-]{36}$/.test(id));
  if (!need.length) return false;
  try {
    const res = await api(`avatars?select=player_id,img&player_id=in.(${need.join(",")})`);
    for (const r of res || []) if (/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(r.img || "")) photos.set(r.player_id, r.img);
  } catch {}
  need.forEach(id => photos.has(id) || photos.set(id, null));
  return true;
}

function render() {
  document.querySelectorAll("#tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === tab));
  const n = dueAll().length, dot = $("#dueDot"); dot.hidden = !n; dot.textContent = n > 99 ? "99+" : n;
  ({ learn: renderLearn, review: renderReview, friends: renderFriends, stats: renderStats, profile: renderProfile })[tab]();
}
$("#tabs").addEventListener("click", e => {
  const b = e.target.closest("button[data-tab]"); if (!b) return;
  tab = b.dataset.tab; prefs.tab = tab; savePrefs(); $("#view").scrollTop = 0; render();
  if (tab === "friends") loadBoard();
});

function headerHTML(stick) {
  const st = streak(), lv = lvl();
  return `<div class="hrow ${stick ? "stick" : ""}">
    <span class="chip f ${st ? "" : "off"}" title="Огонёк: дней подряд с целью дня">${FLAME}${st}</span>
    <span class="chip g" title="Знаки — очки за ответы">★ ${fmt(state.total)}</span>
    <span class="chip" title="Уровень">ур. ${lv.L}</span>
    ${avaHTML(me.id, me.name || "Ты", myAv())}
  </div>`;
}
function ring(v, size = 48, stroke = 6, col = "#FFD84D", bg = "rgba(255,255,255,.25)") {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${bg}" stroke-width="${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(c * Math.min(v, 1)).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
}

/* ---------- Учиться: карта тем ---------- */
const LOOK = {
  stress: ["#2F45E0", "А́"], dict: ["#8B5CFF", "Аб"], prepri: ["#E0567F", "пре"], zsyi: ["#F26A1B", "з/с"],
  roots: ["#16A66B", "кос"], yo: ["#14A3B8", "ё"], nn: ["#C8502D", "нн"], ne: ["#7A5AC8", "не"],
  hyph: ["#2E8B83", "по‑"], paro: ["#C99A06", "≈"], commas: ["#FF5A4E", ","],
  suff: ["#D94F8A", "чик"], verbend: ["#1B8F7A", "ишь"], soft: ["#6A6F8C", "ъ"], gram: ["#3E7CB1", "их"], dash: ["#C67A00", "—"]
};
const look = t => LOOK[t.id] || ["#2F45E0", t.name[0]];
function renderLearn() {
  const d = today(), left = Math.max(0, GOAL - d.n);
  const cur = TOPICS.findIndex(t => mastery(t) < .8);
  const STEP = 132, TOP = 64, H = TOPICS.length * STEP + 110;
  const total = TOPICS.reduce((a, t) => a + t.list.length, 0);
  const avg = Math.round(TOPICS.reduce((a, t) => a + mastery(t), 0) / TOPICS.length * 100);
  const nodes = TOPICS.map((t, i) => {
    const m = mastery(t), done = m >= .8, [col, g] = look(t), side = i % 2 ? "rgt" : "lft", due = t.list.filter(isDue).length;
    const C = 2 * Math.PI * 44;
    return `<div class="node ${side} ${i === cur ? "cur" : ""} ${done ? "done" : ""}" style="top:${i * STEP + TOP}px;--tc:${col}">
      <button class="c" data-topic="${i}" aria-label="${esc(t.name)}">
        <svg class="rg" viewBox="0 0 96 96"><circle cx="48" cy="48" r="44" class="tr"/><circle cx="48" cy="48" r="44" class="pr" stroke-dasharray="${(C * m).toFixed(1)} ${C.toFixed(1)}"/></svg>
        <span class="g" style="font-size:${g.length > 2 ? 21 : g.length > 1 ? 26 : 34}px">${esc(g)}</span>
        ${done ? `<span class="ok">✓</span>` : due ? `<span class="due">${due}</span>` : ""}
        ${i === cur ? `<span class="go">${state.lessons[t.id] ? "Продолжить" : "Начать"}</span>` : ""}
      </button>
      <button class="lab" data-topic="${i}"><b>${esc(t.name)}</b><span>${esc(t.ege)} · ${t.list.length} ${plural(t.list.length, "задание", "задания", "заданий")} · <b class="tp">★${basePts(t.list[0])}</b></span><i class="mb"><s style="width:${Math.max(m * 100, m ? 4 : 0)}%"></s></i><em>${Math.round(m * 100)}% выучено</em></button></div>`;
  }).join("");
  $("#view").innerHTML = headerHTML(true) + `
    <div class="goal">${ring(d.n / GOAL)}<div><b>Цель дня ${Math.min(d.n, GOAL)} / ${GOAL}</b><small>${left ? `Ещё ${left} ${plural(left, "задание", "задания", "заданий")} — и огонёк горит` : "Цель выполнена, огонёк горит!"}</small></div></div>
    ${examCardHTML()}
    <div class="route"><div><h1>Маршрут</h1><span class="muted">${TOPICS.length} тем · ${total} заданий · все открыты</span></div><span class="avg">${avg}%</span></div>
    <button class="thbtn" id="thAll"><span>📖</span><span class="tx"><b>Теория</b><small>правила, таблицы, исключения по всем темам</small></span><i>›</i></button>
    <div class="map" id="map" style="height:${H}px"><svg class="deco" id="deco" aria-hidden="true"></svg><svg class="path" id="mapPath"></svg>${nodes}
      <div class="finish" style="top:${H - 44}px">🏁 Финиш — ЕГЭ</div></div>`;
  const map = $("#map"), W = map.clientWidth;
  const xs = i => (i % 2 ? .76 : .24) * W;
  const pts = TOPICS.map((_, i) => [xs(i), i * STEP + TOP + 42]);
  let p = `M${pts[0][0]},${pts[0][1]}`, done = "";
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], seg = ` C${a[0]},${a[1] + STEP * .55} ${b[0]},${b[1] - STEP * .55} ${b[0]},${b[1]}`;
    p += seg;
    if (mastery(TOPICS[i - 1]) >= .8) done += `<path d="M${a[0]},${a[1]}${seg}" class="pd" stroke="${look(TOPICS[i - 1])[0]}"/>`;
  }
  const gaps = [TOP - 26, ...TOPICS.map((_, i) => i * STEP + TOP + 96 + 18)];
  const deco = $("#deco"); deco.setAttribute("viewBox", `0 0 ${W} ${H}`);
  deco.innerHTML = decorDefs() + decorSVG(skinNow(), W, H, gaps);
  $("#mapPath").setAttribute("viewBox", `0 0 ${W} ${H}`);
  $("#mapPath").innerHTML = `<path d="${p}" class="pb"/><path d="${p}" class="pw"/>${done}`;
  $("#thAll").onclick = theoryListSheet;
  bindExamCard();
  map.onclick = e => { const b = e.target.closest("[data-topic]"); if (b) topicSheet(+b.dataset.topic); };
}
function topicSheet(i) {
  const t = TOPICS[i], m = mastery(t), due = t.list.filter(isDue).length, [col, g] = look(t);
  const seen = t.list.filter(it => itemState(it).n > 0).length;
  openSheet(`<div class="tsh"><span class="tg" style="background:${col}">${esc(g)}</span><div><h2>${esc(t.name)}</h2><div class="muted">${esc(t.ege)} · ${t.list.length} ${plural(t.list.length, "задание", "задания", "заданий")}</div></div></div>
    <div class="bar"><s style="width:${Math.round(m * 100)}%;background:${col}"></s></div>
    <div class="ptsinfo">★ ${basePts(t.list[0])} зн. за верный ответ · +${REVIEW_BONUS} за повторение вовремя</div>
    <div class="muted" style="font-size:13px">Выучено ${Math.round(m * 100)}% · видел ${seen} из ${t.list.length}${due ? ` · ${due} ждут повторения` : ""}${state.best[t.id] ? ` · лучший урок ${state.best[t.id]}/${LESSON}` : ""}</div>
    <div class="btns"><button class="btn" id="goLesson" style="background:${col};box-shadow:0 4px 0 color-mix(in srgb,${col} 60%,#000)">${state.lessons[t.id] ? "Продолжить" : "Начать урок"}</button><button class="btn gh" id="goRule">Теория</button></div>`, s => {
    s.querySelector("#goLesson").addEventListener("click", () => { closeSheet(); startLesson(t); });
    s.querySelector("#goRule").addEventListener("click", () => theorySheet(t));
  });
}
function ruleSheet(t) { openSheet(`<h2>${esc(t.name)}</h2><div class="muted">${esc(t.ege)}</div><div class="rule">${t.rule}</div><div class="btns"><button class="btn gh" id="cl">Понятно</button></div>`, s => s.querySelector("#cl").onclick = closeSheet); }

/* ---------- Время в приложении ----------
   Считаем только активное время: экран открыт и было касание или нажатие за последние 90 секунд. */
let lastAct = Date.now(), lastTick = Date.now(), unsavedSec = 0;
["pointerdown", "keydown", "touchstart", "scroll"].forEach(ev => document.addEventListener(ev, () => { lastAct = Date.now(); }, { passive: true, capture: true }));
setInterval(() => {
  const now = Date.now(), dt = Math.min(now - lastTick, 15000); lastTick = now;
  if (document.visibilityState !== "visible" || now - lastAct > 90000) return;
  const k = dayKey(), d = state.days[k] || (state.days[k] = { n: 0, ok: 0, pts: 0 });
  d.sec = (d.sec || 0) + dt / 1000; unsavedSec += dt / 1000;
  if (unsavedSec >= 30) { unsavedSec = 0; save(); }
}, 5000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") { save(); if (backupDirty) backupMaybe(true).catch(() => {}); } else lastTick = Date.now(); });
const secToday = () => Math.round(today().sec || 0);
const secTotal = () => Math.round(Object.values(state.days).reduce((a, d) => a + (d.sec || 0), 0));
const secWeek = () => { let t = 0; for (let i = 0; i < 7; i++) t += state.days[dayKey(daysAgo(i))]?.sec || 0; return Math.round(t); };
function fmtDur(sec) {
  const m = Math.floor((sec || 0) / 60), h = Math.floor(m / 60), mm = m % 60;
  if (h === 0) return `${m} мин`;
  return mm ? `${h} ч ${mm} мин` : `${h} ч`;
}

/* ---------- Отсчёт до ЕГЭ и план на сегодня ---------- */
const EXAM_DEFAULT = "2027-06-04"; // проект расписания ЕГЭ-2027: русский язык — 4 июня
const PLAN_LESSONS = 2;
function examDate() { return /^\d{4}-\d{2}-\d{2}$/.test(prefs.examDate || "") ? prefs.examDate : EXAM_DEFAULT; }
function daysToExam() { const e = new Date(examDate() + "T09:00"), t = new Date(dayKey() + "T09:00"); return Math.round((e - t) / DAY); }
function weakestTopic() {
  // сначала начатые, но слабо выученные; если всё ровно — первая непройденная
  const sc = TOPICS.map(t => ({ t, m: mastery(t), seen: t.list.some(it => itemState(it).n > 0) }));
  const started = sc.filter(x => x.seen && x.m < .8).sort((a, b) => a.m - b.m);
  if (started.length) return started[0].t;
  const fresh = sc.find(x => !x.seen); return (fresh || sc.sort((a, b) => a.m - b.m)[0]).t;
}
function examCardHTML() {
  const left = daysToExam(), d = today(), due = dueAll().length, wt = weakestTopic();
  const learned = Object.values(state.items).filter(s => s.b >= 2).length, rest = Math.max(0, ITEMS.size - learned);
  const date = new Date(examDate() + "T12:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  if (left < 0) return `<div class="exam"><div class="ex-top"><div><b>ЕГЭ по русскому прошёл</b><small>${date}</small></div><button class="ex-ch" id="exDate">изменить дату</button></div></div>`;
  const pace = left > 0 ? Math.ceil(rest / left) : rest;
  const les = d.les || 0;
  const items = [
    [due === 0, due ? `Повторить ${due} ${plural(due, "карточку", "карточки", "карточек")}` : (Object.values(state.items).some(x => x.n) ? "Повторения на сегодня сделаны" : "Повторять сегодня нечего"), due ? "rev" : ""],
    [les >= PLAN_LESSONS, `${PLAN_LESSONS} ${plural(PLAN_LESSONS, "урок", "урока", "уроков")} по слабой теме «${esc(wt.name)}» · ${Math.min(les, PLAN_LESSONS)}/${PLAN_LESSONS}`, les >= PLAN_LESSONS ? "" : "les"],
    [d.n >= GOAL, `Цель дня: ${Math.min(d.n, GOAL)}/${GOAL} заданий`, d.n >= GOAL ? "" : "les"]
  ];
  const done = items.filter(x => x[0]).length;
  return `<div class="exam">
    <div class="ex-top"><div class="ex-days"><b>${left}</b><span>${plural(left, "день", "дня", "дней")}</span></div>
      <div class="ex-t"><b>${left === 0 ? "ЕГЭ по русскому сегодня!" : "до ЕГЭ по русскому"}</b><small>${date} · <button class="ex-ch" id="exDate">изменить</button></small>
      <small>${rest ? `Учи ~${pace} ${plural(pace, "новое задание", "новых задания", "новых заданий")} в день — и к экзамену выучишь всё` : "Всё выучено — теперь только повторять!"}</small></div></div>
    <div class="ex-h">План на сегодня · ${done}/3</div>
    ${items.map(([ok, txt, act]) => `<button class="ex-it ${ok ? "ok" : ""}" ${act && !ok ? `data-plan="${act}"` : "disabled"}><i>${ok ? "✓" : ""}</i><span>${txt}</span>${act && !ok ? "<em>›</em>" : ""}</button>`).join("")}
  </div>`;
}
function bindExamCard() {
  const ch = $("#exDate"); if (ch) ch.onclick = () => openSheet(`<h2>Дата экзамена</h2><p class="muted" style="margin:4px 0 10px">По проекту расписания ЕГЭ-2027 русский язык — 4 июня. Если у тебя другая дата (досрочный период, резервный день), поставь её здесь.</p>
    <input type="date" id="exIn" value="${examDate()}" style="width:100%;border:1px solid var(--line);border-radius:14px;padding:12px;font:16px var(--fb);background:var(--sunk);color:var(--ink)">
    <div class="btns"><button class="btn" id="exSave">Сохранить</button><button class="btn gh" id="exReset">Вернуть 4 июня 2027</button></div>`, s => {
    s.querySelector("#exSave").onclick = () => { const v = s.querySelector("#exIn").value; if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { prefs.examDate = v; savePrefs(); } closeSheet(); render(); };
    s.querySelector("#exReset").onclick = () => { delete prefs.examDate; savePrefs(); closeSheet(); render(); };
  });
  document.querySelectorAll("[data-plan]").forEach(b => b.onclick = () => b.dataset.plan === "rev" ? startReview() : startLesson(weakestTopic()));
}

/* ---------- Урок ---------- */
let L = null;
function pickLesson(t) {
  const now = Date.now(), list = t.list;
  const due = shuffle(list.filter(isDue));
  const fresh = list.filter(it => itemState(it).n === 0);
  const rest = shuffle(list.filter(it => itemState(it).n > 0 && !isDue(it))).sort((a, b) => itemState(a).b - itemState(b).b);
  const out = [...due.slice(0, 4), ...fresh.slice(0, LESSON), ...due.slice(4), ...rest];
  return shuffle([...new Set(out)].slice(0, LESSON));
}
function startLesson(t) { L = { title: t.name, topic: t, items: pickLesson(t), i: 0, res: [], combo: 0, pts: 0, lv0: lvl().L, st0: streak() }; showOv(); drawQ(); }
function startReview() {
  let items = shuffle(dueAll()).slice(0, 15);
  if (!items.length) items = [...ITEMS.values()].filter(it => itemState(it).bad > 0).sort((a, b) => (itemState(b).bad - itemState(b).ok) - (itemState(a).bad - itemState(a).ok)).slice(0, LESSON);
  if (!items.length) { toast("Пока нечего повторять: пройди пару уроков"); return; }
  L = { title: "Повторение", topic: null, items: shuffle(items), i: 0, res: [], combo: 0, pts: 0, lv0: lvl().L, st0: streak() }; showOv(); drawQ();
}
function showOv() { $("#ov").hidden = false; }
function hideOv() { $("#ov").hidden = true; $("#ovIn").innerHTML = ""; L = null; B = null; render(); }
function segHTML() {
  return `<div class="seg" style="grid-template-columns:repeat(${L.items.length},1fr)">${L.items.map((_, i) => `<i class="${i < L.res.length ? (L.res[i] ? "o" : "b") : i === L.i ? "n" : ""}"></i>`).join("")}</div>`;
}
function topHTML() { return `<div class="qtop"><button class="x" id="qx" aria-label="Закрыть">✕</button>${segHTML()}<span class="chip f ${L.combo ? "" : "off"}">×${L.combo}</span></div>`; }
function drawQ() {
  const it = L.items[L.i], box = $("#ovIn");
  L.ans = null; L.sel = new Set();
  let card = "", below = "";
  if (it.kind === "choice") {
    L.opts = [...it.opts].sort((a, b) => a.localeCompare(b, "ru"));
    card = !it.pre.trim() && !it.post.trim() && !it.short ? `<div class="w phrase">Как правильно?</div><div class="h">Выбери верный вариант ниже</div>` : `<div class="w ${it.phrase ? "phrase" : ""}">${esc(it.pre)}<span class="q">${it.short ? "?" : "…"}</span>${esc(it.post)}</div><div class="h">${it.short ? (it.opts.some(o => o.length > 1) ? "Что пропущено?" : "Какая буква пропущена?") : "Как пишется?"}</div>`;
    below = `<div class="kbd" style="grid-template-columns:${it.short ? `repeat(${L.opts.length},1fr)` : "1fr"}">${L.opts.map((o, k) => `<button class="key ${it.short ? "" : "word"}" data-o="${k}">${esc(o)}</button>`).join("")}</div>`;
  } else if (it.kind === "stress") {
    card = `<div class="vw">${it.word.map((c, i) => it.vowels.includes(i) ? `<button class="v" data-v="${i}">${esc(c)}</button>` : `<span>${esc(c)}</span>`).join("")}</div><div class="h">Нажми на ударную гласную</div>`;
  } else {
    card = `<div class="sent">${it.words.map((w, i) => esc(w) + (i < it.words.length - 1 ? `<button class="gp" data-g="${i}" aria-label="Запятая после «${esc(w)}»"></button> ` : "")).join("")}</div><div class="h">Нажимай на промежутки, где нужна запятая</div>`;
    below = `<div class="kbd"><button class="btn" id="chk">Проверить</button></div>`;
  }
  box.innerHTML = topHTML() + `<div class="big" id="card"><span class="lbl">${esc(it.topic.name)}</span><button class="rl" id="rl">Теория</button>${card}</div>${below}<div id="after"></div>`;
  box.querySelector("#qx").onclick = () => quitLesson();
  box.querySelector("#rl").onclick = () => theorySheet(it.topic, true);
  box.querySelectorAll("[data-o]").forEach(b => b.onclick = () => answer(L.opts[+b.dataset.o] === it.opts[0], b));
  box.querySelectorAll("[data-v]").forEach(b => b.onclick = () => answer(+b.dataset.v === it.idx, b));
  box.querySelectorAll("[data-g]").forEach(b => b.onclick = () => { if (L.ans !== null) return; const g = +b.dataset.g; L.sel.has(g) ? L.sel.delete(g) : L.sel.add(g); b.classList.toggle("on"); });
  const chk = box.querySelector("#chk");
  if (chk) chk.onclick = () => answer(L.sel.size === it.commas.size && [...L.sel].every(g => it.commas.has(g)), null);
}
function quitLesson() {
  if (!L || !L.res.length) return hideOv();
  openSheet(`<h2>Выйти из урока?</h2><p class="muted">Ответы уже засчитаны, но урок не будет пройден.</p><div class="btns"><button class="btn" id="stay">Продолжить урок</button><button class="btn gh" id="leave">Выйти</button></div>`, s => {
    s.querySelector("#stay").onclick = closeSheet;
    s.querySelector("#leave").onclick = () => { closeSheet(); syncSoon(); hideOv(); };
  });
}
function answer(ok, btn) {
  if (L.ans !== null) return;
  const it = L.items[L.i];
  L.ans = ok; L.combo = ok ? L.combo + 1 : 0;
  const wasDue = isDue(it);
  const pts = record(it, ok, L.combo); L.pts += pts; L.res.push(ok);
  const box = $("#ovIn");
  // подсветка выбранного и правильного
  if (it.kind === "choice") box.querySelectorAll("[data-o]").forEach(b => { if (L.opts[+b.dataset.o] === it.opts[0]) b.classList.add("ok"); else if (b === btn) b.classList.add("bad"); b.disabled = true; });
  if (it.kind === "stress") box.querySelectorAll("[data-v]").forEach(b => { if (+b.dataset.v === it.idx) b.classList.add("ok"); else if (b === btn) b.classList.add("bad"); b.disabled = true; });
  if (it.kind === "commas") {
    box.querySelectorAll("[data-g]").forEach(b => { const g = +b.dataset.g, need = it.commas.has(g), has = L.sel.has(g); b.className = "gp " + (need && has ? "good" : need ? "miss" : has ? "extra" : ""); b.disabled = true; });
    box.querySelector("#chk").parentElement.remove();
  }
  if (!ok) { const c = box.querySelector("#card"); c.classList.add("shake"); }
  box.querySelector(".qtop").outerHTML = topHTML();
  box.querySelector("#qx").onclick = () => quitLesson();
  const ansHTML = it.kind === "choice" ? `${esc(it.pre)}<b>${esc(it.opts[0])}</b>${esc(it.post)}` : esc(correctText(it));
  const last = L.i === L.items.length - 1;
  $("#after").innerHTML = `<div class="sheetA ${ok ? "" : "bad"}">
    <div class="t">${ok ? "✓ Верно!" : "✕ Почти!"}<span>${ok ? `+${pts} зн.${wasDue ? " · повтор" : ""}${L.combo >= 5 ? " · ×1,5" : ""}` : "+0 зн."}</span></div>
    ${ok && !it.note ? "" : `<div class="ans">${ansHTML}</div>`}
    <div class="rr">${it.note ? esc(it.note) : ok ? "Так держать." : "Карточка вернётся через 10 минут."}${!ok && it.note ? " Карточка вернётся через 10 минут." : ""}<br><button id="rl2">Теория по теме</button> · <button id="rep">Сообщить об ошибке</button></div>
    <button class="btn" id="next">${last ? "Итоги" : ok ? "Дальше" : "Понятно"}</button></div>`;
  $("#rl2").onclick = () => theorySheet(it.topic, true);
  $("#rep").onclick = () => reportSheet(it);
  $("#next").onclick = next;
  $("#next").focus({ preventScroll: true });
}
function next() { if (L.i < L.items.length - 1) { L.i++; drawQ(); } else finishLesson(); }
function finishLesson() {
  const ok = L.res.filter(Boolean).length, n = L.res.length;
  if (L.topic && n >= LESSON) { const dk = dayKey(), dd = state.days[dk] || (state.days[dk] = { n: 0, ok: 0, pts: 0 }); dd.les = (dd.les || 0) + 1; }
  if (L.topic) { state.lessons[L.topic.id] = (state.lessons[L.topic.id] || 0) + 1; state.best[L.topic.id] = Math.max(state.best[L.topic.id] || 0, ok); }
  L.bonus = n >= LESSON ? (ok === n ? 20 : ok >= 8 ? 10 : 0) : 0;
  if (L.bonus) { addBonus(L.bonus); L.pts += L.bonus; }
  if (L.topic && n >= LESSON) {
    const perfect = ok === n, h = new Date().getHours(); state.cnt = state.cnt || {};
    state.perfectRun = perfect ? (state.perfectRun || 0) + 1 : 0; state.maxPerfectRun = Math.max(state.maxPerfectRun || 0, state.perfectRun);
    if (perfect && h >= 23) state.cnt.night = (state.cnt.night || 0) + 1;
    if (perfect && h < 7) state.cnt.morning = (state.cnt.morning || 0) + 1;
  }
  save(); backupDirty = true; syncSoon(); setTimeout(() => { checkMedals(); checkCosmetics(); }, 300);
  const lv = lvl(), st = streak();
  const idx = L.topic ? TOPICS.indexOf(L.topic) : -1;
  const msgs = [];
  if (lv.L > L.lv0) msgs.push(`Новый уровень: ${lv.L}!`);
  if (st > L.st0) msgs.push(`Огонёк: ${st} ${plural(st, "день", "дня", "дней")} подряд`);
  const wrong = L.items.filter((_, i) => !L.res[i]);
  $("#ovIn").innerHTML = `<div class="fin">
    <div class="muted">${esc(L.title)}</div>
    <div class="score">${ok}/${n}</div>
    <h2>${ok === n ? "Идеально!" : ok >= 7 ? "Отличный урок!" : "Хорошая тренировка"}</h2>
    <div class="tiles"><div class="tile"><b>+${L.pts}</b><small>знаков</small></div><div class="tile"><b>${Math.min(today().n, GOAL)}/${GOAL}</b><small>цель дня</small></div><div class="tile"><b>${st}</b><small>огонёк</small></div></div>
    ${L.bonus ? `<div class="chip g" style="margin-bottom:6px">★ Бонус за урок: +${L.bonus} зн.</div>` : ""}
    ${msgs.map(m => `<div class="chip" style="margin-bottom:6px">${esc(m)}</div>`).join("")}
    ${wrong.length ? `<div class="sec" style="align-self:flex-start">Ошибки — вернутся на повторение</div><div class="mist">${wrong.map(it => `<div>${esc(correctText(it))}</div>`).join("")}</div>` : ""}
    <div class="btns" style="width:100%;max-width:420px"><button class="btn" id="done">Готово</button>${L.topic ? `<button class="btn gh" id="again">Ещё урок</button>` : ""}</div></div>`;
  $("#done").onclick = hideOv;
  const ag = $("#again"); if (ag) { const t = L.topic; ag.onclick = () => startLesson(t); }
}

/* ---------- Блиц: верно или ошибка ---------- */
let B = null;
function blitzPool() {
  const open = TOPICS.filter(t => t.kind !== "commas");
  return open.flatMap(t => t.list);
}
function makeStmt(it, variant) {
  // variant: индекс варианта (choice) или индекс гласной (stress); правильный — когда совпадает с ответом
  if (it.kind === "choice") return { text: it.pre + it.opts[variant] + it.post, ok: variant === 0 };
  return { text: it.word.map((c, i) => i === variant ? c.toUpperCase() : c).join(""), ok: variant === it.idx };
}
function randomStmtCode(it) {
  const truth = Math.random() < .5;
  let v;
  if (it.kind === "choice") v = truth ? 0 : 1 + Math.floor(Math.random() * (it.opts.length - 1));
  else v = truth ? it.idx : pick(it.vowels.filter(x => x !== it.idx).concat(it.vowels.length < 2 ? [it.idx] : []));
  return it.key + "~" + v;
}
function decodeStmt(code) {
  const k = code.lastIndexOf("~"), it = ITEMS.get(code.slice(0, k)), v = +code.slice(k + 1);
  if (!it || it.kind === "commas" || !Number.isInteger(v)) return null;
  if (it.kind === "choice" && (v < 0 || v >= it.opts.length)) return null;
  if (it.kind === "stress" && !it.word[v]) return null;
  return { it, ...makeStmt(it, v) };
}
function startBlitz(codes = null, duel = null) {
  const pool = blitzPool();
  if (!codes) codes = shuffle(pool).slice(0, 60).map(randomStmtCode);
  const seq = codes.map(decodeStmt).filter(Boolean);
  if (!seq.length) { toast("Не получилось загрузить задания"); return; }
  B = { seq, i: 0, ok: 0, n: 0, end: Date.now() + BLITZ_SEC * 1000, wrong: [], duel, busy: false };
  showOv(); drawBlitz(); tickBlitz();
}
function tickBlitz() {
  if (!B) return;
  const left = Math.max(0, B.end - Date.now());
  const s = $("#bt"); if (s) s.style.width = (left / (BLITZ_SEC * 10)) + "%";
  const lt = $("#blt"); if (lt) lt.textContent = Math.ceil(left / 1000) + " с";
  if (left <= 0 || B.i >= B.seq.length) return finishBlitz();
  B.tm = setTimeout(tickBlitz, 200);
}
function drawBlitz() {
  const st = B.seq[B.i];
  $("#ovIn").innerHTML = `<div class="qtop"><button class="x" id="bx" aria-label="Закрыть">✕</button><div class="timer"><s id="bt" style="width:100%"></s></div><span class="bscore">${B.ok}</span></div>
    <div class="muted" style="text-align:center;font-size:13px;margin:-4px 0 8px" id="blt"></div>
    <div class="big" id="bcard"><span class="lbl">${B.duel ? "Дуэль" : "Блиц"} · ${esc(st.it.topic.name)}</span><div class="h" style="margin:0 0 10px">Написано правильно?</div><div class="w ${/\s/.test(st.text) ? "phrase" : ""}">${esc(st.text)}</div><div class="h">← свайп или кнопки →</div></div>
    <div class="yn"><button class="no" id="bno">✕ Ошибка</button><button class="yes" id="byes">✓ Верно</button></div>`;
  $("#bx").onclick = () => { clearTimeout(B.tm); if (B.duel) { finishBlitz(); } else hideOv(); };
  $("#bno").onclick = () => blitzAns(false);
  $("#byes").onclick = () => blitzAns(true);
  swipe($("#bcard"), dir => blitzAns(dir > 0));
}
function swipe(el, cb) {
  let x0 = null;
  el.addEventListener("pointerdown", e => { x0 = e.clientX; el.setPointerCapture(e.pointerId); });
  el.addEventListener("pointermove", e => { if (x0 !== null) el.style.transform = `translateX(${(e.clientX - x0) * .6}px) rotate(${(e.clientX - x0) / 40}deg)`; });
  el.addEventListener("pointerup", e => { const dx = e.clientX - x0; x0 = null; el.style.transform = ""; if (Math.abs(dx) > 70) cb(dx); });
  el.addEventListener("pointercancel", () => { x0 = null; el.style.transform = ""; });
}
function blitzAns(saysOk) {
  if (!B || B.busy) return;
  const st = B.seq[B.i], ok = saysOk === st.ok;
  B.n++; if (ok) B.ok++; else B.wrong.push(st.it);
  addDay(ok, ok ? BLITZ_PTS : 0); save();
  B.busy = true;
  $("#bcard").classList.add(ok ? "fo" : "fx");
  setTimeout(() => { if (!B) return; B.busy = false; B.i++; if (B.i >= B.seq.length || Date.now() >= B.end) return finishBlitz(); drawBlitz(); }, ok ? 220 : 650);
}
async function finishBlitz() {
  if (!B || B.done) return;
  B.done = true; clearTimeout(B.tm);
  const { ok, n, wrong, duel } = B;
  const best = ok > (state.blitzBest || 0); if (!duel && best) state.blitzBest = ok;
  state.flags = state.flags || {};
  if (ok >= 40 && wrong.length <= 2) state.flags.karl = true;
  if (ok >= 35 && wrong.length === 0) state.flags.izhica = true;
  const bbonus = n >= 10 && ok / n >= .9 ? 10 : 0; if (bbonus) addBonus(bbonus);
  save(); syncSoon(); setTimeout(() => checkMedals(), 300);
  $("#ovIn").innerHTML = `<div class="fin"><div class="muted">${duel ? "Дуэль " + esc(duel.code) : "Блиц 60 секунд"}</div><div class="score">${ok}</div>
    <h2>${ok} ${plural(ok, "верный ответ", "верных ответа", "верных ответов")} из ${n}</h2>
    <div class="chip g">+${ok * BLITZ_PTS + bbonus} зн.${bbonus ? " · бонус за точность +10" : ""}</div>
    ${!duel && best && ok ? `<div class="chip">Новый рекорд!</div>` : ""}
    <div id="duelRes" style="width:100%"></div>
    ${wrong.length ? `<div class="sec" style="align-self:flex-start">Как правильно</div><div class="mist">${[...new Set(wrong)].map(it => `<div>${esc(correctText(it))}</div>`).join("")}</div>` : ""}
    <div class="btns" style="width:100%;max-width:420px"><button class="btn" id="done">Готово</button>${duel ? "" : `<button class="btn gh" id="again">Ещё раз</button>`}</div></div>`;
  $("#done").onclick = hideOv;
  const ag = $("#again"); if (ag) ag.onclick = () => startBlitz();
  if (duel) {
    $("#duelRes").innerHTML = `<div class="empty">Отправляю результат…</div>`;
    try {
      await api("rpc/ru_submit_duel", { method: "POST", body: JSON.stringify({ p_code: duel.code, p_id: me.id, p_secret: me.secret, p_name: me.name, p_correct: ok, p_total: n }) });
      prefs.duelsDone = [...new Set([...(prefs.duelsDone || []), duel.code])].slice(-50); savePrefs();
      await showDuelResults(duel.code, $("#duelRes"));
    } catch (e) { $("#duelRes").innerHTML = `<div class="err">Не удалось отправить: ${esc(e.message)}</div>`; }
  }
}

/* ---------- Дуэль на одном телефоне ---------- */
function startLocal() {
  const seq = shuffle(blitzPool()).slice(0, 10).map(it => decodeStmt(randomStmtCode(it)));
  const D = { seq, i: 0, s: [0, 0], lock: [false, false], busy: false };
  const el = $("#split"); el.hidden = false;
  const draw = () => {
    const st = D.seq[D.i];
    const half = (p, cls, who) => `<div class="half ${cls} ${D.lock[p] ? "lockd" : ""}"><div class="who">${who}</div><div class="w2">${esc(st.text)}</div><div class="ans"><button data-p="${p}" data-a="0">✕ Ошибка</button><button data-p="${p}" data-a="1">✓ Верно</button></div><div class="sc2">${D.s[p]}</div></div>`;
    el.innerHTML = `<div class="split">${half(1, "p2", "Игрок 2")}${half(0, "p1", "Игрок 1")}</div><div class="dmid">${D.i + 1}/10</div><button class="splitx" id="lx" aria-label="Выйти">✕</button>`;
    el.querySelector("#lx").onclick = () => { el.hidden = true; el.innerHTML = ""; };
    el.querySelectorAll("[data-p]").forEach(b => b.onclick = () => {
      const p = +b.dataset.p; if (D.busy || D.lock[p]) return;
      const right = (b.dataset.a === "1") === st.ok;
      if (right) { D.s[p]++; D.busy = true; flash(p, true); setTimeout(nextR, 700); }
      else { D.lock[p] = true; flash(p, false); if (D.lock[0] && D.lock[1]) { D.busy = true; setTimeout(nextR, 900); } else draw(); }
    });
  };
  const flash = (p, ok) => { const h = el.querySelector(p ? ".p2" : ".p1"); if (h) h.querySelector(".w2").textContent = ok ? "✓ Верно! +1" : "✕ Мимо — ход сопернику"; };
  const nextR = () => {
    D.busy = false; D.lock = [false, false]; D.i++;
    if (D.i < D.seq.length) return draw();
    const w = D.s[0] === D.s[1] ? "Ничья!" : D.s[0] > D.s[1] ? "Победил Игрок 1" : "Победил Игрок 2";
    el.innerHTML = `<div class="split"><div class="half p2"><div class="sc2">${D.s[1]}</div><div class="w2">${w}</div></div><div class="half p1"><div class="sc2">${D.s[0]}</div><div class="w2">${w}</div><div class="ans"><button id="lagain">Ещё раз</button><button id="lexit">Выйти</button></div></div></div>`;
    el.querySelector("#lagain").onclick = startLocal;
    el.querySelector("#lexit").onclick = () => { el.hidden = true; el.innerHTML = ""; };
  };
  draw();
}

/* ---------- Повторить ---------- */
function renderReview() {
  const due = dueAll().length;
  const traps = [...ITEMS.values()].filter(it => itemState(it).bad > 0).sort((a, b) => (itemState(b).bad - itemState(b).b) - (itemState(a).bad - itemState(a).b)).slice(0, 24);
  $("#view").innerHTML = headerHTML() + `
    <div class="card"><h2>${due ? `${due} ${plural(due, "карточка ждёт", "карточки ждут", "карточек ждут")} повторения` : "Повторять пока нечего"}</h2>
      <p class="muted" style="margin:6px 0 0">${due ? "Ошибки возвращаются через 10 минут, выученное — через день, три, неделю." : traps.length ? "Можно прогнать слова, где ты ошибался." : "Ошибки из уроков будут появляться здесь."}</p>
      <div class="btns"><button class="btn" id="rev" ${due || traps.length ? "" : "disabled"}>${due ? "Повторить" : "Прогнать ошибки"}</button></div></div>
    <div class="card"><h2>Блиц 60 секунд</h2><p class="muted" style="margin:6px 0 0">Верно написано или ошибка? Свайп вправо или влево. Рекорд: <b>${state.blitzBest || 0}</b></p>
      <div class="btns"><button class="btn le" id="blitz">Начать блиц</button></div></div>
    <div class="card"><h2>Дуэль на одном телефоне</h2><p class="muted" style="margin:6px 0 0">Кладёте телефон на парту, каждый отвечает со своей стороны. Кто первый ответил верно — получает очко.</p>
      <div class="btns"><button class="btn gh" id="local">Играть вдвоём</button></div></div>
    <div class="sec">Твои слова-ловушки</div>
    ${traps.length ? `<div class="trap">${traps.map(it => `<span>${esc(correctText(it))}</span>`).join("")}</div>` : `<div class="empty">Здесь появятся слова, в которых ты ошибался</div>`}`;
  $("#rev").onclick = startReview;
  $("#blitz").onclick = () => startBlitz();
  $("#local").onclick = startLocal;
}

/* ---------- Сервер ---------- */
async function api(path, opts = {}) {
  const r = await fetch(SB.url + "/rest/v1/" + path, { ...opts, headers: { apikey: SB.key, "Content-Type": "application/json", ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(r.status + " " + (await r.text()).slice(0, 160));
  return r.status === 204 ? null : r.json().catch(() => null);
}
let syncing = Promise.resolve(), syncTm = null;
function syncSoon() { clearTimeout(syncTm); syncTm = setTimeout(syncScore, 800); }
function syncScore() {
  if (!me.name) return syncing;
  syncing = syncing.then(async () => {
    const st = streak(), L = lvl().L, y = dayKey(daysAgo(1));
    for (const k of [y, dayKey()]) {
      const d = state.days[k];
      if (!d && k === y) continue;
      await api("rpc/ru_submit_score", { method: "POST", body: JSON.stringify({ p_id: me.id, p_secret: me.secret, p_name: me.name, p_day: k,
        p_points: d ? d.pts : 0, p_correct: d ? d.ok : 0, p_attempts: d ? d.n : 0, p_streak: st, p_level: L, p_avatar: myAv() }) });
    }
    lastSeen.set(me.id, Date.now());
    await backupMaybe().catch(e => console.warn("копия:", e.message));
    await syncProfile().catch(e => console.warn("профиль:", e.message));
  }).catch(e => console.warn("рейтинг:", e.message));
  return syncing;
}
setInterval(() => { if (document.visibilityState === "visible" && me.name) { syncScore(); if (tab === "friends" && $("#ov").hidden) loadBoard(); } }, 60000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { me = readMe() || me; if (/^photo:/.test(me.avatar || "") && validPhoto(me.photo)) photos.set(me.id, me.photo); render(); if (me.name) syncScore(); } });

/* ---------- Друзья ---------- */
let period = ["day", "week", "month"].includes(prefs.period) ? prefs.period : "week";
let board = { rows: null, err: null, duels: [], loading: false };
function weekStart() { const d = new Date(); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d; }
async function loadBoard() {
  if (!me.name || board.loading) return;
  board.loading = true; if (!board.rows) renderFriends();
  try {
    await syncing;
    const ws = weekStart(), ms = new Date(); ms.setDate(1);
    const from = dayKey(ws < ms ? ws : ms);
    const [rows, duels] = await Promise.all([
      api(`ru_scores?select=player_id,name,day,points,attempts,streak,level,avatar,updated_at&day=gte.${from}&order=day.desc&limit=2000`),
      api(`ru_duels?select=code,creator_id,creator_name,created_at&created_at=gte.${daysAgo(3).toISOString()}&order=created_at.desc&limit=30`)
    ]);
    board.rows = rows || []; board.duels = duels || []; board.err = null;
    for (const r of board.rows) { const t = Date.parse(r.updated_at) || 0; if (t > (lastSeen.get(r.player_id) || 0)) lastSeen.set(r.player_id, t); }
    const pids = [...new Set(board.rows.map(r => r.player_id))].filter(x => x !== me.id && /^[0-9a-f-]{36}$/.test(x));
    if (pids.length) try { const pr = await api(`ru_profiles?select=player_id,frame:stats->>frame,bg:stats->>bg&player_id=in.(${pids.join(",")})`); for (const r of pr || []) otherCos.set(r.player_id, { frame: FRAME[r.frame] ? r.frame : "none", bg: BG[r.bg] ? r.bg : "none" }); } catch {}
    await loadPhotos(board.rows);
  } catch (e) { board.err = e.message; }
  board.loading = false;
  if (tab === "friends") renderFriends();
}
function ranking() {
  const t = dayKey(), from = period === "day" ? t : period === "week" ? dayKey(weekStart()) : dayKey(new Date(new Date().setDate(1)));
  const by = new Map();
  for (const r of board.rows || []) {
    if (r.day < from || r.day > t) continue;
    const p = by.get(r.player_id) || { id: r.player_id, name: r.name, avatar: r.avatar, pts: 0, n: 0, streak: 0, level: 1, last: "" };
    p.pts += r.points; p.n += r.attempts;
    if (r.updated_at > p.last) { p.last = r.updated_at; p.name = r.name; p.avatar = r.avatar; p.streak = r.day >= dayKey(daysAgo(1)) ? r.streak : 0; p.level = r.level; }
    by.set(r.player_id, p);
  }
  const mine = by.get(me.id) || { id: me.id, name: me.name, avatar: myAv(), pts: 0, n: 0, streak: streak(), level: lvl().L };
  // свои очки берём из телефона: они свежее
  const tp = period === "day" ? (state.days[t]?.pts || 0) : Object.entries(state.days).filter(([k]) => k >= from && k <= t).reduce((a, [, d]) => a + d.pts, 0);
  mine.pts = Math.max(mine.pts, tp); mine.name = me.name; mine.avatar = myAv(); mine.streak = streak(); mine.level = lvl().L;
  by.set(me.id, mine);
  return [...by.values()].sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name));
}
function feedItems() {
  const rows = board.rows || [], t = dayKey(), y = dayKey(daysAgo(1)), out = [];
  const lastBy = new Map();
  for (const r of rows) { if (r.player_id === me.id) continue; const cur = lastBy.get(r.player_id); if (!cur || r.day > cur.day) lastBy.set(r.player_id, r); }
  for (const r of lastBy.values()) {
    if (r.day === t && r.points > 0) out.push({ r, html: `<b>${esc(r.name)}</b> сегодня: ${fmt(r.points)} зн., ${r.attempts} ${plural(r.attempts, "задание", "задания", "заданий")}` });
    if (r.streak >= 3 && r.day >= y) out.push({ r, html: `<b>${esc(r.name)}</b> держит огонёк ${r.streak} ${plural(r.streak, "день", "дня", "дней")}` });
    const prev = rows.find(x => x.player_id === r.player_id && x.day < r.day);
    if (prev && r.level > prev.level && r.day >= y) out.push({ r, html: `<b>${esc(r.name)}</b> достиг ${r.level} уровня` });
  }
  return out.slice(0, 8);
}
function renderFriends() {
  const v = $("#view");
  if (!me.name) {
    v.innerHTML = headerHTML() + `<div class="card"><h2>Придумай ник</h2><p class="muted" style="margin:6px 0 0">Под ним тебя увидят друзья в рейтинге. Если ты уже играешь в «Формулограф» на этом телефоне, ник подтянется оттуда.</p>
      <form class="field" id="nickF"><input id="nick" maxlength="16" placeholder="Например, Грамотей" autocomplete="off"><button class="btn">Сохранить</button></form><div class="err" id="nickErr"></div>
      <p class="muted" style="margin:14px 0 0;font-size:14px">Уже играл и приложение сбросилось? <button class="link" id="goLogin">Войти по паролю</button></p></div>`;
    $("#nickF").onsubmit = e => { e.preventDefault(); setNick($("#nick").value, $("#nickErr")); };
    $("#goLogin").onclick = loginSheet;
    return;
  }
  const r = ranking(), ends = (() => { const e = weekStart(); e.setDate(e.getDate() + 7); e.setHours(0, 0, 0, 0); const h = Math.max(0, Math.round((e - Date.now()) / 36e5)); return h >= 24 ? `${Math.floor(h / 24)} д ${h % 24} ч` : `${h} ч`; })();
  const done = new Set(prefs.duelsDone || []);
  const open = board.duels.filter(d => d.creator_id !== me.id && !done.has(d.code));
  const mineD = board.duels.filter(d => d.creator_id === me.id).slice(0, 3);
  const feed = feedItems();
  v.innerHTML = headerHTML() + `
    <div class="league"><svg width="46" height="46" viewBox="0 0 48 48" aria-hidden="true"><path d="M14 8h20v8a10 10 0 0 1-20 0z" fill="#FFD84D"/><path d="M14 11H8a6 6 0 0 0 7 8M34 11h6a6 6 0 0 1-7 8" fill="none" stroke="#FFD84D" stroke-width="3"/><rect x="21" y="25" width="6" height="8" fill="#E3B514"/><rect x="15" y="33" width="18" height="6" rx="2" fill="#FFD84D"/></svg>
      <div><b>${period === "week" ? "Лига недели" : period === "day" ? "Сегодня" : "Месяц"}</b><small>${period === "week" ? `Неделя закончится через ${ends}` : "Очки за задания и блиц"}</small></div></div>
    <div class="pseg" id="per"><button data-p="day" aria-pressed="${period === "day"}">День</button><button data-p="week" aria-pressed="${period === "week"}">Неделя</button><button data-p="month" aria-pressed="${period === "month"}">Месяц</button></div>
    ${board.err ? `<div class="card err">Рейтинг не загрузился: ${esc(board.err)}</div>` : ""}
    <div class="rows">${!board.rows && board.loading ? `<div class="empty">Загружаю…</div>` : r.map((p, i) => `
      <button class="r ${p.id === me.id ? "me" : ""}" data-u="${esc(p.id)}"><span class="n">${i + 1}</span>${avaHTML(p.id, p.name, p.avatar)}<span class="nm">${esc(p.name)}${p.id === me.id ? " (ты)" : ""} ${statusOf(p.avatar)}<small>🔥 ${p.streak} · ур. ${p.level} · ${olHTML(p.id)}</small></span><span class="sc">${fmt(p.pts)}</span></button>
      ${i === 2 && r.length > 3 && period === "week" ? `<div class="zone">▲ ТОП-3 НЕДЕЛИ — ПРИЗОВЫЕ МЕСТА</div>` : ""}`).join("")}
      ${board.rows && r.length < 2 ? `<div class="empty">Пока в рейтинге только ты. Позови друзей: ссылка на приложение — ${esc(location.origin + location.pathname)}</div>` : ""}</div>
    <div class="sec">Дуэли</div>
    <div class="btns" style="margin-top:0"><button class="btn le" id="mkDuel">Вызвать друзей на дуэль</button></div>
    <div style="margin-top:10px">${open.map(d => `<div class="feed">${avaHTML(d.creator_id, d.creator_name, "")}<span><b>${esc(d.creator_name)}</b> вызывает на дуэль</span><button class="act" data-duel="${esc(d.code)}">Принять</button></div>`).join("")}
      ${mineD.map(d => `<div class="feed">${avaHTML(me.id, me.name, myAv())}<span>Твоя дуэль <b>${esc(d.code)}</b></span><button class="act" data-res="${esc(d.code)}">Итоги</button></div>`).join("")}</div>
    <div class="sec">Лента</div>
    ${feed.length ? feed.map(f => `<div class="feed">${avaHTML(f.r.player_id, f.r.name, f.r.avatar)}<span>${f.html}</span></div>`).join("") : `<div class="empty">Тут появится, кто сколько сегодня позанимался</div>`}`;
  $("#per").onclick = e => { const b = e.target.closest("[data-p]"); if (!b) return; period = b.dataset.p; prefs.period = period; savePrefs(); renderFriends(); };
  $("#mkDuel").onclick = createDuel;
  v.querySelectorAll("[data-duel]").forEach(b => b.onclick = () => joinDuel(b.dataset.duel));
  v.querySelectorAll("[data-res]").forEach(b => b.onclick = () => duelResultsSheet(b.dataset.res));
  v.querySelectorAll("[data-u]").forEach(b => b.onclick = () => openUser(b.dataset.u));
}
async function setNick(raw, errEl) {
  const n = String(raw || "").trim().replace(/\s+/g, " ");
  if (n.length < 2 || n.length > 16) { errEl.textContent = "От 2 до 16 символов"; return false; }
  if (/\p{Extended_Pictographic}/u.test(n)) { errEl.textContent = "Без смайликов"; return false; }
  const old = me.name; me.name = n; saveMe();
  try { await api("rpc/ru_submit_score", { method: "POST", body: JSON.stringify({ p_id: me.id, p_secret: me.secret, p_name: n, p_day: dayKey(), p_points: today().pts, p_correct: today().ok, p_attempts: today().n, p_streak: streak(), p_level: lvl().L, p_avatar: myAv() }) }); }
  catch (e) { me.name = old; saveMe(); errEl.textContent = "Не получилось сохранить: " + e.message; return false; }
  render(); syncSoon(); loadBoard();
  if (prefs.pendingDuel) { const c = prefs.pendingDuel; delete prefs.pendingDuel; savePrefs(); joinDuel(c); }
  return true;
}

/* ---------- Онлайн-дуэли ---------- */
async function createDuel() {
  const codes = shuffle(blitzPool()).slice(0, 50).map(randomStmtCode);
  try {
    const code = await api("rpc/ru_create_duel", { method: "POST", body: JSON.stringify({ p_id: me.id, p_secret: me.secret, p_name: me.name, p_items: codes }) });
    startBlitz(codes, { code });
  } catch (e) { toast("Не получилось создать дуэль: " + e.message); }
}
async function joinDuel(code) {
  code = String(code || "").toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) return;
  if (!me.name) { tab = "friends"; render(); toast("Сначала придумай ник — потом откроется дуэль"); prefs.pendingDuel = code; savePrefs(); return; }
  try {
    const rows = await api(`ru_duels?select=code,creator_name,items&code=eq.${code}`);
    if (!rows || !rows.length) return toast("Дуэль не найдена");
    const res = await api(`ru_duel_results?select=player_id&code=eq.${code}&player_id=eq.${me.id}`);
    if (res && res.length) return duelResultsSheet(code);
    const d = rows[0];
    openSheet(`<h2>Дуэль с ${esc(d.creator_name)}</h2><p class="muted">60 секунд, те же слова, что у соперника. Отвечай: верно написано или ошибка.</p><div class="btns"><button class="btn le" id="goD">Поехали</button><button class="btn gh" id="noD">Позже</button></div>`, s => {
      s.querySelector("#goD").onclick = () => { closeSheet(); startBlitz(d.items, { code }); };
      s.querySelector("#noD").onclick = closeSheet;
    });
  } catch (e) { toast("Не загрузилось: " + e.message); }
}
async function showDuelResults(code, el) {
  const res = await api(`ru_duel_results?select=player_id,name,correct,total,created_at&code=eq.${code}&order=correct.desc,created_at.asc`);
  const link = location.origin + location.pathname + "?duel=" + code;
  el.innerHTML = `<div class="rows" style="margin-top:12px">${(res || []).map((r, i) => `<div class="r ${r.player_id === me.id ? "me" : ""}"><span class="n">${i + 1}</span>${avaHTML(r.player_id, r.name, "")}<span class="nm">${esc(r.name)}<small>${r.correct} из ${r.total}</small></span><span class="sc">${i === 0 && res.length > 1 ? "🏆" : ""}</span></div>`).join("")}</div>
    ${(res || []).length < 2 ? `<p class="muted" style="font-size:14px">Друзья увидят вызов во вкладке «Друзья». Или отправь ссылку:</p>` : ""}
    <div class="field" style="margin-top:4px"><input readonly value="${esc(link)}" id="dl"><button class="btn gh" id="cp" type="button">Копировать</button></div>`;
  el.querySelector("#cp").onclick = async () => { try { await navigator.clipboard.writeText(link); toast("Ссылка скопирована"); } catch { el.querySelector("#dl").select(); toast("Выдели и скопируй ссылку"); } };
}
function duelResultsSheet(code) {
  openSheet(`<h2>Дуэль ${esc(code)}</h2><div id="dres"><div class="empty">Загружаю…</div></div><div class="btns"><button class="btn gh" id="cl">Закрыть</button></div>`, s => {
    s.querySelector("#cl").onclick = closeSheet;
    showDuelResults(code, s.querySelector("#dres")).catch(e => s.querySelector("#dres").innerHTML = `<div class="err">${esc(e.message)}</div>`);
  });
}

/* ---------- Профиль: фото, статус, награды ---------- */
async function uploadPhoto(file) {
  if (!me.name) { toast("Сначала придумай ник во вкладке «Друзья»"); return; }
  const st = $("#avStatus"); if (st) st.textContent = "Загружаю…";
  try {
    const url = URL.createObjectURL(file), img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const S = 128, c = document.createElement("canvas"); c.width = c.height = S;
    const g = c.getContext("2d"), m = Math.min(img.naturalWidth, img.naturalHeight);
    g.drawImage(img, (img.naturalWidth - m) / 2, (img.naturalHeight - m) / 2, m, m, 0, 0, S, S);
    URL.revokeObjectURL(url);
    let q = 0.82, data = c.toDataURL("image/jpeg", q);
    while (data.length > 38000 && q > 0.35) { q -= 0.1; data = c.toDataURL("image/jpeg", q); }
    await api("rpc/set_avatar", { method: "POST", body: JSON.stringify({ p_id: me.id, p_secret: me.secret, p_name: me.name, p_img: data }) });
    me.photo = data; me.avatar = "photo:" + Date.now().toString(36); saveMe(); photos.set(me.id, data);
    syncSoon(); render(); toast("Фото обновлено");
  } catch (e) {
    if (st) st.textContent = "";
    toast("Не получилось загрузить фото. Проверь интернет и попробуй другое фото.");
  }
}
async function removePhoto() {
  try { await api("rpc/set_avatar", { method: "POST", body: JSON.stringify({ p_id: me.id, p_secret: me.secret, p_name: me.name, p_img: "" }) }); } catch (e) {}
  me.photo = ""; me.avatar = ""; saveMe(); photos.delete(me.id); syncSoon(); render();
}
function setStatus(e) { me.status = e; saveMe(); syncSoon(); render(); }
function renderProfile() {
  const lv = lvl(), hasPhoto = /^photo:/.test(me.avatar || "");
  $("#view").innerHTML = `<div class="prof"><div class="phead">${bgSVG(myBg())}</div>${avaHTML(me.id, me.name || "Ты", myAv())}
      <div class="nm">${esc(me.name || "Без ника")} ${statusOf(myAv())}<button class="link" id="ren" style="font-size:13px">изменить</button></div>
      <div class="muted">Уровень ${lv.L} · до следующего ${lv.need - lv.cur} зн.</div>
      <div class="bar" style="max-width:280px;margin:10px auto 0"><s style="width:${Math.round(lv.cur / lv.need * 100)}%;background:var(--co)"></s></div>
      ${pinsHTML(state.pins || [], state.medals || {}, true)}</div>
    ${medalsSectionHTML()}
    <div class="card" style="margin-top:16px"><h2>Аватарка</h2><p class="muted" style="margin:4px 0 0;font-size:14px">${hasPhoto ? "Стоит твоё фото." : "Пока стоит первая буква ника — загрузи фото из галереи."} Видна в рейтинге и дуэлях.</p>
      ${me.name ? `<div class="avbtns"><label class="btn" for="avFile">Загрузить фото</label><input type="file" id="avFile" accept="image/*" hidden>${hasPhoto ? `<button class="btn gh" id="avDel">Убрать фото</button>` : ""}</div><div class="muted" id="avStatus" style="font-size:13px"></div>
      <p class="muted" style="font-size:12px;margin:8px 0 0">Фото увидят все в рейтинге. Не ставь то, что не хотел бы показывать другим.</p>`
      : `<p class="err">Сначала придумай ник во вкладке «Друзья».</p>`}</div>
    <div class="card"><h2>Статус</h2><p class="muted" style="margin:4px 0 0;font-size:14px">Стоит рядом с ником.</p>
      <div class="emojis">${AV_EMOJI.map(e => `<button data-e="${e}" aria-pressed="${e === me.status}" aria-label="${e}">${e}</button>`).join("")}</div>
      ${me.status ? `<button class="link" id="stReset">Убрать статус</button>` : ""}</div>
    ${accountCardHTML()}
    ${cosmeticsCardHTML()}
    ${skinCardHTML()}
    <div class="btns" style="margin:-4px 0 12px"><button class="btn gh" id="myProf">Как меня видят друзья</button></div>
    <p class="muted" style="font-size:12px;text-align:center">Ник, фото и статус общие с «Формулографом».<br>Версия 25</p>`;
  $("#ren").onclick = () => openSheet(`<h2>Ник</h2><form class="field" id="nf"><input id="nn" maxlength="16" value="${esc(me.name || "")}"><button class="btn">Сохранить</button></form><div class="err" id="ne"></div>`, s => {
    s.querySelector("#nf").onsubmit = async e => { e.preventDefault(); if (await setNick(s.querySelector("#nn").value, s.querySelector("#ne"))) { closeSheet(); toast("Ник сохранён"); } };
  });
  bindMedalClicks($("#view")); bindCosmetics($("#view")); bindAccountCard();
  document.querySelectorAll(".emojis button").forEach(b => b.onclick = () => setStatus(b.dataset.e === me.status ? "" : b.dataset.e));
  const sr = $("#stReset"); if (sr) sr.onclick = () => setStatus("");
  const af = $("#avFile"); if (af) af.onchange = () => { if (af.files && af.files[0]) uploadPhoto(af.files[0]); };
  const ad = $("#avDel"); if (ad) ad.onclick = removePhoto;
  document.querySelectorAll(".skin").forEach(b => b.onclick = () => { prefs.skin = b.dataset.k; savePrefs(); applySkin(prefs.skin); syncSoon(); render(); toast("Оформление «" + SKINS.find(k => k.id === prefs.skin).name + "»"); });
  $("#myProf").onclick = () => openUser(me.id);
}

/* ---------- Статистика ---------- */
function topicAgg(t) {
  let n = 0, ok = 0, bad = 0, seen = 0;
  for (const it of t.list) { const s = state.items[it.key]; if (!s) continue; n += s.n; ok += s.ok; bad += s.bad; if (s.n) seen++; }
  return { n, ok, bad, seen };
}
function renderStats() {
  const all = Object.values(state.items);
  const tot = all.reduce((a, s) => a + s.n, 0), ok = all.reduce((a, s) => a + s.ok, 0);
  const seen = all.filter(s => s.n).length, totalItems = ITEMS.size, st = streak();
  const tiles = `<div class="stiles">
    <div class="tile"><b>${fmt(tot)}</b><small>${plural(tot, "ответ", "ответа", "ответов")} всего</small></div>
    <div class="tile"><b>${tot ? Math.round(ok / tot * 100) + "%" : "—"}</b><small>точность</small></div>
    <div class="tile"><b>${st}</b><small>${plural(st, "день", "дня", "дней")} подряд</small></div>
    <div class="tile"><b>${seen}<span class="muted" style="font-size:12px"> / ${totalItems}</span></b><small>заданий встречалось</small></div>
    <div class="tile"><b>${fmtDur(secToday())}</b><small>сегодня в приложении</small></div>
    <div class="tile"><b>${fmtDur(secTotal())}</b><small>всего · за неделю ${fmtDur(secWeek())}</small></div></div>`;
  if (!tot) {
    $("#view").innerHTML = headerHTML(true) + tiles + `<div class="card"><h2>Здесь появится статистика</h2><p class="muted" style="margin:6px 0 0">Пройди пару уроков на вкладке «Учиться». Тут будет видно точность по темам, слова, где ты чаще ошибаешься, и активность по дням.</p>
      <div class="btns"><button class="btn" id="goL">Начать урок</button></div></div>`;
    $("#goL").onclick = () => { tab = "learn"; prefs.tab = tab; savePrefs(); render(); };
    return;
  }
  const rows = TOPICS.map(t => ({ t, ...topicAgg(t) })).sort((a, b) => (a.n ? a.ok / a.n : 2) - (b.n ? b.ok / b.n : 2)).map(r => {
    const col = look(r.t)[0];
    if (!r.n) return `<button class="srow" data-t="${TOPICS.indexOf(r.t)}"><span class="nm"><i style="background:${col}"></i>${esc(r.t.name)}</span><span class="num muted">не решал</span><span class="sbar"></span></button>`;
    const a = Math.round(r.ok / r.n * 100);
    return `<button class="srow" data-t="${TOPICS.indexOf(r.t)}"><span class="nm"><i style="background:${col}"></i>${esc(r.t.name)}</span><span class="num"><b>${a}%</b> · ошибок ${r.bad}</span>
      <span class="sbar"><s style="width:${r.ok / r.n * 100}%;background:var(--mi)"></s><s style="width:${r.bad / r.n * 100}%;background:var(--cor)"></s></span></button>`;
  }).join("");
  const sc = s => (s.ok + 1) / (s.n + 2);
  const weak = [...ITEMS.values()].map(it => ({ it, s: state.items[it.key] })).filter(x => x.s && x.s.bad > 0)
    .sort((a, b) => sc(a.s) - sc(b.s) || b.s.n - a.s.n).slice(0, 8);
  const pill = s => { const r = s.ok / s.n; return r >= .8 ? "ok" : r >= .5 ? "mid" : "bad"; };
  const weakHtml = weak.length ? weak.map(({ it, s }) => `<div class="wk"><div><b>${esc(correctText(it))}</b><small>${esc(it.topic.name)}</small></div><span class="pl ${pill(s)}">${s.ok}/${s.n}</span></div>`).join("")
    : `<p class="muted">Ошибок пока нет. Отлично!</p>`;
  // активность за 14 дней
  const days = []; for (let i = 13; i >= 0; i--) { const d = daysAgo(i); days.push({ d, v: state.days[dayKey(d)] || { n: 0, ok: 0, pts: 0 } }); }
  const max = Math.max(GOAL, ...days.map(x => x.v.n)), H = 90, W = 24;
  const goalY = 12 + H - GOAL / max * H;
  const bars = days.map((x, i) => {
    const h = x.v.n / max * H, hOk = x.v.ok / max * H, X = i * W + 4, today = i === 13;
    return `<rect x="${X}" y="${12 + H - h}" width="${W - 7}" height="${h}" rx="3" fill="var(--cor)"/>
      <rect x="${X}" y="${12 + H - hOk}" width="${W - 7}" height="${hOk}" rx="3" fill="var(--mi)"/>
      ${x.v.n ? `<text x="${X + (W - 7) / 2}" y="${8 + H - h}" text-anchor="middle">${x.v.n}</text>` : `<rect x="${X}" y="${H + 11}" width="${W - 7}" height="1.5" fill="var(--line)"/>`}
      <text x="${X + (W - 7) / 2}" y="${H + 27}" text-anchor="middle" ${today ? 'font-weight="700"' : ""}>${x.d.getDate()}</text>`;
  }).join("");
  const weekN = days.slice(7).reduce((a, x) => a + x.v.n, 0), weekP = days.slice(7).reduce((a, x) => a + x.v.pts, 0);
  const log = (state.log || []).filter(l => !l.ok && ITEMS.has(l.k)).slice(-6).reverse();
  const mistHtml = log.length ? log.map(l => { const it = ITEMS.get(l.k), dt = new Date(l.t);
      return `<div class="wk"><div><b>${esc(correctText(it))}</b><small>${esc(it.topic.name)} · ${dt.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}, ${dt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</small></div><span class="pl bad">ошибка</span></div>`; }).join("")
    : `<p class="muted">Пока без ошибок.</p>`;
  $("#view").innerHTML = headerHTML(true) + tiles + `
    <div class="card"><div class="ch"><h2>Темы</h2><span>сначала самые слабые</span></div>
      <div class="legend"><span><i style="background:var(--mi)"></i>верно</span><span><i style="background:var(--cor)"></i>неверно</span></div>
      <div class="srows" id="srows">${rows}</div></div>
    <div class="card"><div class="ch"><h2>Повторить в первую очередь</h2><span>верных из попыток</span></div><div class="weak">${weakHtml}</div>
      ${weak.length ? `<div class="btns"><button class="btn" id="drill">Тренировать слабые</button></div>` : ""}</div>
    <div class="card"><div class="ch"><h2>Активность</h2><span>14 дней · за неделю ${weekN} ${plural(weekN, "ответ", "ответа", "ответов")}, ${fmt(weekP)} зн.</span></div>
      <svg class="chart" viewBox="0 0 ${14 * W + 2} ${H + 32}" role="img" aria-label="Ответы по дням"><line x1="0" x2="${14 * W}" y1="${goalY}" y2="${goalY}" class="gl"/><text x="${14 * W}" y="${goalY - 4}" text-anchor="end" class="gt">цель ${GOAL}</text>${bars}</svg></div>
    <div class="card"><div class="ch"><h2>Последние ошибки</h2></div><div class="weak">${mistHtml}</div></div>
    <div class="card"><div class="ch"><h2>Рекорды</h2></div><div class="weak">
      <div class="wk"><div><b>Блиц 60 секунд</b><small>лучший результат</small></div><span class="pl ok">${state.blitzBest || 0}</span></div>
      <div class="wk"><div><b>Всего знаков</b><small>уровень ${lvl().L}</small></div><span class="pl ok">${fmt(state.total)}</span></div>
      <div class="wk"><div><b>Уроков пройдено</b><small>во всех темах</small></div><span class="pl ok">${Object.values(state.lessons).reduce((a, b) => a + b, 0)}</span></div></div></div>
    <div style="text-align:center;margin:8px 0 16px"><button class="link" id="reset" style="color:var(--cor)">Сбросить статистику</button></div>`;
  $("#srows").onclick = e => { const b = e.target.closest("[data-t]"); if (b) topicSheet(+b.dataset.t); };
  const dr = $("#drill"); if (dr) dr.onclick = () => { L = { title: "Слабые места", topic: null, items: shuffle(weak.map(x => x.it)), i: 0, res: [], combo: 0, pts: 0, lv0: lvl().L, st0: streak() }; showOv(); drawQ(); };
  $("#reset").onclick = () => openSheet(`<h2>Сбросить статистику?</h2><p class="muted">Удалятся очки, выученные слова, огонёк и история на этом телефоне. Ник и фото останутся.</p><div class="btns"><button class="btn gh" id="no">Отмена</button><button class="btn" id="yes" style="background:var(--cor);box-shadow:none">Сбросить</button></div>`, s => {
    s.querySelector("#no").onclick = closeSheet;
    s.querySelector("#yes").onclick = () => { state = blank(); save(); closeSheet(); render(); toast("Статистика сброшена"); };
  });
}

/* ---------- Профиль другого игрока ---------- */
const ONLINE_MS = 150000;
const lastSeen = new Map();
const isOnline = id => id === me.id || Date.now() - (lastSeen.get(id) || 0) < ONLINE_MS;
const olHTML = id => isOnline(id) ? `<span class="ol on">online</span>` : `<span class="ol">offline</span>`;
function myProfileStats() {
  const all = Object.values(state.items), n = all.reduce((a, s) => a + s.n, 0), ok = all.reduce((a, s) => a + s.ok, 0);
  const topics = {}; for (const t of TOPICS) topics[t.id] = Math.round(mastery(t) * 100);
  return { v: 1, total: state.total, lvl: lvl().L, streak: streak(), ans: n, acc: n ? Math.round(ok / n * 100) : 0,
    words: all.filter(s => s.b >= 2).length, blitz: state.blitzBest || 0, lessons: Object.values(state.lessons).reduce((a, b) => a + b, 0),
    time: { today: secToday(), week: secWeek(), total: secTotal(), day: dayKey() }, topics, medals: Object.fromEntries((state.pins || []).slice(0, 5).filter(id => (state.medals || {})[id]).map(id => [id, state.medals[id]])), pins: (state.pins || []).slice(0, 5), skin: skinNow(), frame: myFrame(), bg: myBg() };
}
async function syncProfile() {
  const st = myProfileStats(), js = JSON.stringify(st);
  if (js === syncProfile.last) return;
  await api("rpc/ru_set_profile", { method: "POST", body: JSON.stringify({ p_id: me.id, p_secret: me.secret, p_name: me.name, p_stats: st }) });
  syncProfile.last = js;
}
async function openUser(id) {
  const row = (board.rows || []).find(r => r.player_id === id) || {};
  const name = id === me.id ? me.name : row.name || "Игрок", av = id === me.id ? myAv() : row.avatar || "";
  const oc = id === me.id ? { frame: myFrame(), bg: myBg() } : otherCos.get(id) || {};
  openSheet(`<div class="uprof"><div class="phead sh" id="uBg">${bgSVG(oc.bg)}</div><div class="uhead">${avaHTML(id, name, av, "avbig", oc.frame || "none")}<div><div class="unm">${esc(name)} ${statusOf(av)}</div>${olHTML(id)}</div></div><div id="ubody"><div class="empty">Загружаю профиль…</div></div></div>`);
  try {
    const from = dayKey(daysAgo(13));
    const [pr, days] = await Promise.all([
      id === me.id ? Promise.resolve([{ stats: myProfileStats() }]) : api(`ru_profiles?select=stats,updated_at&player_id=eq.${id}`),
      api(`ru_scores?select=day,points,attempts,correct,streak,level&player_id=eq.${id}&day=gte.${from}&order=day.asc`)
    ]);
    const s = (pr && pr[0] && pr[0].stats) || null, D = new Map((days || []).map(d => [d.day, d]));
    if (s && id !== me.id) { otherCos.set(id, { frame: FRAME[s.frame] ? s.frame : "none", bg: BG[s.bg] ? s.bg : "none" }); const ub = $("#uBg"); if (ub) ub.innerHTML = bgSVG(otherCos.get(id).bg); const uh = document.querySelector(".uhead"); if (uh) uh.firstElementChild.outerHTML = avaHTML(id, name, av, "avbig", otherCos.get(id).frame); }
    if (id === me.id) for (const [k, d] of Object.entries(state.days)) if (k >= from) D.set(k, { day: k, points: d.pts, attempts: d.n, correct: d.ok });
    const last = (days || []).slice(-1)[0] || {};
    const week = [...D.values()].filter(d => d.day >= dayKey(weekStart())).reduce((a, d) => a + d.points, 0);
    // 14 дней
    const list = []; for (let i = 13; i >= 0; i--) { const k = dayKey(daysAgo(i)); list.push(D.get(k) || { day: k, attempts: 0, correct: 0 }); }
    const max = Math.max(GOAL, ...list.map(d => d.attempts)), H = 60, W = 22;
    const bars = list.map((d, i) => { const h = d.attempts / max * H, ho = (d.correct || 0) / max * H, X = i * W + 3;
      return `<rect x="${X}" y="${6 + H - h}" width="${W - 6}" height="${h}" rx="3" fill="var(--cor)"/><rect x="${X}" y="${6 + H - ho}" width="${W - 6}" height="${ho}" rx="3" fill="var(--mi)"/>${d.attempts ? "" : `<rect x="${X}" y="${H + 5}" width="${W - 6}" height="1.5" fill="var(--line)"/>`}<text x="${X + (W - 6) / 2}" y="${H + 20}" text-anchor="middle">${+d.day.slice(8)}</text>`; }).join("");
    const heat = m => m >= 80 ? "var(--mi)" : m >= 40 ? "var(--le-d)" : m > 0 ? "var(--cor)" : "var(--sunk)";
    $("#ubody").innerHTML = `
      <div class="muted" style="margin:-4px 0 10px">Уровень ${s ? s.lvl : last.level || 1} · 🔥 ${s ? s.streak : last.streak || 0} ${plural(s ? s.streak : last.streak || 0, "день", "дня", "дней")} подряд${s && s.skin ? ` · оформление «${esc((SKINS.find(k => k.id === s.skin) || {}).name || "Классика")}»` : ""}</div>
      ${s && s.time ? `<div class="utime">⏱ Сегодня <b>${fmtDur(s.time.day === dayKey() ? s.time.today : 0)}</b> · за неделю <b>${fmtDur(s.time.week)}</b> · всего <b>${fmtDur(s.time.total)}</b></div>` : ""}
      <div class="stiles">
        <div class="tile"><b>${fmt(week)}</b><small>знаков за неделю</small></div>
        <div class="tile"><b>${s ? fmt(s.total) : "—"}</b><small>знаков всего</small></div>
        <div class="tile"><b>${s ? s.acc + "%" : "—"}</b><small>точность · ${s ? fmt(s.ans) : 0} ${plural(s ? s.ans : 0, "ответ", "ответа", "ответов")}</small></div>
        <div class="tile"><b>${s ? s.blitz : "—"}</b><small>рекорд блица</small></div></div>
      ${s && s.medals && (s.pins || []).some(id => s.medals[id]) ? `<div class="ch" style="margin-top:6px"><h2>Медали</h2><span>закреплённые</span></div>${pinsHTML(s.pins || [], s.medals, false)}` : ""}
      <div class="ch"><h2>Активность</h2><span>14 дней</span></div>
      <svg class="chart" viewBox="0 0 ${14 * W} ${H + 26}">${bars}</svg>
      ${s ? `<div class="ch" style="margin-top:14px"><h2>Темы</h2><span>${s.words} ${plural(s.words, "слово выучено", "слова выучено", "слов выучено")}</span></div>
      <div class="hgrid">${TOPICS.map(t => { const m = (s.topics || {})[t.id] || 0; return `<span class="hcell" style="background:${heat(m)};${m ? "" : "color:var(--muted)"}">${esc(t.name)}<small>${m}%</small></span>`; }).join("")}</div>`
      : `<p class="muted" style="margin-top:12px">Подробная статистика появится, когда игрок откроет новую версию приложения.</p>`}
      <div class="btns">${id !== me.id && me.name ? `<button class="btn le" id="uDuel">Вызвать на дуэль</button>` : ""}<button class="btn gh" id="uCl">Закрыть</button></div>`;
    $("#uCl").onclick = closeSheet;
    const du = $("#uDuel"); if (du) du.onclick = () => { closeSheet(); createDuel(); };
    bindMedalClicks($("#ubody"), id === me.id ? null : { medals: (s && s.medals) || {} });
  } catch (e) { $("#ubody").innerHTML = `<div class="err">Не загрузилось: ${esc(e.message)}</div>`; }
}

/* ---------- Оформление ---------- */
function skinNow() { return SKINS.some(k => k.id === prefs.skin) ? prefs.skin : "classic"; }
function applySkin(id) {
  const el = document.documentElement;
  if (id === "classic") el.removeAttribute("data-skin"); else el.setAttribute("data-skin", id);
  const bg = getComputedStyle(document.body).backgroundColor;
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute("content", bg));
}
function skinCardHTML() {
  const cur = skinNow();
  return `<div class="card"><h2>Оформление</h2><p class="muted" style="margin:4px 0 0;font-size:14px">Меняет цвета и рисунки на карте тем.</p>
    <div class="skins">${SKINS.map(k => `<button class="skin" data-k="${k.id}" aria-pressed="${k.id === cur}">
      <span class="pv" style="background:${k.sw[0]}"><svg viewBox="0 0 120 64" aria-hidden="true">${decorDefs()}${decorSVG(k.id, 120, 64, [14, 50]).replace(/font-size="[\d.]+"/g, 'font-size="22"')}
        <path d="M24,40 C24,20 96,44 96,22" fill="none" stroke="${["neon"].includes(k.id) ? "rgba(255,255,255,.25)" : "rgba(0,0,0,.12)"}" stroke-width="6" stroke-linecap="round"/>
        <circle cx="24" cy="40" r="11" fill="${k.sw[1]}"/><circle cx="96" cy="22" r="11" fill="${k.sw[2]}" stroke="${k.sw[1]}" stroke-width="2"/></svg></span>
      <span class="nm2">${k.name}<small>${k.note}</small></span></button>`).join("")}</div></div>`;
}

/* ---------- Сообщить об ошибке ---------- */
function reportSheet(it) {
  const R = ["Неправильный ответ", "Опечатка", "Непонятное задание", "Другое"];
  openSheet(`<h2>Сообщить об ошибке</h2><p class="muted" style="margin:4px 0 8px">Задание: <b>${esc(correctText(it))}</b> · ${esc(it.topic.name)}</p>
    <div class="rpr">${R.map((r, i) => `<button data-r="${i}" aria-pressed="${i === 0}">${r}</button>`).join("")}</div>
    <textarea id="rpc" maxlength="500" rows="3" placeholder="Что не так? Например: правильно «…», потому что…"></textarea>
    <div class="err" id="rpe"></div>
    <div class="btns"><button class="btn" id="rps">Отправить</button><button class="btn gh" id="rpx">Отмена</button></div>`, s => {
    let reason = R[0];
    s.querySelectorAll("[data-r]").forEach(b => b.onclick = () => { reason = R[+b.dataset.r]; s.querySelectorAll("[data-r]").forEach(x => x.setAttribute("aria-pressed", x === b)); });
    s.querySelector("#rpx").onclick = closeSheet;
    s.querySelector("#rps").onclick = async () => {
      if (!me.name) { s.querySelector("#rpe").textContent = "Сначала придумай ник во вкладке «Друзья»."; return; }
      const btn = s.querySelector("#rps"); btn.disabled = true; btn.textContent = "Отправляю…";
      try {
        await api("rpc/ru_report", { method: "POST", body: JSON.stringify({ p_id: me.id, p_secret: me.secret, p_name: me.name, p_item: it.key, p_reason: reason, p_comment: s.querySelector("#rpc").value.trim() }) });
        closeSheet(); toast("Спасибо! Проверю и исправлю");
      } catch (e) { btn.disabled = false; btn.textContent = "Отправить"; s.querySelector("#rpe").textContent = "Не отправилось — проверь интернет. " + e.message; }
    };
  });
}

/* ---------- Пароль, вход и резервная копия ---------- */
/* Сервер знает очки за последние дни. Если там больше, чем в телефоне (новый телефон, вход по паролю без копии),
   берём серверные цифры, чтобы не затереть их нулями при синхронизации. */
async function mergeServerDays() {
  if (!me.name) return;
  try {
    const rows = await api(`ru_scores?select=day,points,correct,attempts&player_id=eq.${me.id}&day=gte.${dayKey(daysAgo(2))}`);
    let changed = false;
    for (const r of rows || []) {
      const d = state.days[r.day] || { n: 0, ok: 0, pts: 0 };
      if (r.points > (d.pts || 0) || r.attempts > (d.n || 0)) {
        const add = Math.max(0, r.points - (d.pts || 0));
        state.days[r.day] = Object.assign(d, { n: Math.max(d.n || 0, r.attempts), ok: Math.max(d.ok || 0, r.correct), pts: Math.max(d.pts || 0, r.points) });
        state.total += add; changed = true;
      }
    }
    if (changed) { save(); render(); }
  } catch (e) { console.warn("сверка с сервером:", e.message); }
}
let backupDirty = false;
function backupData() {
  return { v: 1, at: Date.now(), state, prefs: { skin: prefs.skin, examDate: prefs.examDate, period: prefs.period, duelsDone: prefs.duelsDone },
    me: { avatar: me.avatar || "", status: me.status || "" } };
}
async function backupMaybe(force) {
  if (!me.name) return;
  const last = prefs.backupAt || 0, now = Date.now();
  if (!force && !(backupDirty && now - last > 60e3) && now - last < 5 * 60e3) return;
  await api("rpc/ru_save_backup", { method: "POST", body: JSON.stringify({ p_id: me.id, p_secret: me.secret, p_name: me.name, p_data: backupData() }) });
  backupDirty = false; prefs.backupAt = now; savePrefs();
}
const agoText = t => { if (!t) return "ещё не было"; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "только что" : m < 60 ? `${m} мин назад` : m < 1440 ? `${Math.round(m / 60)} ч назад` : new Date(t).toLocaleDateString("ru-RU"); };
function accountCardHTML() {
  if (!me.name) return "";
  const login = prefs.login;
  return `<div class="card" id="accCard"><h2>Вход и резервная копия</h2>
    ${login ? `<p class="muted" style="margin:4px 0 0;font-size:14px">Пароль задан. Если приложение сбросится или сменишь телефон — нажми «Войти по паролю» и введи логин <b>${esc(login)}</b>. Прогресс восстановится из копии.</p>`
      : `<p class="muted" style="margin:4px 0 0;font-size:14px">Задай пароль, чтобы вернуть аккаунт и весь прогресс, если приложение сбросится или ты сменишь телефон. Логином будет твой ник.</p>`}
    <div class="muted" style="font-size:13px;margin-top:6px">Копия прогресса на сервере: ${agoText(prefs.backupAt)}</div>
    <div class="btns"><button class="btn ${login ? "gh" : ""}" id="setPass">${login ? "Сменить пароль" : "Задать пароль"}</button><button class="btn gh" id="goLogin2">Войти в другой аккаунт</button></div></div>`;
}
function bindAccountCard() {
  const sp = $("#setPass"); if (sp) sp.onclick = passwordSheet;
  const gl = $("#goLogin2"); if (gl) gl.onclick = loginSheet;
  if (me.name && prefs.login === undefined) api("rpc/ru_has_password", { method: "POST", body: JSON.stringify({ p_id: me.id, p_secret: me.secret, p_name: me.name }) })
    .then(l => { prefs.login = l || ""; savePrefs(); if (tab === "profile") render(); }).catch(() => {});
}
function passwordSheet() {
  openSheet(`<h2>${prefs.login ? "Сменить пароль" : "Задать пароль"}</h2><p class="muted" style="margin:4px 0 10px">Логин: <b>${esc(me.name)}</b> (твой ник, без учёта больших и маленьких букв). Пароль — от 6 символов. Запомни или запиши его.</p>
    <form id="pf"><input type="password" id="p1" placeholder="Пароль" autocomplete="new-password" class="inp"><input type="password" id="p2" placeholder="Ещё раз" autocomplete="new-password" class="inp">
    <div class="err" id="pe"></div><div class="btns"><button class="btn" id="psave">Сохранить</button><button class="btn gh" type="button" id="pcl">Отмена</button></div></form>`, s => {
    s.querySelector("#pcl").onclick = closeSheet;
    s.querySelector("#pf").onsubmit = async e => {
      e.preventDefault();
      const a = s.querySelector("#p1").value, b = s.querySelector("#p2").value, err = s.querySelector("#pe");
      if (a.length < 6) return err.textContent = "Пароль — минимум 6 символов";
      if (a !== b) return err.textContent = "Пароли не совпадают";
      const btn = s.querySelector("#psave"); btn.disabled = true; btn.textContent = "Сохраняю…";
      try {
        const l = await api("rpc/ru_set_password", { method: "POST", body: JSON.stringify({ p_id: me.id, p_secret: me.secret, p_name: me.name, p_password: a }) });
        prefs.login = l; savePrefs(); await backupMaybe(true);
        closeSheet(); render(); toast("Пароль сохранён, копия прогресса сделана");
      } catch (e2) {
        btn.disabled = false; btn.textContent = "Сохранить";
        err.textContent = /login taken/.test(e2.message) ? "Такой логин уже занят другим игроком — смени ник в профиле и попробуй снова" : "Не получилось: " + e2.message;
      }
    };
  });
}
function loginSheet() {
  const hasLocal = Object.values(state.items).some(x => x.n);
  openSheet(`<h2>Войти по паролю</h2><p class="muted" style="margin:4px 0 10px">Введи ник и пароль, которые задавал в профиле.${hasLocal ? " <b>Прогресс на этом телефоне заменится прогрессом из аккаунта.</b>" : ""}</p>
    <form id="lf"><input id="ll" placeholder="Ник" autocomplete="username" class="inp" maxlength="20"><input type="password" id="lp" placeholder="Пароль" autocomplete="current-password" class="inp">
    <div class="err" id="le"></div><div class="btns"><button class="btn" id="lgo">Войти</button><button class="btn gh" type="button" id="lcl">Отмена</button></div></form>`, s => {
    s.querySelector("#lcl").onclick = closeSheet;
    s.querySelector("#lf").onsubmit = async e => {
      e.preventDefault();
      const err = s.querySelector("#le"), btn = s.querySelector("#lgo");
      btn.disabled = true; btn.textContent = "Вхожу…"; err.textContent = "";
      try {
        const acc = await api("rpc/ru_login", { method: "POST", body: JSON.stringify({ p_login: s.querySelector("#ll").value, p_password: s.querySelector("#lp").value }) });
        if (acc && acc.error === "locked") throw new Error("locked");
        if (!acc || !acc.id) throw new Error("wrong login or password");
        const backup = await api("rpc/ru_load_backup", { method: "POST", body: JSON.stringify({ p_id: acc.id, p_secret: acc.secret }) });
        const nm = { id: acc.id, secret: acc.secret, name: acc.name };
        if (backup && backup.me) { nm.avatar = backup.me.avatar; nm.status = backup.me.status; }
        ls.set(ME_KEY, JSON.stringify(nm));
        if (backup && backup.state && backup.state.v === 1) ls.set(LS_KEY, JSON.stringify(backup.state)); else ls.set(LS_KEY, JSON.stringify(blank()));
        const np = Object.assign({}, prefs, (backup && backup.prefs) || {}, { login: (s.querySelector("#ll").value || "").trim().toLowerCase(), backupAt: backup && backup.at || 0, rankAt: "" });
        ls.set(LS_KEY + "-prefs", JSON.stringify(np));
        location.reload();
      } catch (e2) {
        btn.disabled = false; btn.textContent = "Войти";
        err.textContent = /locked/.test(e2.message) ? "Слишком много попыток. Подожди 15 минут." : /wrong login or password/.test(e2.message) ? "Неверный ник или пароль" : "Не получилось войти: " + e2.message;
      }
    };
  });
}

/* ---------- Клавиатура ---------- */
document.addEventListener("keydown", e => {
  if ($("#ov").hidden || !$("#shade").hidden) return;
  if (B && !B.done) { if (e.key === "ArrowLeft") blitzAns(false); if (e.key === "ArrowRight") blitzAns(true); return; }
  if (L && L.ans !== null && e.key === "Enter" && document.activeElement?.id !== "next") { e.preventDefault(); next(); }
});

/* ---------- Старт ---------- */
applySkin(skinNow());
render();
setTimeout(() => { checkMedals(); checkCosmetics(); refreshRankMedals(); }, 1200);
if (me.name) { mergeServerDays().finally(() => syncScore()); if (tab === "friends") loadBoard(); if (/^photo:/.test(me.avatar || "")) loadPhotos([{ player_id: me.id, avatar: me.avatar }]).then(r => r && render()); }
{
  const q = new URLSearchParams(location.search).get("duel") || prefs.pendingDuel;
  if (q) { delete prefs.pendingDuel; savePrefs(); history.replaceState(null, "", location.pathname); joinDuel(q); }
}
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
