/* Рамки аватарки и фоны профиля «Орфографа». Открываются за уровни и медали.
   Рамка — SVG поверх аватарки, viewBox 0 0 120 120, аватарка — круг r=40 в центре.
   Фон — SVG-полоса 360×140 в шапке профиля. */
const FRAMES = [
  { id: "none", name: "Без рамки", req: {} },
  { id: "ink", name: "Чернила", req: { lvl: 3 }, svg: () => `
    <circle cx="60" cy="60" r="45" fill="none" stroke="#1F3FBF" stroke-width="6"/>
    <circle cx="60" cy="60" r="50" fill="none" stroke="#1F3FBF" stroke-width="1.5" opacity=".5"/>
    <path d="M60 104 C54 112 54 118 60 118 C66 118 66 112 60 104Z" fill="#1F3FBF"/><circle cx="92" cy="96" r="3" fill="#1F3FBF"/><circle cx="99" cy="88" r="2" fill="#1F3FBF"/>` },
  { id: "notebook", name: "Тетрадь", req: { lvl: 5 }, svg: () => {
    let l = ""; for (let i = 0; i < 9; i++) l += `<line x1="8" x2="112" y1="${16 + i * 11}" y2="${16 + i * 11}" stroke="#9FB7E0" stroke-width="1.2"/>`;
    return `<defs><mask id="fmNb"><rect width="120" height="120" fill="#fff"/><circle cx="60" cy="60" r="41" fill="#000"/></mask></defs>
      <g mask="url(#fmNb)"><rect x="6" y="6" width="108" height="108" rx="22" fill="#FDFCF7" stroke="#C9D3E6" stroke-width="2"/>${l}<line x1="24" x2="24" y1="6" y2="114" stroke="#E0453A" stroke-width="2"/></g>
      <circle cx="60" cy="60" r="42" fill="none" stroke="#C9D3E6" stroke-width="2"/>`; } },
  { id: "alphabet", name: "Алфавит", req: { lvl: 10 }, svg: () => {
    const L = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ"; let t = "";
    for (let i = 0; i < L.length; i++) { const a = i / L.length * Math.PI * 2 - Math.PI / 2, x = 60 + 50 * Math.cos(a), y = 60 + 50 * Math.sin(a);
      t += `<text x="${x.toFixed(1)}" y="${(y + 3.5).toFixed(1)}" font-size="10" text-anchor="middle" font-family="Lora,serif" font-weight="700" fill="${i % 2 ? "#2F45E0" : "#E0453A"}" transform="rotate(${(a * 180 / Math.PI + 90).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})">${L[i]}</text>`; }
    return `<circle cx="60" cy="60" r="43" fill="none" stroke="#2F45E0" stroke-width="3"/>${t}`; } },
  { id: "quotes", name: "Ёлочки", req: { lvl: 15 }, svg: () => `
    <circle cx="60" cy="60" r="43" fill="none" stroke="#141733" stroke-width="3"/>
    <text x="6" y="78" font-size="58" font-family="Lora,serif" font-weight="700" fill="#141733">«</text>
    <text x="84" y="78" font-size="58" font-family="Lora,serif" font-weight="700" fill="#141733">»</text>` },
  { id: "neon", name: "Неоновая вывеска", req: { lvl: 20 }, svg: () => `
    <defs><filter id="fmGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <circle cx="60" cy="60" r="45" fill="none" stroke="#FF3DA5" stroke-width="3.5" filter="url(#fmGlow)"/>
    <circle cx="60" cy="60" r="51" fill="none" stroke="#2DE2E6" stroke-width="2" stroke-dasharray="14 6" filter="url(#fmGlow)"/>` },
  { id: "redpen", name: "Красная ручка", req: { medal: "oshibki" }, svg: () => `
    <path d="M22 40 C34 10 92 8 104 40 C116 72 92 108 58 106 C24 104 6 74 18 46 C22 36 30 30 38 27" fill="none" stroke="#E0453A" stroke-width="4.5" stroke-linecap="round"/>
    <g transform="translate(96 88) rotate(-35)"><rect x="-4" y="-22" width="8" height="30" rx="2" fill="#E0453A"/><path d="M-4 8 L0 18 L4 8Z" fill="#F2D7B6"/><path d="M-1.3 14 L0 18 L1.3 14Z" fill="#E0453A"/><rect x="-4" y="-22" width="8" height="6" fill="#9E1F1A"/></g>
    <text x="96" y="26" font-size="16" font-family="Caveat,cursive" font-weight="600" fill="#E0453A">5+</text>` },
  { id: "quill", name: "Золотое перо", req: { medal: "pero", tier: "g" }, svg: () => `
    <defs><linearGradient id="fmGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF09A"/><stop offset=".5" stop-color="#FFC21A"/><stop offset="1" stop-color="#C88400"/></linearGradient></defs>
    <circle cx="60" cy="60" r="45" fill="none" stroke="url(#fmGold)" stroke-width="7"/><circle cx="60" cy="60" r="45" fill="none" stroke="#A86000" stroke-width="1"/>
    <g transform="translate(92 30) rotate(30)"><path d="M0 30 C-12 12 -10 -14 4 -28 C10 -12 8 12 0 30Z" fill="#FFFDF2" stroke="#A86000" stroke-width="1.5"/><path d="M0 30 C2 10 3 -10 4 -28" stroke="#A86000" stroke-width="1" fill="none"/></g>` },
  { id: "laurel", name: "Лавровый венок", req: { medal: "yat" }, svg: () => {
    let o = ""; for (const side of [-1, 1]) for (let i = 0; i < 9; i++) { const a = (100 + i * 18) * Math.PI / 180, x = 60 + side * -48 * Math.cos(a), y = 60 + 48 * Math.sin(a);
      o += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="4.5" ry="10" fill="${i % 2 ? "#E8B53A" : "#F5C542"}" stroke="#A86000" stroke-width=".8" transform="rotate(${(side < 0 ? 100 + i * 18 - 70 : 70 - (100 + i * 18)).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`; }
    return `${o}<path d="M50 108 L60 102 L70 108" fill="none" stroke="#E0453A" stroke-width="4" stroke-linejoin="round"/>`; } },
  { id: "fire", name: "Огонёк", req: { medal: "roman", tier: "b" }, svg: () => {
    let f = ""; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, x = 60 + 46 * Math.cos(a), y = 60 + 46 * Math.sin(a), d = a * 180 / Math.PI + 90;
      f += `<path d="M0 -12 C6 -4 8 2 0 8 C-8 2 -6 -4 0 -12Z" fill="${i % 2 ? "#FF7A1A" : "#FFC233"}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${d.toFixed(0)})"/>`; }
    return `<circle cx="60" cy="60" r="43" fill="none" stroke="#FF5A1A" stroke-width="3"/>${f}`; } },
  { id: "dropcap", name: "Буквица", req: { medal: "rya" }, svg: () => `
    <defs><mask id="fmDc"><rect width="120" height="120" fill="#fff"/><circle cx="60" cy="60" r="41" fill="#000"/></mask></defs>
    <g mask="url(#fmDc)"><rect x="6" y="6" width="108" height="108" rx="6" fill="#8E1B12"/><rect x="11" y="11" width="98" height="98" rx="4" fill="none" stroke="#E8B53A" stroke-width="2"/>
      <path d="M16 16 q10 2 12 12 M104 16 q-10 2 -12 12 M16 104 q10 -2 12 -12 M104 104 q-10 -2 -12 -12" stroke="#E8B53A" stroke-width="2.5" fill="none"/>
      <circle cx="16" cy="16" r="3" fill="#E8B53A"/><circle cx="104" cy="16" r="3" fill="#E8B53A"/><circle cx="16" cy="104" r="3" fill="#E8B53A"/><circle cx="104" cy="104" r="3" fill="#E8B53A"/></g>
    <circle cx="60" cy="60" r="42" fill="none" stroke="#E8B53A" stroke-width="3"/>` }
];

