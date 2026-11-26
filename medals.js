/* Медали «Орфографа». Картинки лежат в medals/: у трёхступенчатых — id_b / id_s / id_g, у остальных — id.
   Подключается после app.js: пользуется его state, TOPICS, ITEMS и помощниками. */
const TIER_NAME = { b: "Бронза", s: "Серебро", g: "Золото" };
const TIER_RANK = { b: 1, s: 2, g: 3 };
const RARITY = { "Обычная": "#9AA4BC", "Редкая": "#3F66F0", "Эпическая": "#8B5CFF", "Легендарная": "#E89200", "Секретная": "#141733" };
const MAX_PINS = 5;

/* ---------- Помощники ---------- */
const mDay = s => new Date(s + "T12:00");
const mWeekKey = s => { const d = mDay(s); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return dayKey(d); };
function maxStreakEver() {
  let best = 0, cur = 0, prev = null;
  for (const k of Object.keys(state.days).sort()) {
    if (state.days[k].n < GOAL) { cur = 0; prev = null; continue; }
    const before = dayKey(new Date(mDay(k).getTime() - DAY));
    cur = prev === before ? cur + 1 : 1; prev = k; best = Math.max(best, cur);
  }
  return Math.max(best, streak());
}
function topicStats(t) {
  let n = 0, ok = 0; for (const it of t.list) { const s = state.items[it.key]; if (s) { n += s.n; ok += s.ok; } }
  return { m: Math.round(mastery(t) * 100), acc: n ? Math.round(ok / n * 100) : 0, week: t.list.filter(it => itemState(it).b >= 4).length, total: t.list.length };
}
/* условия следующей ступени закладки: [название, сейчас, нужно, единица] */
function topicReqs(t) {
  const tr = topicTier(t), st = topicStats(t);
  if (!tr) return { tier: "b", reqs: [["Выучено", st.m, 60, "%"]] };
  if (tr === "b") return { tier: "s", reqs: [["Выучено", st.m, 90, "%"], ["Точность в теме", st.acc, 85, "%"]] };
  if (tr === "s") return { tier: "g", reqs: [["Вспомнено спустя неделю", st.week, st.total, " из " + st.total]] };
  return null;
}
function topicTier(t) {
  const m = mastery(t); let n = 0, ok = 0;
  for (const it of t.list) { const s = state.items[it.key]; if (s) { n += s.n; ok += s.ok; } }
  const acc = n ? ok / n : 0;
  if (t.list.every(it => itemState(it).b >= 4)) return "g";
  if (m >= .9 && acc >= .85) return "s";
  if (m >= .6) return "b";
  return null;
}
const bestPlace = obj => { const v = Object.values(obj || {}); return v.length ? Math.min(...v) : 0; };
const placeTier = p => p === 1 ? "g" : p === 2 ? "s" : p === 3 ? "b" : null;
const cntOf = k => (state.cnt || {})[k] || 0;

/* ---------- Список медалей ----------
   tiers: есть бронза/серебро/золото. check() → тир ("b"|"s"|"g") или "1" для одноступенчатых, или null.
   prog() → [сейчас, нужно] для полоски прогресса до следующей ступени. */
