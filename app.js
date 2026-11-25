"use strict";
/* ---------- Настройки ---------- */
const SB = { url: "https://ftgkjtfzhylmbvuldcfe.supabase.co", key: "sb_publishable_RbyH44pJCkVDO0ljNDY40g_qwR9wnMW" };
const GOAL = 20;                 // заданий в день для огонька
const LESSON = 10;               // карточек в уроке
const UNLOCK = 7;                // столько верных в уроке открывает следующую тему
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
const blank = () => ({ v: 1, total: 0, items: {}, days: {}, best: {}, lessons: {}, blitzBest: 0 });
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
const myAv = () => {
  const ph = /^photo:[a-z0-9]{1,12}$/.test(me.avatar || "") ? me.avatar : "";
  const st = typeof me.status === "string" && me.status.length <= 16 ? me.status : "";
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
const unlocked = i => i === 0 || (state.best[TOPICS[i - 1].id] || 0) >= UNLOCK || prefs.allOpen;
const correctText = it => it.kind === "choice" ? it.pre + it.opts[0] + it.post
  : it.kind === "stress" ? it.word.map((c, i) => i === it.idx ? c.toUpperCase() : c).join("")
  : it.words.map((w, i) => w + (it.commas.has(i) ? "," : "")).join(" ");

/* ---------- Очки, уровень, огонёк ---------- */
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
  const s = state.items[it.key] || (state.items[it.key] = { b: 0, due: 0, n: 0, ok: 0, bad: 0 });
  s.n++;
  if (ok) { s.ok++; s.b = Math.min(s.b + 1, INTERVALS.length - 1); s.due = Date.now() + INTERVALS[s.b]; }
  else { s.bad++; s.b = 0; s.due = Date.now() + INTERVALS[0]; }
  const pts = ok ? (combo >= 5 ? 9 : 6) : 0;
  addDay(ok, pts); save();
  return pts;
}

/* ---------- UI: общие ---------- */
let tab = ["learn", "review", "friends", "profile"].includes(prefs.tab) ? prefs.tab : "learn";
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
function avaHTML(id, name, av, cls = "") {
  const img = /^photo:/.test(String(av || "")) && photos.get(id);
  if (img) return `<span class="ava ${cls}"><img src="${esc(img)}" alt=""></span>`;
  const letter = (String(name || "?").trim()[0] || "?").toUpperCase();
  return `<span class="ava ${cls}" style="background:${nameColor(name || "?")}">${esc(letter)}</span>`;
}
const statusOf = av => { const s = String(av || "").split(";")[1] || ""; return s && s.length <= 16 && /\p{Extended_Pictographic}/u.test(s) ? s : ""; };
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
  ({ learn: renderLearn, review: renderReview, friends: renderFriends, profile: renderProfile })[tab]();
}
$("#tabs").addEventListener("click", e => {
  const b = e.target.closest("button[data-tab]"); if (!b) return;
  tab = b.dataset.tab; prefs.tab = tab; savePrefs(); $("#view").scrollTop = 0; render();
  if (tab === "friends") loadBoard();
});

