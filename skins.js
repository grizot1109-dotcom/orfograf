/* Оформления «Орфографа»: цвета задаются в index.html через :root[data-skin=…],
   а здесь — рисунки на карте тем. Рисунки — простые SVG, размер s ≈ высота фигуры в px. */
const SKINS = [
  { id: "classic", name: "Классика", note: "буквы алфавита", sw: ["#EEF0FB", "#2F45E0", "#FFD84D"] },
  { id: "notebook", name: "Тетрадь", note: "каракули на полях", sw: ["#FBFAF5", "#3B3FD1", "#E04B3F"] },
  { id: "space", name: "Космос", note: "звёзды и планеты", sw: ["#0B0D24", "#7C5CFF", "#FFD84D"] },
  { id: "forest", name: "Лес", note: "ёлки и грибы", sw: ["#E6F1DC", "#2F8A4C", "#C9A97A"] },
  { id: "sea", name: "Море", note: "волны, рыбы, острова", sw: ["#DFF1FA", "#0F7CC4", "#F2C46D"] },
  { id: "winter", name: "Зима", note: "снег и снеговики", sw: ["#EDF3FA", "#3D7BD9", "#FFFFFF"] }
];

const DRAW = {
  /* ---- Классика ---- */
  letter(x, y, s, r) {
    const L = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ";
    return `<text x="${x}" y="${y + s / 3}" font-size="${s * 1.6}" transform="rotate(${-20 + r() * 40} ${x} ${y})" class="d-let">${L[Math.floor(r() * L.length)]}</text>`;
  },
  /* ---- Тетрадь ---- */
  star(x, y, s) {
    let p = ""; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, R = i % 2 ? s * .22 : s * .5; p += (i ? "L" : "M") + (x + R * Math.cos(a)).toFixed(1) + "," + (y + R * Math.sin(a)).toFixed(1); }
    return `<path d="${p}Z" class="d-ink"/>`;
  },
  spiral(x, y, s) {
    let p = `M${x},${y}`; for (let t = 0; t < 14; t += .3) { const R = t / 14 * s * .5; p += `L${(x + R * Math.cos(t)).toFixed(1)},${(y + R * Math.sin(t)).toFixed(1)}`; }
    return `<path d="${p}" class="d-ink"/>`;
  },
  heart(x, y, s) {
    const k = s / 30;
    return `<path d="M${x},${y + 10 * k} C${x - 16 * k},${y - 2 * k} ${x - 8 * k},${y - 14 * k} ${x},${y - 5 * k} C${x + 8 * k},${y - 14 * k} ${x + 16 * k},${y - 2 * k} ${x},${y + 10 * k}Z" class="d-red"/>`;
  },
  smile(x, y, s) {
    const R = s * .45;
    return `<circle cx="${x}" cy="${y}" r="${R}" class="d-ink"/><circle cx="${x - R * .35}" cy="${y - R * .25}" r="1.6" class="d-inkf"/><circle cx="${x + R * .35}" cy="${y - R * .25}" r="1.6" class="d-inkf"/><path d="M${x - R * .5},${y + R * .2} Q${x},${y + R * .75} ${x + R * .5},${y + R * .2}" class="d-ink"/>`;
  },
  arrow(x, y, s, r) {
    const d = r() < .5 ? 1 : -1;
    return `<path d="M${x - s * .6 * d},${y + s * .2} Q${x},${y - s * .5} ${x + s * .6 * d},${y}" class="d-ink"/><path d="M${x + s * .6 * d - 8 * d},${y - 7} L${x + s * .6 * d},${y} L${x + s * .6 * d - 9 * d},${y + 5}" class="d-ink"/>`;
  },
  word(x, y, s, r) {
    const W = ["5+", "Ура!", "жи-ши", "!", "?!", "ча-ща", "А+", "молодец", "5"];
    const red = r() < .5;
    return `<text x="${x}" y="${y + s * .25}" font-size="${s * .8}" text-anchor="middle" transform="rotate(${-14 + r() * 28} ${x} ${y})" class="${red ? "d-redt" : "d-inkt"}">${W[Math.floor(r() * W.length)]}</text>`;
  },
  /* ---- Космос ---- */
  dot(x, y, s, r) { return `<circle cx="${x}" cy="${y}" r="${(.6 + r() * 1.4).toFixed(1)}" fill="#fff" opacity="${(.3 + r() * .7).toFixed(2)}"/>`; },
  sparkle(x, y, s) {
    const a = s * .5, b = s * .1;
    return `<path d="M${x},${y - a} Q${x + b},${y - b} ${x + a},${y} Q${x + b},${y + b} ${x},${y + a} Q${x - b},${y + b} ${x - a},${y} Q${x - b},${y - b} ${x},${y - a}Z" fill="#FFF3B0"/>`;
  },
  planet(x, y, s, r) {
    const C = ["#FF8A5B", "#5ED3C7", "#F2C14E", "#B28DFF", "#FF6FA5"], c = C[Math.floor(r() * C.length)], R = s * .42, ring = r() < .6;
    return `<g transform="rotate(${-25 + r() * 50} ${x} ${y})">${ring ? `<ellipse cx="${x}" cy="${y}" rx="${R * 1.7}" ry="${R * .45}" fill="none" stroke="${c}" stroke-width="3" opacity=".55"/>` : ""}
      <circle cx="${x}" cy="${y}" r="${R}" fill="${c}"/><path d="M${x - R},${y} A${R},${R} 0 0 0 ${x + R},${y} Z" fill="rgba(0,0,0,.18)"/>
      ${ring ? `<path d="M${x - R * 1.7},${y} A${R * 1.7},${R * .45} 0 0 0 ${x + R * 1.7},${y}" fill="none" stroke="${c}" stroke-width="3"/>` : `<circle cx="${x - R * .35}" cy="${y - R * .3}" r="${R * .18}" fill="rgba(0,0,0,.15)"/>`}</g>`;
  },
  moon(x, y, s) {
    const R = s * .45;
    return `<path d="M${x + R * .3},${y - R} A${R},${R} 0 1 0 ${x + R * .3},${y + R} A${R * .75},${R * .75} 0 1 1 ${x + R * .3},${y - R}Z" fill="#FFE59A"/>`;
  },
  comet(x, y, s) {
    return `<path d="M${x - s * 1.4},${y - s * .5} L${x},${y - 3} L${x},${y + 3} Z" fill="url(#cometG)"/><circle cx="${x}" cy="${y}" r="${s * .14}" fill="#fff"/>`;
  },
  rocket(x, y, s) {
    const k = s / 40;
    return `<g transform="translate(${x},${y}) rotate(35) scale(${k})"><path d="M0,-20 C9,-10 9,8 6,14 L-6,14 C-9,8 -9,-10 0,-20Z" fill="#EEF0FF"/><circle cx="0" cy="-4" r="4" fill="#5ED3C7"/><path d="M-6,6 L-12,16 L-6,14Z M6,6 L12,16 L6,14Z" fill="#FF6FA5"/><path d="M-4,14 L0,24 L4,14Z" fill="#FFB547"/></g>`;
  },
  /* ---- Лес ---- */
  pine(x, y, s, r) {
    const g = r() < .5 ? "#2E7D46" : "#3C9656", d = "#1F5E34", w = s * .45;
    return `<rect x="${x - s * .05}" y="${y + s * .3}" width="${s * .1}" height="${s * .22}" fill="#7A5230"/>
      <path d="M${x},${y - s * .55} L${x + w * .6},${y - s * .1} L${x - w * .6},${y - s * .1}Z" fill="${g}"/>
      <path d="M${x},${y - s * .35} L${x + w * .8},${y + s * .12} L${x - w * .8},${y + s * .12}Z" fill="${g}"/>
      <path d="M${x},${y - s * .12} L${x + w},${y + s * .34} L${x - w},${y + s * .34}Z" fill="${g}"/>
      <path d="M${x},${y - s * .12} L${x + w},${y + s * .34} L${x},${y + s * .34}Z" fill="${d}" opacity=".35"/>`;
  },
  bush(x, y, s) {
    const R = s * .22;
    return `<circle cx="${x - R}" cy="${y + R * .4}" r="${R}" fill="#4FA862"/><circle cx="${x + R}" cy="${y + R * .4}" r="${R}" fill="#43995A"/><circle cx="${x}" cy="${y - R * .2}" r="${R * 1.2}" fill="#5BB86E"/><circle cx="${x + R * .4}" cy="${y - R * .5}" r="2" fill="#E0567F"/>`;
  },
  mushroom(x, y, s) {
    const k = s / 30;
    return `<rect x="${x - 3 * k}" y="${y}" width="${6 * k}" height="${10 * k}" rx="${2 * k}" fill="#F3E6CF"/><path d="M${x - 12 * k},${y + 1} A${12 * k},${10 * k} 0 0 1 ${x + 12 * k},${y + 1}Z" fill="#E2483C"/>
      <circle cx="${x - 5 * k}" cy="${y - 4 * k}" r="${1.8 * k}" fill="#fff"/><circle cx="${x + 4 * k}" cy="${y - 6 * k}" r="${1.5 * k}" fill="#fff"/><circle cx="${x + 1 * k}" cy="${y - 2 * k}" r="${1.2 * k}" fill="#fff"/>`;
  },
  grass(x, y, s) {
    return `<path d="M${x - 8},${y + 6} Q${x - 6},${y - 4} ${x - 10},${y - 10} M${x},${y + 6} Q${x},${y - 6} ${x + 2},${y - 14} M${x + 7},${y + 6} Q${x + 6},${y - 3} ${x + 11},${y - 8}" stroke="#5BA866" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  },
  flower(x, y, s, r) {
    const c = ["#FFD84D", "#FF8FB1", "#B9A2FF", "#fff"][Math.floor(r() * 4)];
    let p = ""; for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; p += `<circle cx="${(x + 5 * Math.cos(a)).toFixed(1)}" cy="${(y + 5 * Math.sin(a)).toFixed(1)}" r="4" fill="${c}"/>`; }
    return `<path d="M${x},${y + 4} L${x},${y + 16}" stroke="#4E9A5C" stroke-width="2"/>${p}<circle cx="${x}" cy="${y}" r="3" fill="#E8902C"/>`;
  },
  /* ---- Море ---- */
  wave(x, y, s) {
    let p = `M${x - s},${y}`; for (let i = 0; i < 4; i++) p += ` q${s / 4},-${s * .18} ${s / 2},0`;
    return `<path d="${p}" class="d-wave"/>`;
  },
  fish(x, y, s, r) {
    const c = ["#FF8A5B", "#F2C14E", "#FF6FA5", "#5ED3C7"][Math.floor(r() * 4)], d = r() < .5 ? 1 : -1, k = s / 30;
    return `<g transform="translate(${x},${y}) scale(${d * k},${k})"><path d="M-14,0 Q0,-11 12,0 Q0,11 -14,0Z" fill="${c}"/><path d="M-12,0 L-22,-8 L-20,0 L-22,8Z" fill="${c}"/><circle cx="6" cy="-2" r="1.8" fill="#0F2A3D"/></g>`;
  },
  island(x, y, s) {
    const k = s / 50;
    return `<g transform="translate(${x},${y}) scale(${k})"><ellipse cx="0" cy="14" rx="30" ry="9" fill="#F2C46D"/><path d="M-2,12 Q2,-6 8,-22" stroke="#8A5A2B" stroke-width="4" fill="none"/>
      <path d="M8,-22 Q-6,-30 -18,-20 Q-4,-24 8,-22Z M8,-22 Q22,-32 30,-18 Q18,-24 8,-22Z M8,-22 Q0,-14 -6,-6 Q2,-16 8,-22Z M8,-22 Q20,-14 22,-4 Q14,-16 8,-22Z" fill="#2F9E5B"/></g>`;
  },
  gull(x, y, s) { return `<path d="M${x - s * .4},${y} Q${x - s * .2},${y - s * .25} ${x},${y} Q${x + s * .2},${y - s * .25} ${x + s * .4},${y}" stroke="#3E6C88" stroke-width="2" fill="none" stroke-linecap="round"/>`; },
  boat(x, y, s) {
    const k = s / 40;
    return `<g transform="translate(${x},${y}) scale(${k})"><path d="M-18,4 L18,4 L12,14 L-12,14Z" fill="#C8502D"/><path d="M0,4 L0,-22" stroke="#6B4A2B" stroke-width="2.5"/><path d="M2,-20 L16,0 L2,0Z" fill="#fff"/><path d="M-2,-16 L-12,0 L-2,0Z" fill="#F2F2F2"/></g>`;
  },
  /* ---- Зима ---- */
  flake(x, y, s, r) {
    const R = s * .45; let p = "";
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3, ex = x + R * Math.cos(a), ey = y + R * Math.sin(a); p += `M${x},${y} L${ex.toFixed(1)},${ey.toFixed(1)} `;
      const mx = x + R * .6 * Math.cos(a), my = y + R * .6 * Math.sin(a);
      p += `M${mx.toFixed(1)},${my.toFixed(1)} L${(mx + R * .25 * Math.cos(a + .8)).toFixed(1)},${(my + R * .25 * Math.sin(a + .8)).toFixed(1)} M${mx.toFixed(1)},${my.toFixed(1)} L${(mx + R * .25 * Math.cos(a - .8)).toFixed(1)},${(my + R * .25 * Math.sin(a - .8)).toFixed(1)} `; }
    return `<path d="${p}" class="d-flake" transform="rotate(${r() * 60} ${x} ${y})"/>`;
  },
  snowfir(x, y, s) {
    const w = s * .45;
    return `<rect x="${x - s * .05}" y="${y + s * .3}" width="${s * .1}" height="${s * .2}" fill="#7A5230"/>
      <path d="M${x},${y - s * .55} L${x + w * .7},${y} L${x - w * .7},${y}Z" fill="#2F7A5A"/><path d="M${x},${y - s * .25} L${x + w},${y + s * .32} L${x - w},${y + s * .32}Z" fill="#2F7A5A"/>
      <path d="M${x},${y - s * .55} L${x + w * .3},${y - s * .3} Q${x},${y - s * .22} ${x - w * .3},${y - s * .3}Z" fill="#fff"/>
      <path d="M${x - w},${y + s * .32} Q${x},${y + s * .2} ${x + w},${y + s * .32}Z M${x - w * .7},${y} Q${x},${y - s * .1} ${x + w * .7},${y}Z" fill="#fff"/>`;
  },
  snowman(x, y, s) {
    const k = s / 40;
    return `<g transform="translate(${x},${y}) scale(${k})"><circle cx="0" cy="10" r="11" fill="#fff" stroke="#C9D8EA"/><circle cx="0" cy="-7" r="8" fill="#fff" stroke="#C9D8EA"/>
      <circle cx="-3" cy="-9" r="1.3" fill="#17243A"/><circle cx="3" cy="-9" r="1.3" fill="#17243A"/><path d="M0,-6 L7,-5 L0,-4Z" fill="#F28C28"/>
      <path d="M-8,-14 L8,-14 L6,-22 L-6,-22Z" fill="#2F45E0"/><path d="M-7,-1 L7,-1" stroke="#E0567F" stroke-width="3"/></g>`;
  },
  drift(x, y, s) { return `<ellipse cx="${x}" cy="${y + s * .2}" rx="${s * .9}" ry="${s * .25}" fill="#fff"/>`; }
};

/* Какие рисунки и сколько — для каждого оформления */
const DECOR = {
  classic: { gap: ["letter"], free: ["letter"], freeN: 0 },
  notebook: { gap: ["star", "spiral", "heart", "smile", "arrow", "word", "word"], free: [], freeN: 0 },
  space: { gap: ["planet", "sparkle", "moon", "comet", "sparkle", "rocket"], free: ["dot"], freeN: 4 },
  forest: { gap: ["pine", "pine", "bush", "mushroom", "grass", "flower", "pine"], free: ["grass"], freeN: .12 },
  sea: { gap: ["wave", "fish", "island", "gull", "boat", "wave", "fish"], free: ["wave"], freeN: .18 },
  winter: { gap: ["snowfir", "snowman", "flake", "drift", "snowfir", "flake"], free: ["flake"], freeN: .45 }
};
const SIZE = { letter: 44, star: 28, spiral: 26, heart: 26, smile: 28, arrow: 34, word: 26, sparkle: 18, planet: 40, moon: 30, comet: 22, rocket: 40, pine: 46, bush: 36, mushroom: 30, grass: 20, flower: 18, wave: 34, fish: 28, island: 56, gull: 22, boat: 40, flake: 18, snowfir: 46, snowman: 42, drift: 40, dot: 2 };

function decorSVG(skin, W, H, gaps) {
  const D = DECOR[skin] || DECOR.classic;
  let seed = 7 + skin.length * 13; const r = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  const draw = (kind, x, y, s) => DRAW[kind](Math.round(x), Math.round(y), s, r);
  let out = "";
  // свободные мелкие рисунки по всему полю (звёзды, снежинки)
  const nFree = Math.round(W * H / 10000 * D.freeN);
  for (let i = 0; i < nFree; i++) { const k = D.free[Math.floor(r() * D.free.length)]; out += draw(k, r() * W, r() * H, SIZE[k] * (.6 + r() * .6)); }
  // крупные рисунки в просветах между темами и по краям
  gaps.forEach((y, gi) => {
    const slots = skin === "classic" ? [gi % 2 ? .1 : .9] : [.06 + r() * .14, .4 + r() * .2, .8 + r() * .14];
    for (const fx of slots) {
      if (skin !== "classic" && r() < .25) continue;
      const k = D.gap[Math.floor(r() * D.gap.length)];
      out += draw(k, fx * W, y + (r() - .5) * 10, SIZE[k] * (.8 + r() * .4));
    }
  });
  return out;
}