const MEDALS = [
  { id: "litera", group: "rank", name: "Литера дня", rar: "Редкая", tiers: true,
    cond: "1–3 место за день среди друзей. Нужно минимум 50 заданий в этот день и хотя бы 3 игрока в рейтинге дня.",
    check: () => placeTier(bestPlace(state.rank?.d)), prog: () => [Object.keys(state.rank?.d || {}).length, 1], progLabel: "призовых дней" },
  { id: "pero", group: "rank", name: "Перо недели", rar: "Эпическая", tiers: true,
    cond: "1–3 место за неделю. Нужно минимум 250 заданий за неделю и хотя бы 3 игрока.",
    check: () => placeTier(bestPlace(state.rank?.w)), prog: () => [Object.keys(state.rank?.w || {}).length, 1], progLabel: "призовых недель" },
  { id: "kniga", group: "rank", name: "Книга месяца", rar: "Легендарная", tiers: true,
    cond: "1–3 место за месяц. Нужно минимум 1000 заданий за месяц и хотя бы 3 игрока.",
    check: () => placeTier(bestPlace(state.rank?.m)), prog: () => [Object.keys(state.rank?.m || {}).length, 1], progLabel: "призовых месяцев" },
  { id: "mnogotochie", group: "rank", name: "Многоточие", quote: "Три точки — три недели", rar: "Легендарная",
    cond: "Золото недели три недели подряд.",
    check: () => goldWeeksRun() >= 3 ? "1" : null, prog: () => [goldWeeksRun(), 3], progLabel: "золотых недель подряд" },
  { id: "pyat", group: "rank", name: "Пять с плюсом", quote: "Красной ручкой в дневник", rar: "Легендарная",
    cond: "Золото дня все 7 дней одной недели, без единого пропуска.",
    check: () => bestGoldDaysInWeek() >= 7 ? "1" : null, prog: () => [bestGoldDaysInWeek(), 7], progLabel: "золотых дней за неделю" },
  ...TOPICS.map(t => ({ id: "t_" + t.id, group: "topic", topic: t, name: t.name, rar: "Редкая", tiers: true,
    quote: ({ stress: "ЗвонИт, а не звОнит", dict: "Ходячий словарь", prepri: "Прекрасно и прилежно", zsyi: "Бесподобно", roots: "Загорелый", yo: "Ёжик в тумане", nn: "Оловянный, стеклянный, деревянный", ne: "Ненаглядный", hyph: "Во-первых, в течение", paro: "Надеть пальто, одеть ребёнка", commas: "Казнить нельзя помиловать" })[t.id],
    cond: "Бронза — 60% темы выучено. Серебро — 90% и точность в теме от 85%. Золото — каждое задание темы правильно вспомнено спустя неделю и больше.",
    check: () => topicTier(t),
    prog: () => { const tr = topicTier(t); if (!tr) return [Math.round(mastery(t) * 100), 60]; if (tr === "b") return [Math.round(mastery(t) * 100), 90]; return [t.list.filter(it => itemState(it).b >= 4).length, t.list.length]; },
    progLabel: "% выучено" })),
  { id: "bukvar", group: "special", name: "Букварь", rar: "Обычная", cond: "10 пройденных уроков.",
    check: () => lessonsTotal() >= 10 ? "1" : null, prog: () => [lessonsTotal(), 10], progLabel: "уроков" },
  { id: "yat", group: "special", name: "Сдал на ять", quote: "Ять — высшая отметка", rar: "Эпическая", cond: "10 уроков подряд на 10 из 10, без единой ошибки.",
    check: () => (state.maxPerfectRun || 0) >= 10 ? "1" : null, prog: () => [state.maxPerfectRun || 0, 10], progLabel: "уроков подряд без ошибок" },
  { id: "roman", group: "special", name: "Рассказ · Повесть · Роман", rar: "Эпическая", tiers: true,
    cond: "Огонёк подряд: 14 дней — рассказ (бронза), 60 — повесть (серебро), 200 — роман (золото).",
    check: () => { const s = maxStreakEver(); return s >= 200 ? "g" : s >= 60 ? "s" : s >= 14 ? "b" : null; },
    prog: () => { const s = maxStreakEver(); return [s, s >= 60 ? 200 : s >= 14 ? 60 : 14]; }, progLabel: "дней подряд" },
  { id: "karl", group: "special", name: "Карл у Клары", quote: "Скороговорка", rar: "Эпическая", cond: "Блиц: 40 верных за 60 секунд и не больше 2 ошибок.",
    check: () => state.flags?.karl ? "1" : null, prog: () => [state.blitzBest || 0, 40], progLabel: "лучший блиц" },
  { id: "slovco", group: "special", name: "Острое словцо", quote: "Словесная дуэль", rar: "Эпическая", cond: "30 побед в онлайн-дуэлях, минимум над тремя разными друзьями.",
    check: () => (state.duels?.wins || 0) >= 30 && (state.duels?.opps || 0) >= 3 ? "1" : null, prog: () => [state.duels?.wins || 0, 30], progLabel: "побед" },
  { id: "oshibki", group: "special", name: "Работа над ошибками", quote: "Как в тетради", rar: "Редкая", cond: "100 слов, в которых ошибался, довести до «выучено».",
    check: () => fixedTraps() >= 100 ? "1" : null, prog: () => [fixedTraps(), 100], progLabel: "исправлено" },
  { id: "noch", group: "special", name: "Ночь, улица, фонарь, аптека", quote: "Блок", rar: "Редкая", cond: "5 уроков на 10 из 10 после 23:00.",
    check: () => cntOf("night") >= 5 ? "1" : null, prog: () => [cntOf("night"), 5], progLabel: "ночных уроков" },
  { id: "moroz", group: "special", name: "Мороз и солнце", quote: "Пушкин", rar: "Редкая", cond: "5 уроков на 10 из 10 до 7 утра.",
    check: () => cntOf("morning") >= 5 ? "1" : null, prog: () => [cntOf("morning"), 5], progLabel: "утренних уроков" },
  { id: "a_ya", group: "special", name: "От А до Я", rar: "Редкая", cond: "Урок на 10 из 10 в каждой из 11 тем.",
    check: () => TOPICS.every(t => (state.best[t.id] || 0) >= LESSON) ? "1" : null, prog: () => [TOPICS.filter(t => (state.best[t.id] || 0) >= LESSON).length, TOPICS.length], progLabel: "тем" },
  { id: "yofikator", group: "special", name: "Ёфикатор", quote: "Ё — не Е", rar: "Эпическая", cond: "Правильно ответить в заданиях с буквой Ё 300 раз.",
    check: () => cntOf("yo") >= 300 ? "1" : null, prog: () => [cntOf("yo"), 300], progLabel: "раз" },
  { id: "dal", group: "special", name: "Толковый словарь", quote: "Владимир Даль", rar: "Легендарная", cond: "Все задания приложения выучены — до последнего слова.",
    check: () => learnedAll() >= ITEMS.size ? "1" : null, prog: () => [learnedAll(), ITEMS.size], progLabel: "выучено" },
  { id: "voina", group: "special", name: "Война и мир", quote: "Четыре тома за раз", rar: "Эпическая", cond: "300 верных ответов за один день с точностью от 90%.",
    check: () => bestBigDay() >= 300 ? "1" : null, prog: () => [bestBigDay(), 300], progLabel: "верных за день" },
  { id: "rya", group: "special", name: "Великий и могучий", quote: "Тургенев", rar: "Легендарная", cond: "Все 11 закладок тем на золото.",
    check: () => TOPICS.every(t => topicTier(t) === "g") ? "1" : null, prog: () => [TOPICS.filter(t => topicTier(t) === "g").length, TOPICS.length], progLabel: "золотых закладок" },
  { id: "izhica", group: "special", name: "Ижица", quote: "Последняя буква старого алфавита", rar: "Секретная", secret: true, cond: "Секретная медаль. Условие узнаешь, когда получишь: подсказка — блиц.",
    condOpen: "Блиц на 35+ верных без единой ошибки.",
    check: () => state.flags?.izhica ? "1" : null, prog: () => [0, 1], progLabel: "" }
];
const MEDAL = Object.fromEntries(MEDALS.map(m => [m.id, m]));
const lessonsTotal = () => Object.values(state.lessons).reduce((a, b) => a + b, 0);
const fixedTraps = () => Object.values(state.items).filter(s => s.bad > 0 && s.b >= 2).length;
const learnedAll = () => Object.values(state.items).filter(s => s.b >= 2).length;
const bestBigDay = () => Math.max(0, ...Object.values(state.days).filter(d => d.n && d.ok / d.n >= .9).map(d => d.ok));
function goldWeeksRun() {
  const ws = Object.entries(state.rank?.w || {}).filter(([, p]) => p === 1).map(([w]) => w).sort();
  let best = 0, cur = 0, prev = null;
  for (const w of ws) { const before = dayKey(new Date(mDay(w).getTime() - 7 * DAY)); cur = prev === before ? cur + 1 : 1; prev = w; best = Math.max(best, cur); }
  return best;
}
function bestGoldDaysInWeek() {
  const by = {}; for (const [d, p] of Object.entries(state.rank?.d || {})) if (p === 1) { const w = mWeekKey(d); by[w] = (by[w] || 0) + 1; }
  return Math.max(0, ...Object.values(by));
}
const medalImg = (id, tier) => `medals/${MEDAL[id] && MEDAL[id].tiers ? `${id}_${tier && tier !== "1" ? tier : "b"}` : id}.webp`;