const BGS = [
  { id: "none", name: "Обычный", req: {}, svg: () => "" },
  { id: "grid", name: "Тетрадь в клетку", req: { lvl: 2 }, svg: () => {
    let g = ""; for (let x = 0; x <= 360; x += 12) g += `<line x1="${x}" x2="${x}" y1="0" y2="140" stroke="#C6D6EE" stroke-width="1"/>`; for (let y = 0; y <= 140; y += 12) g += `<line x1="0" x2="360" y1="${y}" y2="${y}" stroke="#C6D6EE" stroke-width="1"/>`;
    return `<rect width="360" height="140" fill="#FBFCFF"/>${g}<line x1="320" x2="320" y1="0" y2="140" stroke="#E0453A" stroke-width="1.5"/>
      <text x="300" y="118" font-family="Caveat,cursive" font-size="26" fill="#E0453A" text-anchor="end">5</text>`; } },
  { id: "ruled", name: "Тетрадь в линейку", req: { lvl: 4 }, svg: () => {
    let g = ""; for (let y = 22; y < 140; y += 16) g += `<line x1="0" x2="360" y1="${y}" y2="${y}" stroke="#B9CBE8" stroke-width="1.2"/>`;
    return `<rect width="360" height="140" fill="#FFFEF8"/>${g}<line x1="34" x2="34" y1="0" y2="140" stroke="#E0453A" stroke-width="1.8"/>
      <text x="348" y="50" font-family="Caveat,cursive" font-size="24" fill="#3B3FD1" text-anchor="end">Классная работа</text>`; } },
  { id: "board", name: "Школьная доска", req: { lvl: 8 }, svg: () => `
    <rect width="360" height="140" fill="#2C4A3A"/><rect width="360" height="140" fill="url(#bgChalk)" opacity=".25"/>
    <defs><radialGradient id="bgChalk"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
    <g font-family="Caveat,cursive" fill="#F2F2E9" opacity=".9"><text x="348" y="44" font-size="28" text-anchor="end">жи-ши пиши с и</text><text x="348" y="80" font-size="24" text-anchor="end">ча-ща — с а</text><text x="20" y="128" font-size="20" opacity=".6">Двадцать пятое ноября</text></g>
    <rect x="0" y="132" width="360" height="8" fill="#8A6A44"/><rect x="290" y="126" width="22" height="6" rx="2" fill="#F2F2E9"/>` },
  { id: "news", name: "Газетная полоса", req: { lvl: 12 }, svg: () => {
    let c = ""; for (let col = 0; col < 3; col++) for (let i = 0; i < 6; i++) c += `<rect x="${200 + col * 54}" y="${54 + i * 12}" width="${i === 5 ? 26 : 46}" height="4" fill="#1A1A1A" opacity=".35"/>`;
    return `<rect width="360" height="140" fill="#ECE9E1"/><text x="200" y="38" font-family="Old Standard TT,Georgia,serif" font-weight="700" font-size="26" fill="#1A1A1A">ГРАМОТЕЙ</text>
      <line x1="200" x2="352" y1="44" y2="44" stroke="#1A1A1A" stroke-width="2"/>${c}<text x="352" y="18" font-family="Georgia,serif" font-size="9" fill="#1A1A1A" text-anchor="end">№ 1 · экстренный выпуск</text>`; } },
  { id: "letters", name: "Буквы-созвездия", req: { lvl: 18 }, svg: () => {
    let s = 7; const r = () => (s = s * 16807 % 2147483647) / 2147483647; let st = "";
    for (let i = 0; i < 70; i++) st += `<circle cx="${(r() * 360).toFixed(0)}" cy="${(r() * 140).toFixed(0)}" r="${(.5 + r() * 1.3).toFixed(1)}" fill="#fff" opacity="${(.3 + r() * .7).toFixed(2)}"/>`;
    const A = [[230, 110], [250, 40], [270, 110], [238, 82], [262, 82]], Ya = [[300, 110], [300, 40], [330, 40], [330, 72], [300, 72], [330, 110]];
    const line = pts => `<polyline points="${pts.map(p => p.join(",")).join(" ")}" fill="none" stroke="#9DB2FF" stroke-width="1.2" opacity=".7"/>` + pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="2.6" fill="#FFE27A"/>`).join("");
    return `<defs><linearGradient id="bgSky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1B1E4B"/><stop offset="1" stop-color="#3A2A6E"/></linearGradient></defs><rect width="360" height="140" fill="url(#bgSky)"/>${st}${line([A[0], A[1], A[2]])}${line([A[3], A[4]])}${line(Ya)}`; } },
  { id: "library", name: "Библиотека", req: { lvl: 25 }, svg: () => {
    let s = 3; const r = () => (s = s * 16807 % 2147483647) / 2147483647; let b = "";
    const C = ["#8E1B12", "#2F45E0", "#16A66B", "#C88400", "#6B3BE6", "#3A2414", "#C8502D"];
    for (const y of [10, 56, 102]) { let x = 4; while (x < 356) { const w = 8 + r() * 12, h = 30 + r() * 12; b += `<rect x="${x.toFixed(0)}" y="${(y + 40 - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" rx="1.5" fill="${C[Math.floor(r() * C.length)]}"/><rect x="${(x + 2).toFixed(0)}" y="${(y + 46 - h).toFixed(0)}" width="${(w - 4).toFixed(0)}" height="2" fill="#E8B53A" opacity=".8"/>`; x += w + 1.5; }
      b += `<rect x="0" y="${y + 40}" width="360" height="6" fill="#6B4A2B"/>`; }
    return `<rect width="360" height="140" fill="#3A2716"/>${b}`; } },
  { id: "parchment", name: "Летопись", req: { medal: "kniga" }, svg: () => `
    <defs><radialGradient id="bgPar" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#F8EED6"/><stop offset="1" stop-color="#D9C08E"/></radialGradient></defs>
    <rect width="360" height="140" fill="url(#bgPar)"/><text x="300" y="104" font-family="Ruslan Display,Lora,serif" font-size="92" fill="#8E1B12" opacity=".85" text-anchor="middle">Ѣ</text>
    <g font-family="Ruslan Display,Lora,serif" font-size="13" fill="#3A2414" opacity=".55"><text x="246" y="30" text-anchor="end">Повесть временных лет</text></g>
    <path d="M190 120 q40 -14 80 0 t80 0" stroke="#8E1B12" stroke-width="1.5" fill="none" opacity=".6"/>` },
  { id: "telegram", name: "Телеграмма", req: { medal: "slovco" }, svg: () => `
    <rect width="360" height="140" fill="#E7DCC4"/>
    <g transform="rotate(-4 270 70)"><rect x="196" y="28" width="150" height="34" fill="#FBF6EA" stroke="#D2C3A1"/><text x="271" y="50" font-family="PT Mono,monospace" font-size="11" text-anchor="middle" fill="#2B2118">ПОБЕДА ДУЭЛИ ТЧК</text></g>
    <g transform="rotate(8 300 100)" opacity=".8"><rect x="262" y="78" width="80" height="34" rx="5" fill="none" stroke="#A8392A" stroke-width="3"/><text x="302" y="101" font-family="PT Mono,monospace" font-weight="700" font-size="15" text-anchor="middle" fill="#A8392A">МОЛНИЯ</text></g>
    <path d="M0 132 h360" stroke="#2B2118" stroke-width="2" stroke-dasharray="14 6 3 6"/>` },
  { id: "gold", name: "Великий и могучий", req: { medal: "rya" }, svg: () => {
    let rays = ""; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; rays += `<path d="M280 70 L${(280 + 260 * Math.cos(a - .06)).toFixed(0)} ${(70 + 260 * Math.sin(a - .06)).toFixed(0)} L${(280 + 260 * Math.cos(a + .06)).toFixed(0)} ${(70 + 260 * Math.sin(a + .06)).toFixed(0)}Z" fill="#fff" opacity=".12"/>`; }
    return `<defs><linearGradient id="bgGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE48A"/><stop offset=".5" stop-color="#F5B82E"/><stop offset="1" stop-color="#C88400"/></linearGradient></defs>
      <rect width="360" height="140" fill="url(#bgGold)"/>${rays}<text x="280" y="92" font-family="Unbounded,sans-serif" font-weight="800" font-size="56" fill="#A86000" opacity=".55" text-anchor="middle">РЯ</text>`; } }
];

/* Условие словами */
function reqText(req) {
  if (req.lvl) return `${req.lvl} уровень`;
  if (req.medal) { const m = typeof MEDAL !== "undefined" ? MEDAL[req.medal] : null; const n = m ? m.name : req.medal;
    return `медаль «${n}»${req.tier ? ` (${({ b: "бронза", s: "серебро", g: "золото" })[req.tier]})` : ""}`; }
  return "есть у всех";
}

/* ---------- В приложении ---------- */
const FRAME = Object.fromEntries(FRAMES.map(f => [f.id, f])), BG = Object.fromEntries(BGS.map(b => [b.id, b]));
const otherCos = new Map(); // id игрока → { frame, bg }
function cosUnlocked(req) {
  if (req.lvl) return lvl().L >= req.lvl;
  if (req.medal) { const have = (state.medals || {})[req.medal]; return !!have && (!req.tier || (TIER_RANK[have] || 0) >= TIER_RANK[req.tier]); }
  return true;
}
const myFrame = () => FRAME[state.frame] && cosUnlocked(FRAME[state.frame].req) ? state.frame : "none";
const myBg = () => BG[state.bg] && cosUnlocked(BG[state.bg].req) ? state.bg : "none";
const frameOf = id => id === me.id ? myFrame() : (otherCos.get(id) || {}).frame || "none";
const frameSVG = fid => { const f = FRAME[fid]; return f && f.svg ? `<svg class="frm" viewBox="0 0 120 120" aria-hidden="true">${f.svg()}</svg>` : ""; };
const bgSVG = bid => { const b = BG[bid]; return b && bid !== "none" ? `<svg class="pbg" viewBox="0 0 360 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${b.svg()}</svg>` : ""; };
function checkCosmetics() {
  const was = new Set(state.cosSeen || []), now = [...FRAMES, ...BGS].filter(x => x.id !== "none" && cosUnlocked(x.req)).map(x => (FRAME[x.id] === x ? "f:" : "b:") + x.id);
  const fresh = now.filter(k => !was.has(k));
  state.cosSeen = now;
  if (fresh.length && state.cosInit) { const k = fresh[0], x = k[0] === "f" ? FRAME[k.slice(2)] : BG[k.slice(2)]; toast(`Открыт${k[0] === "f" ? "а рамка" : " фон"} «${x.name}»${fresh.length > 1 ? ` и ещё ${fresh.length - 1}` : ""} — выбери в профиле`); }
  state.cosInit = true; save();
}
function cosmeticsCardHTML() {
  const fr = myFrame(), bg = myBg();
  const tile = (x, kind, cur) => { const open = cosUnlocked(x.req);
    const pv = kind === "f" ? `<span class="cpv">${avaHTML(me.id, me.name || "Ты", myAv(), "", x.id)}</span>` : `<span class="cpv bgpv">${x.id === "none" ? "" : bgSVG(x.id)}</span>`;
    return `<button class="ctile ${open ? "" : "locked"}" data-${kind}="${x.id}" aria-pressed="${x.id === cur}">${pv}<b>${esc(x.name)}</b><small>${open ? (x.id === cur ? "выбрано" : "открыто") : "🔒 " + esc(reqText(x.req))}</small></button>`; };
  return `<div class="card"><h2>Рамка аватарки</h2><p class="muted" style="margin:4px 0 0;font-size:14px">Видна в рейтинге и в профиле. Открываются за уровни и медали.</p>
      <div class="cgrid">${FRAMES.map(f => tile(f, "f", fr)).join("")}</div></div>
    <div class="card"><h2>Фон профиля</h2><p class="muted" style="margin:4px 0 0;font-size:14px">Стоит в шапке профиля — его видят друзья.</p>
      <div class="cgrid wide">${BGS.map(b => tile(b, "b", bg)).join("")}</div></div>`;
}
function bindCosmetics(root) {
  root.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { const f = FRAME[b.dataset.f]; if (!cosUnlocked(f.req)) return toast(`Рамка откроется: ${reqText(f.req)}`); state.frame = f.id; save(); syncSoon(); render(); });
  root.querySelectorAll("[data-b]").forEach(b => b.onclick = () => { const g = BG[b.dataset.b]; if (!cosUnlocked(g.req)) return toast(`Фон откроется: ${reqText(g.req)}`); state.bg = g.id; save(); syncSoon(); render(); });
}