function headerHTML() {
  const st = streak(), lv = lvl();
  return `<div class="hrow">
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
function renderLearn() {
  const d = today(), left = Math.max(0, GOAL - d.n);
  let cur = TOPICS.findIndex((t, i) => unlocked(i) && mastery(t) < .8);
  const X = [.5, .74, .52, .26, .48, .74, .5, .26, .48, .74, .5, .26];
  const STEP = 118, H = TOPICS.length * STEP + 30;
  const nodes = TOPICS.map((t, i) => {
    const m = mastery(t), open = unlocked(i), done = m >= .8;
    const cls = !open ? "lock" : i === cur ? "cur" : done ? "done" : "open";
    const icon = !open ? "🔒" : done ? "✓" : i + 1;
    const ringSvg = open && !done && m > 0 ? `<svg viewBox="0 0 78 78"><circle cx="39" cy="39" r="36" fill="none" stroke="var(--mi)" stroke-width="4" stroke-dasharray="${(226 * m).toFixed(0)} 226" stroke-linecap="round"/></svg>` : "";
    return `<div class="node ${cls}" style="left:${X[i % X.length] * 100}%;top:${i * STEP + 40}px">
      ${i === cur ? `<span class="go">${state.lessons[t.id] ? "Продолжить" : "Начать"}</span>` : ""}
      <button class="c" data-topic="${i}" aria-label="${esc(t.name)}">${ringSvg}${icon}</button>
      <small>${esc(t.name)}<i>${open ? Math.round(m * 100) + "% · " + esc(t.ege) : esc(t.ege)}</i></small></div>`;
  }).join("");
  $("#view").innerHTML = headerHTML() + `
    <div class="goal">${ring(d.n / GOAL)}<div><b>Цель дня ${Math.min(d.n, GOAL)} / ${GOAL}</b><small>${left ? `Ещё ${left} ${plural(left, "задание", "задания", "заданий")} — и огонёк горит` : "Цель выполнена, огонёк горит!"}</small></div></div>
    <div class="map" id="map" style="height:${H}px"><svg class="path" id="mapPath"></svg>${nodes}</div>`;
  const map = $("#map"), W = map.clientWidth;
  const pts = TOPICS.map((_, i) => [X[i % X.length] * W, i * STEP + 40 + 37]);
  let p = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], my = (a[1] + b[1]) / 2; p += ` C${a[0]},${my} ${b[0]},${my} ${b[0]},${b[1]}`; }
  $("#mapPath").setAttribute("viewBox", `0 0 ${W} ${H}`);
  $("#mapPath").innerHTML = `<path d="${p}" fill="none" stroke="var(--line)" stroke-width="12" stroke-linecap="round" stroke-dasharray="1 20"/>`;
  map.onclick = e => { const b = e.target.closest("[data-topic]"); if (b) topicSheet(+b.dataset.topic); };
}
function topicSheet(i) {
  const t = TOPICS[i], open = unlocked(i), m = mastery(t), due = t.list.filter(isDue).length;
  const seen = t.list.filter(it => itemState(it).n > 0).length;
  openSheet(`<h2>${esc(t.name)}</h2><div class="muted">${esc(t.ege)} · ${t.list.length} ${plural(t.list.length, "задание", "задания", "заданий")}</div>
    <div class="bar"><s style="width:${Math.round(m * 100)}%"></s></div>
    <div class="muted" style="font-size:13px">Выучено ${Math.round(m * 100)}% · видел ${seen} из ${t.list.length}${due ? ` · ${due} ждут повторения` : ""}</div>
    ${open ? "" : `<p class="card" style="margin-top:14px">Тема откроется, когда в теме «${esc(TOPICS[i - 1].name)}» будет урок на ${UNLOCK} из ${LESSON}.</p>`}
    <div class="btns">${open ? `<button class="btn" id="goLesson">Начать урок</button>` : ""}<button class="btn gh" id="goRule">Правило</button></div>`, s => {
    s.querySelector("#goLesson")?.addEventListener("click", () => { closeSheet(); startLesson(t); });
    s.querySelector("#goRule").addEventListener("click", () => ruleSheet(t));
  });
}
function ruleSheet(t) { openSheet(`<h2>${esc(t.name)}</h2><div class="muted">${esc(t.ege)}</div><div class="rule">${t.rule}</div><div class="btns"><button class="btn gh" id="cl">Понятно</button></div>`, s => s.querySelector("#cl").onclick = closeSheet); }

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
function startLesson(t) { const i = TOPICS.indexOf(t); L = { title: t.name, topic: t, items: pickLesson(t), i: 0, res: [], combo: 0, pts: 0, lv0: lvl().L, st0: streak(), next0: i < TOPICS.length - 1 ? unlocked(i + 1) : true }; showOv(); drawQ(); }
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
    L.opts = shuffle(it.opts);
    card = `<div class="w ${it.phrase ? "phrase" : ""}">${esc(it.pre)}<span class="q">${it.short ? "?" : "…"}</span>${esc(it.post)}</div><div class="h">${it.short ? (it.opts.some(o => o.length > 1) ? "Что пропущено?" : "Какая буква пропущена?") : "Как пишется?"}</div>`;
    below = `<div class="kbd" style="grid-template-columns:${it.short ? `repeat(${L.opts.length},1fr)` : "1fr"}">${L.opts.map((o, k) => `<button class="key ${it.short ? "" : "word"}" data-o="${k}">${esc(o)}</button>`).join("")}</div>`;
  } else if (it.kind === "stress") {
    card = `<div class="vw">${it.word.map((c, i) => it.vowels.includes(i) ? `<button class="v" data-v="${i}">${esc(c)}</button>` : `<span>${esc(c)}</span>`).join("")}</div><div class="h">Нажми на ударную гласную</div>`;
  } else {
    card = `<div class="sent">${it.words.map((w, i) => esc(w) + (i < it.words.length - 1 ? `<button class="gp" data-g="${i}" aria-label="Запятая после «${esc(w)}»"></button> ` : "")).join("")}</div><div class="h">Нажимай на промежутки, где нужна запятая</div>`;
    below = `<div class="kbd"><button class="btn" id="chk">Проверить</button></div>`;
  }
  box.innerHTML = topHTML() + `<div class="big" id="card"><span class="lbl">${esc(it.topic.name)}</span><button class="rl" id="rl">Правило</button>${card}</div>${below}<div id="after"></div>`;
  box.querySelector("#qx").onclick = () => quitLesson();
  box.querySelector("#rl").onclick = () => ruleSheet(it.topic);
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
    <div class="t">${ok ? "✓ Верно!" : "✕ Почти!"}<span>${ok ? `+${pts} зн.${L.combo >= 5 ? " · комбо ×1,5" : ""}` : "+0 зн."}</span></div>
    ${ok && !it.note ? "" : `<div class="ans">${ansHTML}</div>`}
    <div class="rr">${it.note ? esc(it.note) : ok ? "Так держать." : "Карточка вернётся через 10 минут."}${!ok && it.note ? " Карточка вернётся через 10 минут." : ""}<br><button id="rl2">Правило темы</button></div>
    <button class="btn" id="next">${last ? "Итоги" : ok ? "Дальше" : "Понятно"}</button></div>`;
  $("#rl2").onclick = () => ruleSheet(it.topic);
  $("#next").onclick = next;
  $("#next").focus({ preventScroll: true });
}
function next() { if (L.i < L.items.length - 1) { L.i++; drawQ(); } else finishLesson(); }
function finishLesson() {
  const ok = L.res.filter(Boolean).length, n = L.res.length;
  if (L.topic) { state.lessons[L.topic.id] = (state.lessons[L.topic.id] || 0) + 1; state.best[L.topic.id] = Math.max(state.best[L.topic.id] || 0, ok); }
  save(); syncSoon();
  const lv = lvl(), st = streak();
  const idx = L.topic ? TOPICS.indexOf(L.topic) : -1;
  const opened = idx >= 0 && idx < TOPICS.length - 1 && !L.next0 && unlocked(idx + 1);
  const msgs = [];
  if (lv.L > L.lv0) msgs.push(`Новый уровень: ${lv.L}!`);
  if (st > L.st0) msgs.push(`Огонёк: ${st} ${plural(st, "день", "дня", "дней")} подряд`);
  if (opened && TOPICS[idx + 1]) msgs.push(`Открыта тема «${TOPICS[idx + 1].name}»`);
  if (L.topic && ok < UNLOCK && idx < TOPICS.length - 1 && !unlocked(idx + 1)) msgs.push(`Набери ${UNLOCK} из ${LESSON}, чтобы открыть следующую тему`);
  const wrong = L.items.filter((_, i) => !L.res[i]);
  $("#ovIn").innerHTML = `<div class="fin">
    <div class="muted">${esc(L.title)}</div>
    <div class="score">${ok}/${n}</div>
    <h2>${ok === n ? "Идеально!" : ok >= UNLOCK ? "Отличный урок!" : "Хорошая тренировка"}</h2>
    <div class="tiles"><div class="tile"><b>+${L.pts}</b><small>знаков</small></div><div class="tile"><b>${Math.min(today().n, GOAL)}/${GOAL}</b><small>цель дня</small></div><div class="tile"><b>${st}</b><small>огонёк</small></div></div>
    ${msgs.map(m => `<div class="chip" style="margin-bottom:6px">${esc(m)}</div>`).join("")}
    ${wrong.length ? `<div class="sec" style="align-self:flex-start">Ошибки — вернутся на повторение</div><div class="mist">${wrong.map(it => `<div>${esc(correctText(it))}</div>`).join("")}</div>` : ""}
    <div class="btns" style="width:100%;max-width:420px"><button class="btn" id="done">Готово</button>${L.topic ? `<button class="btn gh" id="again">Ещё урок</button>` : ""}</div></div>`;
  $("#done").onclick = hideOv;
  const ag = $("#again"); if (ag) { const t = L.topic; ag.onclick = () => startLesson(t); }
}