/* ---------- Проверка и выдача ---------- */
let medalQueue = [];
function checkMedals(silent) {
  state.medals = state.medals || {}; state.medalAt = state.medalAt || {};
  const fresh = [];
  for (const m of MEDALS) {
    const t = m.check(); if (!t) continue;
    const had = state.medals[m.id];
    if (!had || (m.tiers && TIER_RANK[t] > TIER_RANK[had])) { state.medals[m.id] = t; state.medalAt[m.id] = Date.now(); fresh.push(m.id); }
  }
  if (!fresh.length) return;
  // первая автоматическая расстановка: если витрина пустая, ставим свежие медали
  state.pins = (state.pins || []).filter(id => state.medals[id]);
  save(); syncSoon();
  if (!silent) { medalQueue.push(...fresh); if (!showMedalQueue.busy) showMedalQueue(); }
}
function showMedalQueue() {
  const id = medalQueue.shift(); if (!id) { showMedalQueue.busy = false; return; }
  if (!$("#ov").hidden || !$("#split").hidden) { medalQueue.unshift(id); showMedalQueue.busy = true; setTimeout(showMedalQueue, 1500); return; }
  showMedalQueue.busy = true;
  const m = MEDAL[id], t = state.medals[id], pinned = (state.pins || []).includes(id);
  openSheet(`<div class="newmedal"><div class="nm-glow"><img src="${medalImg(id, t)}" alt=""></div>
    <div class="muted">${m.tiers ? "Новая ступень" : "Новая медаль"}</div><h2>${esc(m.name)}${m.tiers ? ` · ${TIER_NAME[t]}` : ""}</h2>
    ${m.quote ? `<q>${esc(m.quote)}</q>` : ""}<p class="muted">${esc(m.condOpen || m.cond)}</p>
    <div class="btns">${pinned ? "" : `<button class="btn le" id="nmPin">Поставить в профиль</button>`}<button class="btn gh" id="nmOk">Круто!</button></div></div>`, s => {
    const done = () => { closeSheet(); setTimeout(showMedalQueue, 250); };
    s.querySelector("#nmOk").onclick = done;
    const p = s.querySelector("#nmPin"); if (p) p.onclick = () => { togglePin(id, true); done(); };
  });
}
function togglePin(id, quiet) {
  state.pins = state.pins || [];
  const i = state.pins.indexOf(id);
  if (i >= 0) state.pins.splice(i, 1);
  else { if (state.pins.length >= MAX_PINS) { toast(`В профиле максимум ${MAX_PINS} медалей — сначала убери одну`); return false; } state.pins.push(id); }
  save(); syncSoon(); if (!quiet) toast(i >= 0 ? "Убрано из профиля" : "Стоит в профиле"); if (tab === "profile") render();
  return true;
}

