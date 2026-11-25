/* Оформления «Орфографа»: цвета задаются в index.html через :root[data-skin=…],
   а здесь — рисунки на карте тем. Рисунки — простые SVG, s ≈ размер фигуры в px. */
const SKINS = [
  { id: "classic", name: "Классика", note: "буквы алфавита", sw: ["#EEF0FB", "#2F45E0", "#FFD84D"] },
  { id: "notebook", name: "Тетрадь", note: "каракули на полях", sw: ["#FBFAF5", "#3B3FD1", "#E04B3F"] },
  { id: "news", name: "Газета", note: "растр, кроссворды, заголовки", sw: ["#ECE9E1", "#1A1A1A", "#B3261E"] },
  { id: "gzhel", name: "Гжель", note: "синие цветы на белом", sw: ["#F6F8FD", "#1F4FBF", "#8FA9E6"] },
  { id: "telegraph", name: "Телеграф", note: "марки, штемпели, морзе", sw: ["#E7DCC4", "#A8392A", "#2B4C7E"] },
  { id: "neon", name: "Неон", note: "светящиеся вывески", sw: ["#0E0B14", "#FF3DA5", "#2DE2E6"] }
];

const pickOf = (arr, r) => arr[Math.floor(r() * arr.length)];
const DRAW = {
  /* ---- Классика ---- */
  letter(x, y, s, r) {
    const L = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ";
    return `<text x="${x}" y="${y + s / 3}" font-size="${s * 1.6}" transform="rotate(${-20 + r() * 40} ${x} ${y})" class="d-let">${pickOf(L, r)}</text>`;
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
    return `<text x="${x}" y="${y + s * .25}" font-size="${s * .8}" text-anchor="middle" transform="rotate(${-14 + r() * 28} ${x} ${y})" class="${r() < .5 ? "d-redt" : "d-inkt"}">${pickOf(W, r)}</text>`;
  },
  /* ---- Газета ---- */
  halftone(x, y, s) {
    let o = ""; const n = 7, st = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const dx = (i - n / 2 + .5) * st, dy = (j - n / 2 + .5) * st, d = Math.hypot(dx, dy) / (s * .5);
      if (d < 1) o += `<circle cx="${(x + dx).toFixed(1)}" cy="${(y + dy).toFixed(1)}" r="${(st * .48 * (1 - d * .85)).toFixed(2)}" fill="#1A1A1A" opacity=".55"/>`;
    }
    return o;
  },
  headline(x, y, s, r) {
    const H = ["СЕНСАЦИЯ", "ВНИМАНИЕ!", "ЖИ-ШИ ПИШИ С И", "СРОЧНО В НОМЕР", "ЭКСТРЕННЫЙ ВЫПУСК", "ГРАМОТНОСТЬ — СИЛА", "ЗАПЯТАЯ НАЙДЕНА"];
    const t = pickOf(H, r), w = t.length * s * .34;
    return `<g transform="rotate(${-6 + r() * 12} ${x} ${y})"><line x1="${x - w / 2}" x2="${x + w / 2}" y1="${y - s * .55}" y2="${y - s * .55}" stroke="#1A1A1A" stroke-width="2"/>
      <text x="${x}" y="${y + s * .2}" font-size="${s * .62}" text-anchor="middle" class="d-news">${t}</text>
      <line x1="${x - w / 2}" x2="${x + w / 2}" y1="${y + s * .45}" y2="${y + s * .45}" stroke="#1A1A1A" stroke-width=".8"/></g>`;
  },
  crossword(x, y, s, r) {
    const c = s / 4, L = "ОРФОГРАФ"; let o = `<g transform="rotate(${-10 + r() * 20} ${x} ${y})">`;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const X = x - 2 * c + i * c, Y = y - 1.5 * c + j * c, blk = (i + j * 2) % 5 === 3;
      o += `<rect x="${X}" y="${Y}" width="${c}" height="${c}" fill="${blk ? "#1A1A1A" : "#FBF9F3"}" stroke="#1A1A1A" stroke-width=".9"/>`;
      if (!blk && j === 1) o += `<text x="${X + c / 2}" y="${Y + c * .72}" font-size="${c * .62}" text-anchor="middle" class="d-news">${L[i]}</text>`;
    }
    return o + `</g>`;
  },
  column(x, y, s, r) {
    let o = ""; const w = s * 1.1;
    for (let i = 0; i < 5; i++) o += `<rect x="${x - w / 2}" y="${y - s * .4 + i * s * .2}" width="${i === 4 ? w * .55 : w * (.85 + r() * .15)}" height="${s * .07}" fill="#1A1A1A" opacity=".28"/>`;
    return o;
  },
  /* ---- Гжель ---- */
  rose(x, y, s, r) {
    const R = s * .45; let o = `<circle cx="${x}" cy="${y}" r="${R}" fill="#1F4FBF" opacity=".12"/>`;
    for (let i = 0; i < 4; i++) { const rr = R * (1 - i * .22), a0 = r() * 3;
      o += `<path d="M${(x + rr * Math.cos(a0)).toFixed(1)},${(y + rr * Math.sin(a0)).toFixed(1)} A${rr},${rr} 0 1 1 ${(x + rr * Math.cos(a0 + 4.2)).toFixed(1)},${(y + rr * Math.sin(a0 + 4.2)).toFixed(1)}" stroke="#1F4FBF" stroke-width="${2.6 - i * .4}" fill="none" stroke-linecap="round"/>`; }
    return o + `<circle cx="${x}" cy="${y}" r="${R * .12}" fill="#1F4FBF"/>`;
  },
  gleaf(x, y, s, r) {
    const a = r() * 360, k = s / 30;
    return `<g transform="translate(${x},${y}) rotate(${a}) scale(${k})"><path d="M0,0 C6,-8 16,-8 22,0 C16,8 6,8 0,0Z" fill="#1F4FBF"/><path d="M2,0 L20,0" stroke="#F6F8FD" stroke-width="1"/>
      <path d="M0,0 C-6,-6 -14,-6 -18,0 C-14,6 -6,6 0,0Z" fill="#5C82D9"/></g>`;
  },
  gdots(x, y, s) {
    let o = ""; for (let i = 0; i < 3; i++) o += `<circle cx="${x + (i - 1) * s * .3}" cy="${y + (i === 1 ? -s * .2 : 0)}" r="${s * .1}" fill="#1F4FBF"/>`;
    return o + `<path d="M${x - s * .5},${y + s * .3} q${s * .5},${s * .3} ${s},0" stroke="#5C82D9" stroke-width="1.6" fill="none"/>`;
  },
  /* ---- Телеграф ---- */
  stamp(x, y, s, r) {
    const w = s * .8, h = s, c = pickOf(["#A8392A", "#2B4C7E", "#3F7A4B", "#C98A2B"], r), a = -12 + r() * 24;
    return `<g transform="rotate(${a} ${x} ${y})"><rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" fill="#FBF6EA" stroke="#B9A985" stroke-width="2" stroke-dasharray="2 3"/>
      <rect x="${x - w / 2 + 4}" y="${y - h / 2 + 4}" width="${w - 8}" height="${h - 14}" fill="${c}" opacity=".85"/>
      <text x="${x}" y="${y + 2}" font-size="${s * .38}" text-anchor="middle" fill="#FBF6EA" class="d-mono">${pickOf(["Ё", "Ъ", "Ж", "Я", "Щ"], r)}</text>
      <text x="${x}" y="${y + h / 2 - 3}" font-size="${s * .14}" text-anchor="middle" fill="#6E5F49" class="d-mono">${pickOf(["5 коп", "10 коп", "1 руб"], r)}</text></g>`;
  },
  postmark(x, y, s, r) {
    const R = s * .42; let w = "";
    for (let i = 0; i < 3; i++) w += `<path d="M${x + R * .9},${y - 6 + i * 6} q6,-4 12,0 t12,0 t12,0" stroke="#2B4C7E" stroke-width="1.4" fill="none" opacity=".7"/>`;
    return `<g transform="rotate(${-20 + r() * 40} ${x} ${y})" opacity=".75"><circle cx="${x}" cy="${y}" r="${R}" fill="none" stroke="#2B4C7E" stroke-width="2"/><circle cx="${x}" cy="${y}" r="${R * .72}" fill="none" stroke="#2B4C7E" stroke-width="1"/>
      <text x="${x}" y="${y + 3}" font-size="${s * .2}" text-anchor="middle" fill="#2B4C7E" class="d-mono">${pickOf(["МОСКВА", "ПОЧТА", "25·11", "ТЧК"], r)}</text>${w}</g>`;
  },
  tape(x, y, s, r) {
    const T = pickOf(["ПРИЕЗЖАЮ ТЧК", "ПИШУ БЕЗ ОШИБОК ТЧК", "ЖДИ ЗПТ ЛЮБЛЮ ТЧК", "СРОЧНО ТЧК", "ЖИ ШИ ПИШИ С И ТЧК"], r), w = T.length * s * .2 + 14;
    return `<g transform="rotate(${-8 + r() * 16} ${x} ${y})"><rect x="${x - w / 2}" y="${y - s * .2}" width="${w}" height="${s * .4}" fill="#FBF6EA" stroke="#D2C3A1"/>
      <text x="${x}" y="${y + s * .1}" font-size="${s * .26}" text-anchor="middle" fill="#2B2118" class="d-mono">${T}</text></g>`;
  },
  stampword(x, y, s, r) {
    const T = pickOf(["СРОЧНО", "МОЛНИЯ", "ВРУЧИТЬ", "ОТЛИЧНО"], r), w = T.length * s * .32 + 12;
    return `<g transform="rotate(${-15 + r() * 30} ${x} ${y})" opacity=".7"><rect x="${x - w / 2}" y="${y - s * .3}" width="${w}" height="${s * .6}" rx="4" fill="none" stroke="#A8392A" stroke-width="2.4"/>
      <text x="${x}" y="${y + s * .14}" font-size="${s * .4}" text-anchor="middle" fill="#A8392A" class="d-mono" font-weight="700">${T}</text></g>`;
  },
  /* ---- Неон ---- */
  nword(x, y, s, r) {
    const T = pickOf(["ОТКРЫТО", "ЖИ·ШИ", "24/7", "ГРАМОТНО", "ЧА·ЩА", "ЁЁЁ", "ВЕРНО!"], r), c = pickOf(["#FF3DA5", "#2DE2E6", "#FFE45E", "#7CFF6B", "#B98CFF"], r);
    return `<text x="${x}" y="${y + s * .2}" font-size="${s * .6}" text-anchor="middle" transform="rotate(${-8 + r() * 16} ${x} ${y})" fill="none" stroke="${c}" stroke-width="1.6" filter="url(#glow)" class="d-neon">${T}</text>`;
  },
  nheart(x, y, s, r) {
    const k = s / 30, c = pickOf(["#FF3DA5", "#FF5E5E"], r);
    return `<path d="M${x},${y + 10 * k} C${x - 16 * k},${y - 2 * k} ${x - 8 * k},${y - 14 * k} ${x},${y - 5 * k} C${x + 8 * k},${y - 14 * k} ${x + 16 * k},${y - 2 * k} ${x},${y + 10 * k}Z" fill="none" stroke="${c}" stroke-width="2.4" filter="url(#glow)"/>`;
  },
  narrow(x, y, s, r) {
    const d = r() < .5 ? 1 : -1, c = pickOf(["#2DE2E6", "#FFE45E", "#7CFF6B"], r), w = s * .7;
    return `<path d="M${x - w * d},${y} L${x + w * d},${y} M${x + (w - 9) * d},${y - 8} L${x + w * d},${y} L${x + (w - 9) * d},${y + 8}" stroke="${c}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>`;
  },
  nstar(x, y, s, r) {
    let p = ""; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, R = i % 2 ? s * .2 : s * .48; p += (i ? "L" : "M") + (x + R * Math.cos(a)).toFixed(1) + "," + (y + R * Math.sin(a)).toFixed(1); }
    return `<path d="${p}Z" fill="none" stroke="${pickOf(["#FFE45E", "#B98CFF", "#2DE2E6"], r)}" stroke-width="2.2" stroke-linejoin="round" filter="url(#glow)"/>`;
  },
  brick(x, y, s, r) {
    const w = 34, h = 14;
    return `<g opacity=".5"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#2A2233" stroke-width="1.2"/><rect x="${x + w / 2}" y="${y + h}" width="${w}" height="${h}" fill="none" stroke="#2A2233" stroke-width="1.2"/></g>`;
  }
};