/* ---------- Блиц: верно или ошибка ---------- */
let B = null;
function blitzPool() {
  const open = TOPICS.filter((t, i) => unlocked(i) && t.kind !== "commas");
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
  addDay(ok, ok ? 3 : 0); save();
  B.busy = true;
  $("#bcard").classList.add(ok ? "fo" : "fx");
  setTimeout(() => { if (!B) return; B.busy = false; B.i++; if (B.i >= B.seq.length || Date.now() >= B.end) return finishBlitz(); drawBlitz(); }, ok ? 220 : 650);
}
async function finishBlitz() {
  if (!B || B.done) return;
  B.done = true; clearTimeout(B.tm);
  const { ok, n, wrong, duel } = B;
  const best = ok > (state.blitzBest || 0); if (!duel && best) state.blitzBest = ok;
  save(); syncSoon();
  $("#ovIn").innerHTML = `<div class="fin"><div class="muted">${duel ? "Дуэль " + esc(duel.code) : "Блиц 60 секунд"}</div><div class="score">${ok}</div>
    <h2>${ok} ${plural(ok, "верный ответ", "верных ответа", "верных ответов")} из ${n}</h2>
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
    el.innerHTML = `<div class="split">${half(1, "p2", "Игрок 2")}${half(0, "p1", "Игрок 1")}</div><div class="mid">${D.i + 1}/10</div><button class="splitx" id="lx" aria-label="Выйти">✕</button>`;
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
  }).catch(e => console.warn("рейтинг:", e.message));
  return syncing;
}
setInterval(() => { if (document.visibilityState === "visible" && me.name) { syncScore(); if (tab === "friends" && $("#ov").hidden) loadBoard(); } }, 60000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { me = readMe() || me; render(); if (me.name) syncScore(); } });

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
      <form class="field" id="nickF"><input id="nick" maxlength="16" placeholder="Например, Грамотей" autocomplete="off"><button class="btn">Сохранить</button></form><div class="err" id="nickErr"></div></div>`;
    $("#nickF").onsubmit = e => { e.preventDefault(); setNick($("#nick").value, $("#nickErr")); };
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
      <div class="r ${p.id === me.id ? "me" : ""}"><span class="n">${i + 1}</span>${avaHTML(p.id, p.name, p.avatar)}<span class="nm">${esc(p.name)}${p.id === me.id ? " (ты)" : ""} ${statusOf(p.avatar)}<small>🔥 ${p.streak} · ур. ${p.level}</small></span><span class="sc">${fmt(p.pts)}</span></div>
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

/* ---------- Профиль ---------- */
function achievements() {
  const all = Object.values(state.items), words = all.filter(s => s.b >= 2).length;
  const maxStreak = (() => {
    let best = 0, cur = 0, prev = null;
    for (const k of Object.keys(state.days).sort()) {
      if (state.days[k].n < GOAL) { cur = 0; prev = null; continue; }
      const before = dayKey(new Date(new Date(k + "T12:00").getTime() - DAY));
      cur = prev === before ? cur + 1 : 1; prev = k; best = Math.max(best, cur);
    }
    return best;
  })();
  return [
    ["1", "Первый урок", Object.values(state.lessons).some(Boolean)],
    ["10", "10 верных подряд в уроке", Object.values(state.best).some(b => b >= 10)],
    ["7🔥", "Огонёк 7 дней", maxStreak >= 7],
    ["100", "100 слов выучено", words >= 100],
    ["Б", "Блиц на 25+", (state.blitzBest || 0) >= 25],
    ["★", "Все темы открыты", TOPICS.every((_, i) => unlocked(i)) && !prefs.allOpen]
  ];
}
function renderProfile() {
  const lv = lvl(), all = Object.values(state.items), n = all.reduce((a, s) => a + s.n, 0), ok = all.reduce((a, s) => a + s.ok, 0);
  const words = all.filter(s => s.b >= 2).length, ach = achievements();
  const heat = m => m >= .8 ? "var(--mi)" : m >= .4 ? "var(--le-d)" : m > 0 ? "var(--cor)" : "var(--line)";
  $("#view").innerHTML = `<div class="prof">${avaHTML(me.id, me.name || "Ты", myAv())}
      <div class="nm">${esc(me.name || "Без ника")} ${statusOf(myAv())}<button class="link" id="ren" style="font-size:13px">изменить</button></div>
      <div class="muted">Уровень ${lv.L} · до следующего ${lv.need - lv.cur} зн.</div>
      <div class="bar" style="max-width:280px;margin:10px auto 0"><s style="width:${Math.round(lv.cur / lv.need * 100)}%;background:var(--co)"></s></div>
      <div class="tiles3"><div class="tile"><b>${streak()}</b><small>огонёк</small></div><div class="tile"><b>${n ? Math.round(ok / n * 100) : 0}%</b><small>точность</small></div><div class="tile"><b>${fmt(words)}</b><small>выучено</small></div></div>
      <div class="ach">${ach.map(a => `<i class="${a[2] ? "on" : ""}" title="${esc(a[1])}">${a[0]}</i>`).join("")}</div>
      <div class="muted" style="font-size:12px">Награды: ${ach.filter(a => a[2]).length} из ${ach.length}. Нажми на кружок, чтобы узнать за что.</div></div>
    <div class="sec">Темы: зелёное — знаешь, жёлтое — учишь, красное — подтянуть</div>
    <div class="hgrid" id="hg">${TOPICS.map((t, i) => { const m = mastery(t); return `<button data-t="${i}" style="background:${heat(m)};${m ? "" : "color:var(--muted)"}">${esc(t.name)}<small>${Math.round(m * 100)}%</small></button>`; }).join("")}</div>
    <div class="sec">Настройки</div>
    <div class="card" style="display:grid;gap:10px">
      <label style="display:flex;gap:10px;align-items:center"><input type="checkbox" id="allOpen" ${prefs.allOpen ? "checked" : ""} style="width:20px;height:20px"> Открыть все темы сразу</label>
      <button class="link" id="reset" style="text-align:left;color:var(--cor)">Сбросить прогресс</button>
    </div>
    <p class="muted" style="font-size:12px;text-align:center">Ник и фото общие с «Формулографом». Фото и статус меняются там.</p>`;
  $("#ren").onclick = () => openSheet(`<h2>Ник</h2><form class="field" id="nf"><input id="nn" maxlength="16" value="${esc(me.name || "")}"><button class="btn">Сохранить</button></form><div class="err" id="ne"></div>`, s => {
    s.querySelector("#nf").onsubmit = async e => { e.preventDefault(); if (await setNick(s.querySelector("#nn").value, s.querySelector("#ne"))) { closeSheet(); toast("Ник сохранён"); } };
  });
  $("#hg").onclick = e => { const b = e.target.closest("[data-t]"); if (b) topicSheet(+b.dataset.t); };
  document.querySelectorAll(".ach i").forEach(i => i.onclick = () => toast(i.title + (i.classList.contains("on") ? " — получено" : " — ещё нет")));
  $("#allOpen").onchange = e => { prefs.allOpen = e.target.checked; savePrefs(); };
  $("#reset").onclick = () => openSheet(`<h2>Сбросить прогресс?</h2><p class="muted">Удалятся очки, выученные слова и огонёк на этом телефоне. Ник останется.</p><div class="btns"><button class="btn gh" id="no">Отмена</button><button class="btn" id="yes" style="background:var(--cor);box-shadow:none">Сбросить</button></div>`, s => {
    s.querySelector("#no").onclick = closeSheet;
    s.querySelector("#yes").onclick = () => { state = blank(); save(); closeSheet(); render(); toast("Прогресс сброшен"); };
  });
}

/* ---------- Клавиатура ---------- */
document.addEventListener("keydown", e => {
  if ($("#ov").hidden || !$("#shade").hidden) return;
  if (B && !B.done) { if (e.key === "ArrowLeft") blitzAns(false); if (e.key === "ArrowRight") blitzAns(true); return; }
  if (L && L.ans !== null && e.key === "Enter" && document.activeElement?.id !== "next") { e.preventDefault(); next(); }
});

/* ---------- Старт ---------- */
render();
if (me.name) { syncScore(); if (tab === "friends") loadBoard(); if (/^photo:/.test(me.avatar || "")) loadPhotos([{ player_id: me.id, avatar: me.avatar }]).then(r => r && render()); }
{
  const q = new URLSearchParams(location.search).get("duel") || prefs.pendingDuel;
  if (q) { delete prefs.pendingDuel; savePrefs(); history.replaceState(null, "", location.pathname); joinDuel(q); }
}
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