/* ---------- Места в рейтинге: раз в день по истории ru_scores ---------- */
async function refreshRankMedals(force) {
  if (!me.name) return;
  const today = dayKey();
  if (!force && prefs.rankAt === today) return;
  try {
    const from = dayKey(daysAgo(100));
    const rows = await api(`ru_scores?select=player_id,day,points,attempts&day=gte.${from}&day=lt.${today}&limit=5000`);
    const rank = state.rank || (state.rank = { d: {}, w: {}, m: {} });
    const curW = mWeekKey(today), curM = today.slice(0, 7);
    const agg = { d: new Map(), w: new Map(), m: new Map() };
    for (const r of rows || []) {
      const keys = { d: r.day, w: mWeekKey(r.day), m: r.day.slice(0, 7) };
      for (const k of ["d", "w", "m"]) {
        if (k === "w" && keys.w >= curW) continue;
        if (k === "m" && keys.m >= curM) continue;
        const map = agg[k].get(keys[k]) || new Map(); const p = map.get(r.player_id) || { pts: 0, att: 0 };
        p.pts += r.points; p.att += r.attempts; map.set(r.player_id, p); agg[k].set(keys[k], map);
      }
    }
    const need = { d: 50, w: 250, m: 1000 };
    for (const k of ["d", "w", "m"]) for (const [key, map] of agg[k]) {
      const active = [...map.values()].filter(v => v.pts > 0);
      const mine = map.get(me.id);
      if (active.length < 3 || !mine || mine.att < need[k] || mine.pts <= 0) continue;
      const place = 1 + active.filter(v => v.pts > mine.pts).length;
      if (place <= 3) rank[k][key] = place;
    }
    // дуэли: победы и разные соперники
    const myRes = await api(`ru_duel_results?select=code,correct&player_id=eq.${me.id}&limit=1000`);
    let wins = 0; const opps = new Set();
    const codes = (myRes || []).map(r => r.code);
    for (let i = 0; i < codes.length; i += 80) {
      const part = codes.slice(i, i + 80);
      const all = await api(`ru_duel_results?select=code,player_id,correct&code=in.(${part.join(",")})`);
      const by = new Map(); for (const r of all || []) { if (!by.has(r.code)) by.set(r.code, []); by.get(r.code).push(r); }
      for (const [, list] of by) {
        const mine = list.find(r => r.player_id === me.id), others = list.filter(r => r.player_id !== me.id);
        if (mine && others.length && others.every(o => mine.correct > o.correct)) { wins++; others.forEach(o => opps.add(o.player_id)); }
      }
    }
    state.duels = { wins, opps: opps.size };
    prefs.rankAt = today; savePrefs(); save();
    checkMedals(); checkCosmetics();
  } catch (e) { console.warn("медали:", e.message); }
}