/* Какие рисунки и сколько — для каждого оформления (freeN — штук на 10 000 px²) */
const DECOR = {
  classic: { gap: ["letter"], free: [], freeN: 0 },
  notebook: { gap: ["star", "spiral", "heart", "smile", "arrow", "word", "word"], free: [], freeN: 0 },
  news: { gap: ["halftone", "headline", "crossword", "column", "halftone", "headline"], free: [], freeN: 0 },
  gzhel: { gap: ["rose", "gleaf", "gdots", "rose", "gleaf"], free: ["gleaf"], freeN: .15 },
  telegraph: { gap: ["stamp", "postmark", "tape", "stampword", "stamp"], free: [], freeN: 0 },
  neon: { gap: ["nword", "nheart", "narrow", "nstar", "nword"], free: ["brick"], freeN: .6 }
};
const SIZE = { letter: 44, star: 28, spiral: 26, heart: 26, smile: 28, arrow: 34, word: 26, halftone: 40, headline: 22, crossword: 40, column: 36, rose: 40, gleaf: 30, gdots: 26, stamp: 40, postmark: 40, tape: 26, stampword: 26, nword: 30, nheart: 28, narrow: 34, nstar: 26, brick: 1 };

function decorDefs() {
  return `<defs><filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
}
function decorSVG(skin, W, H, gaps) {
  const D = DECOR[skin] || DECOR.classic;
  let seed = 7 + skin.length * 13; const r = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  const draw = (kind, x, y, s) => DRAW[kind](Math.round(x), Math.round(y), s, r);
  let out = "";
  const nFree = Math.round(W * H / 10000 * D.freeN);
  for (let i = 0; i < nFree; i++) { const k = pickOf(D.free, r); out += draw(k, r() * W, r() * H, SIZE[k] * (.6 + r() * .6)); }
  gaps.forEach((y, gi) => {
    const slots = skin === "classic" ? [gi % 2 ? .1 : .9] : [.06 + r() * .14, .4 + r() * .2, .8 + r() * .14];
    for (const fx of slots) {
      if (skin !== "classic" && r() < .25) continue;
      const k = pickOf(D.gap, r);
      out += draw(k, fx * W, y + (r() - .5) * 10, SIZE[k] * (.8 + r() * .4));
    }
  });
  return out;
}