/* ---------- Отрисовка ---------- */
function medalTile(id, opts = {}) {
  const m = MEDAL[id], t = (opts.medals || state.medals || {})[id];
  return `<button class="mtile ${t ? "" : "locked"}" data-medal="${id}"><img src="${medalImg(id, t || "b")}" alt="" loading="lazy"><span>${esc(m.secret && !t ? "???" : m.name)}${t && m.tiers ? `<small>${TIER_NAME[t]}</small>` : ""}</span></button>`;
}
function pinsHTML(pins, medals, editable) {
  const slots = [];
  for (let i = 0; i < MAX_PINS; i++) {
    const id = pins[i];
    if (id && MEDAL[id] && medals[id]) slots.push(`<button class="pin" data-medal="${id}" title="${esc(MEDAL[id].name)}"><img src="${medalImg(id, medals[id])}" alt="${esc(MEDAL[id].name)}"></button>`);
    else if (editable) slots.push(`<button class="pin empty" data-pickpin="1" aria-label="Выбрать медаль">+</button>`);
  }
  return slots.length ? `<div class="pins">${slots.join("")}</div>` : "";
}
function medalSheet(id, other) {
  const m = MEDAL[id], medals = other ? other.medals : state.medals || {}, t = medals[id];
  const mine = !other, pinned = (state.pins || []).includes(id);
  const [cur, need] = mine ? m.prog() : [0, 1];
  const next = m.tiers && t !== "g";
  const pct = Math.min(100, Math.round(cur / need * 100));
  const when = mine && state.medalAt?.[id] ? new Date(state.medalAt[id]).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) : "";
  openSheet(`<div class="msheet"><img class="${t ? "" : "locked"}" src="${medalImg(id, t || "b")}" alt="">
    <span class="rar" style="--rc:${RARITY[m.rar]}">${m.rar}</span>
    <h2>${esc(m.secret && !t ? "Секретная медаль" : m.name)}${t && m.tiers ? ` · ${TIER_NAME[t]}` : ""}</h2>
    ${m.quote && (t || !m.secret) ? `<q>${esc(m.quote)}</q>` : ""}
    <p>${esc(t && m.condOpen ? m.condOpen : m.cond)}</p>
    ${m.tiers ? `<div class="tiersrow">${["b", "s", "g"].map(x => `<img src="${medalImg(id, x)}" class="${t && TIER_RANK[t] >= TIER_RANK[x] ? "" : "locked"}" alt="${TIER_NAME[x]}">`).join("")}</div>` : ""}
    ${mine && m.group === "topic" ? topicReqsHTML(m.topic) : mine && (!t || next) && m.progLabel ? `<div class="bar"><s style="width:${pct}%;background:var(--co)"></s></div><div class="muted" style="font-size:13px">${fmt(cur)} / ${fmt(need)} ${m.progLabel}</div>` : ""}
    ${when ? `<div class="muted" style="font-size:13px;margin-top:6px">Получено ${when}</div>` : ""}
    <div class="btns">${mine && t ? `<button class="btn ${pinned ? "gh" : "le"}" id="msPin">${pinned ? "Убрать из профиля" : "Поставить в профиль"}</button>` : ""}<button class="btn gh" id="msCl">Закрыть</button></div></div>`, s => {
    s.querySelector("#msCl").onclick = closeSheet;
    const p = s.querySelector("#msPin"); if (p) p.onclick = () => { if (togglePin(id)) closeSheet(); };
  });
}
function topicReqsHTML(t) {
  const r = topicReqs(t);
  if (!r) return `<div class="reqs"><div class="req ok">✓ Все ступени получены</div></div>`;
  return `<div class="reqs"><div class="rq-h">До ступени «${TIER_NAME[r.tier]}»:</div>${r.reqs.map(([name, cur, need, unit]) => {
    const done = cur >= need, pct = Math.min(100, Math.round(cur / need * 100));
    return `<div class="req ${done ? "ok" : ""}"><div class="rq-t"><span>${done ? "✓" : "○"} ${name}</span><b>${unit === "%" ? `${cur}% из ${need}%` : `${cur}${unit}`}</b></div><div class="bar"><s style="width:${pct}%;background:${done ? "var(--mi)" : "var(--co)"}"></s></div></div>`;
  }).join("")}</div>`;
}
function pickPinSheet() {
  const got = MEDALS.filter(m => state.medals?.[m.id] && !(state.pins || []).includes(m.id));
  openSheet(`<h2>Поставить в профиль</h2><p class="muted" style="margin:4px 0 10px">${got.length ? "Выбери медаль — она встанет рядом с ником." : "Пока нечего ставить: получи первую медаль. Список всех медалей — ниже в профиле."}</p>
    <div class="mgrid">${got.map(m => medalTile(m.id)).join("")}</div><div class="btns"><button class="btn gh" id="ppCl">Закрыть</button></div>`, s => {
    s.querySelector("#ppCl").onclick = closeSheet;
    s.querySelectorAll("[data-medal]").forEach(b => b.onclick = () => { togglePin(b.dataset.medal); closeSheet(); });
  });
}
function medalsSectionHTML() {
  const got = MEDALS.filter(m => state.medals?.[m.id]).length;
  const grp = (g, title) => `<div class="sec">${title}</div><div class="mgrid">${MEDALS.filter(m => m.group === g).map(m => medalTile(m.id)).join("")}</div>`;
  return `<div class="card" id="medalsCard"><div class="ch"><h2>Медали</h2><span>${got} из ${MEDALS.length}</span></div>
    <p class="muted" style="margin:0 0 4px;font-size:14px">До ${MAX_PINS} медалей можно поставить в профиль — их увидят друзья. Нажми на медаль, чтобы узнать условие.</p>
    ${grp("rank", "За рейтинг среди друзей")}${grp("topic", "Закладки за темы")}${grp("special", "Особые")}</div>`;
}
function bindMedalClicks(root, other) {
  root.querySelectorAll("[data-medal]").forEach(b => b.onclick = () => medalSheet(b.dataset.medal, other));
  root.querySelectorAll("[data-pickpin]").forEach(b => b.onclick = pickPinSheet);
}
