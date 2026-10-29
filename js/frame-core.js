// ===== フレームの しくみ =====
// 画像全体を マス目に区切り、外がわの帯に データを入れる。
// 行進(parade): 帯は1マス。1マスに キャラ1匹。キャラ8種 × 跳ねている/地面 = 4ビット。下の段は左向きに歩く
// 星空(stars): 帯は4マス。2×2マスに 星1つ。4か所のどこに星があるか = 2ビット
// QR風(qr): 帯は4マス。外から 濃い1列・データ2列(濃い=1)・うすい1列。動画の圧縮にも強い
// 帯の内がわが 写真・動画の窓。窓の位置(inset)も データに入れておく
const KINDS = {
  parade: { Ls: [24, 32, 40, 48, 56, 64, 72], band: 1, bits: 4 },
  stars: { Ls: [56, 72, 88, 104, 120, 136, 152], band: 4, bits: 2 },
  qr: { Ls: [96, 128, 160], band: 4, bits: 1 },
};

const PAL = {
  k: '#1a1a1a', w: '#ffffff', g: '#9e9e9e', G: '#5f5f5f', r: '#e53935', R: '#8e1b1b', p: '#f48fb1', P: '#d81b60',
  o: '#fb8c00', y: '#fdd835', Y: '#c79a00', b: '#42a5f5', B: '#1e3a8a', c: '#80deea', n: '#a1887f', N: '#5d4037',
  e: '#66bb6a', E: '#2e7d32', v: '#ab47bc', s: '#ffcc80',
};
// 12×12のドット絵(すべてオリジナル)
const SPRITES = {
  yokai: [
    ['....kkkk....', '..kkvvvvkk..', '.kvvvvvvvvk.', 'kvvwwvvvvvvk', 'kvvwkvvvvvvk', 'kvvvvvvrrvvk', 'kkkkkkkrrkkk', '.....kNk....', '.....kNk....', '.....kNk....', '....kNNk....', '....kkkk....'],
    ['....kkkk....', '...kNNNNk...', '..kooooook..', '.kRRRRRRRRk.', '.kooowwoook.', '.kooowkoook.', '.kRRRRRRRRk.', '.kookrrkook.', '.kRRRRRRRRk.', '..kooooook..', '...kNNNNk...', '....kkkk....'],
    ['....kkkk....', '...kssssk...', '..kssssssk..', '..ksswwssk..', '..ksswkssk..', '..kssssssk..', '...kssrsk...', '..kbbbbbbk..', '.kbbbwwbbbk.', '.kbbbbbbbbk.', '..kNk..kNk..', '..kkk..kkk..'],
    ['...kkkkkk...', '..kcccccck..', '.keeeeeeeek.', '.kewkeewkek.', '.keeeeeeeek.', '.keeyyyyeek.', '..keyyyyek..', '..keeeeeek..', '.keEEEEEEek.', '.keeeeeeeek.', '..kek..kek..', '..kkk..kkk..'],
    ['.ky......yk.', '.kyk....kyk.', '..krrrrrrk..', '.krrrrrrrrk.', '.krwkrrwkrk.', '.krrrrrrrrk.', '.krkwwwwkrk.', '..krrrrrrk..', '.kyNyNyNyNk.', '.krrrrrrrrk.', '..krk..krk..', '..kkk..kkk..'],
    ['..k....k....', '.kgk..kgk...', '.kgggggggk.k', '.kgwkgwkgkgk', '.kggggggkgk.', '.kggpggggkk.', '..kgggggk.k.', '..kgggggkkgk', '..kgggggkgk.', '..kgkkgkkk..', '..kk..kk....', '............'],
    ['kkkkkkkkkkkk', 'kggggggggggk', 'kgGgggggGggk', 'kggggggggggk', 'kgwkggggwkgk', 'kggggggggggk', 'kgggGggggggk', 'kgggggkkgggk', 'kggggggggggk', 'kgggGgggggGk', 'kkkkkkkkkkkk', '..kk....kk..'],
    ['.....k......', '....kck.....', '...kcck.....', '...kccck....', '..kcbbcck...', '..kcbbbck...', '.kcbwbwbck..', '.kcbbbbbck..', '.kcbbbbbck..', '..kcbbbck...', '...kckck....', '....k.k.....'],
  ],
  birthday: [
    ['..y..y..y...', '..r..b..e...', '..k..k..k...', '.kkkkkkkkkk.', '.kwwpwwpwwk.', '.kppppppppk.', '.kwwwwwwwwk.', '.knnnnnnnnk.', '.kwpwwpwwpk.', '.knnnnnnnnk.', 'kkkkkkkkkkkk', '............'],
    ['...kkkkk....', '..krrrrrk...', '.krwrrrrrk..', '.krwrrrrrk..', '.krrrrrrrk..', '.krrrrrrrk..', '..krrrrrk...', '...krrrk....', '....kRk.....', '.....k......', '....k.......', '.....k......'],
    ['...yy..yy...', '....yyyy....', '.kkkkyykkkk.', '.kbbbyybbbk.', '.kyyyyyyyyk.', '.kbbbyybbbk.', '.kbbbyybbbk.', '.kbbbyybbbk.', '.kbbbyybbbk.', '.kkkkkkkkkk.', '............', '............'],
    ['............', '............', 'y....y....y.', 'yy..yyy..yy.', 'yyy.yyy.yyy.', 'yyyyyyyyyyy.', 'yyryybyyeyy.', 'yyyyyyyyyyy.', 'YYYYYYYYYYY.', '............', '............', '............'],
    ['............', '..kk...kk...', '.kPPk.kPPk..', 'kPwPPkPPPPk.', 'kPPPPPPPPPk.', 'kPPPPPPPPPk.', '.kPPPPPPPk..', '..kPPPPPk...', '...kPPPk....', '....kPk.....', '.....k......', '............'],
    ['.....k......', '....kyk.....', '....kyk.....', 'kkkkyyykkkk.', '.kyyyyyyyk..', '..kyyyyyk...', '..kyyyyyk...', '.kyyykyyyk..', '.kyyk.kyyk..', 'kyk.....kyk.', 'kk.......kk.', '............'],
    ['.....r......', '....kkk.....', '..kwwwwwk...', '.kwpwwwpwk..', 'kwwwwpwwwwk.', 'kkkkkkkkkkk.', '.konononok..', '.konononok..', '..konononk..', '..kkkkkkk...', '............', '............'],
    ['y...b...p...', '..r...e.....', 'y...p....b..', '....kk..r...', '...kyyk.....', '..kyrryk....', '..kyyyyk....', '.kryyyyrk...', '.kyyryyyk...', 'kyyyyryyk...', 'kkkkkkkkk...', '............'],
  ],
  eto: [
    ['............', '..kk..kk....', '.kgpk.kgpk..', '.kggggggk...', 'kgwkggggk...', 'kgggggggk...', 'kpkggggggk..', '.kkggggggkk.', '..kggggggk.k', '..kkkkkkk..k', '..........k.', '............'],
    ['k........k..', 'kk......kk..', '.kkkkkkkk...', 'kwwwwwwwwk..', 'kwkwwwwkwk..', 'kwwwwwwwwk..', '.kppppppk...', '.kpkppkpk...', '..kkkkkk....', '..kwk.kwk...', '..kk...kk...', '............'],
    ['.kk....kk...', '.kok..kok...', '.koookoook..', '.kokoooook..', 'kowkoowkok..', 'koooooooook.', 'kokwwwwwok..', 'kooowkwoook.', '.kokooooko..', '..kkkkkkk...', '............', '............'],
    ['..kk..kk....', '..kwk.kwk...', '..kpk.kpk...', '..kwk.kwk...', '.kwwwwwwk...', 'kwwkwwkwwk..', 'kwwwwwwwwk..', 'kwwwpwwwwk..', '.kwwwwwwk...', '..kkkkkk....', '............', '............'],
    ['......kkk...', '.....keeek..', '.....kekek..', '......keek..', '.....keek.r.', '..kkkeek....', '.keeeeek....', 'keeEEEEeek..', 'keEeeeeEek..', 'keeEEEEeek..', '.keeeeeek...', '..kkkkkk....'],
    ['......kk....', '.....kNNk...', '....knnNk...', '...knnnnk...', '..knwknnNk..', '.knnnnnnNk..', 'knnnknnnNk..', 'kkkk.knnNk..', '.....knnnNk.', '....knnnnnk.', '....kkkkkkk.', '............'],
    ['............', '..kwkwkwk...', '.kwwwwwwwk..', 'kwwwwwwwwwk.', 'kwwGGGGwwwk.', 'kwGwGGwGwwk.', 'kwwGGGGwwwk.', 'kwwwGGwwwwk.', '.kwwwwwwwk..', '..kGk.kGk...', '..kkk.kkk...', '............'],
    ['............', '..kk........', '.kNNkkkkkk..', '.kNNNNNNNNk.', 'kNwkNNNNNNNk', 'kNNNNNNNNNNk', 'kpkNNNNNNNNk', 'kwwNNNNNNNk.', '.kkNNNNNNk..', '..kNk..kNk..', '..kkk..kkk..', '............'],
  ],
  rpg: [
    ['............', '............', '...kkkkkk...', '..kbbbbbbk..', '.kbwbbbbbbk.', '.kbbbbbbbbk.', 'kbbwkbbwkbbk', 'kbbbbbbbbbbk', 'kbbbrrrbbbbk', 'kbbbbbbbbbbk', '.kkkkkkkkkk.', '............'],
    ['............', 'k..........k', 'kk..k..k..kk', 'kvk.kvvk.kvk', 'kvvkvvvvkvvk', 'kvvvvwvwvvvk', 'kvvvvvvvvvvk', '.kvvkvvkvvk.', '..kk.kk.kk..', '............', '............', '............'],
    ['...kkkkk....', '..kwwwwwk...', '.kwwwwwwwk..', '.kwkwwkwwk..', '.kwwwwwwwk..', '.kwwwpwwwk..', '.kwwwwwwwk..', '.kwwwwwwwk..', '.kwkwkwkwk..', '.kk.k.k.kk..', '............', '............'],
    ['..kkkkkkk...', '.kwwwwwwwk..', 'kwwwwwwwwwk.', 'kwkkwwwkkwk.', 'kwkkwwwkkwk.', 'kwwwwkwwwwk.', '.kwwwwwwwk..', '..kwkwkwk...', '..kwwwwwk...', '...kkkkk....', '............', '............'],
    ['...kkkkkk...', '..krrwrrrk..', '.krwwrrrwrk.', 'krrrrrrwwrrk', 'krwrrrrrrrrk', 'kkkkkkkkkkkk', '..kswkkwsk..', '..kssssssk..', '..kssssssk..', '...kkkkkk...', '............', '............'],
    ['...k.k......', '..keke......', '.keeeek.....', 'keweekeek...', 'keeeeeeeek..', 'kyyyeeeeek..', '.kkkkeeeeekk', '....keyyeek.', '...keyyyek..', '...keekeek..', '...kk.kk....', '............'],
    ['............', '.kkkkkkkkkk.', 'kNnnnYYnnnNk', 'knnnnYYnnnnk', 'kwkwkwkwkwkk', 'krrrrrrrrrrk', 'kwkwkwkwkwkk', 'knnnnnnnnnnk', 'kNnnnnnnnnNk', 'kkkkkkkkkkkk', '............', '............'],
    ['.....kE.....', '....kEk.....', '..kkkkkkkk..', '.kooookoook.', 'kookyookyook', 'koooooooooo.', 'kokyyyyyyok.', 'koookookook.', '.kooookoook.', '..kkkkkkkk..', '............', '............'],
  ],
};
const DESIGNS = {
  chojugiga: { kind: 'emaki', name: '鳥獣戯画', bg: '#f4eedf' },
  hyakki: { kind: 'emaki', name: '百鬼夜行', bg: '#efe5d0' },
  yokai: { kind: 'parade', name: 'おばけ', bg: '#211c44', corner: 'moon' },
  birthday: { kind: 'parade', name: 'たんじょうび', bg: '#ffe4ef', corner: 'star' },
  eto: { kind: 'parade', name: 'えと', bg: '#fbefd5', corner: 'sun' },
  rpg: { kind: 'parade', name: 'モンスター', bg: '#13173a', corner: 'cursor' },
  milkyway: { kind: 'stars', name: '天の川' },
  qr: { kind: 'qr', name: 'QR風', dark: '#111111', light: '#ffffff' },
  custom: { kind: 'custom', name: 'じぶんの そざい', bg: '#e4ecf6' },
};

function frameGeom(L, aspect) {
  return aspect >= 1 ? { Wu: L, Hu: Math.round(L / aspect) } : { Wu: Math.round(L * aspect), Hu: L };
}
function slotsOf(kind, Wu, Hu) {
  const s = [];
  if (kind === 'parade') {
    for (let x = 1; x <= Wu - 2; x++) s.push({ x, y: 0 });
    for (let y = 1; y <= Hu - 2; y++) s.push({ x: Wu - 1, y });
    for (let x = Wu - 2; x >= 1; x--) s.push({ x, y: Hu - 1, flip: true });
    for (let y = Hu - 2; y >= 1; y--) s.push({ x: 0, y });
  } else if (kind === 'qr') {
    for (const r of [1, 2]) {
      for (let x = 4; x <= Wu - 5; x++) s.push({ x, y: r });
      for (let y = 4; y <= Hu - 5; y++) s.push({ x: Wu - 1 - r, y });
      for (let x = Wu - 5; x >= 4; x--) s.push({ x, y: Hu - 1 - r });
      for (let y = Hu - 5; y >= 4; y--) s.push({ x: r, y });
    }
  } else {
    for (const y of [0, 2]) for (let x = 4; x + 2 <= Wu - 4; x += 2) s.push({ x, y });
    for (const x of [Wu - 4, Wu - 2]) for (let y = 4; y + 2 <= Hu - 4; y += 2) s.push({ x, y });
    for (const y of [Hu - 4, Hu - 2]) for (let x = 4; x + 2 <= Wu - 4; x += 2) s.push({ x, y });
    for (const x of [0, 2]) for (let y = 4; y + 2 <= Hu - 4; y += 2) s.push({ x, y });
  }
  return s;
}
// 中身は [窓の位置, ことばの長さ, ことば…, 0埋め] をリード・ソロモン符号にしたもの
function frameCode(kind, Wu, Hu) {
  const slots = slotsOf(kind, Wu, Hu), n = Math.min(255, Math.floor((slots.length * KINDS[kind].bits) / 8)), nsym = Math.max(8, Math.ceil(n / 4));
  return { slots, n, nsym, cap: n - nsym - 2 };
}
// 同じキャラばかり並ばないよう、データに決まった模様を かさねる
const maskVal = (i) => Math.imul(i + 1, 2654435761) >>> 13;
function toSymbols(code, count, b) {
  const out = [];
  for (let i = 0, bp = 0; i < count; i++) {
    let v = 0;
    for (let j = 0; j < b; j++, bp++) v = v * 2 + (bp < code.length * 8 ? (code[bp >> 3] >> (7 - (bp & 7))) & 1 : 0);
    out.push(v ^ (maskVal(i) & ((1 << b) - 1)));
  }
  return out;
}
function fromSymbols(syms, n, b) {
  const code = new Array(n).fill(0);
  syms.forEach((s, i) => {
    const v = s ^ (maskVal(i) & ((1 << b) - 1));
    for (let j = 0; j < b; j++) { const bp = i * b + j; if (bp < n * 8) code[bp >> 3] |= ((v >> (b - 1 - j)) & 1) << (7 - (bp & 7)); }
  });
  return code;
}
// 画像をrectいっぱいに(はみ出したぶんは中央を残して切る)
function drawCover(x, img, dx, dy, dw, dh) {
  const s = Math.max(dw / img.width, dh / img.height), sw = dw / s, sh = dh / s;
  x.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, dx, dy, dw, dh);
}

// --- 行進 ---
function drawTile(x, designKey, sym, flip, ox, oy, P) {
  const sp = SPRITES[designKey][sym >> 1], hop = sym & 1;
  const ps = (P * 0.72) / 12, sx = ox + (P - 12 * ps) / 2, sy = oy + (P - 12 * ps) / 2 + (hop ? -0.1 : 0.08) * P;
  x.fillStyle = 'rgba(0,0,0,0.22)';
  x.beginPath(); x.ellipse(ox + P / 2, oy + P * 0.93, P * (hop ? 0.2 : 0.3), P * 0.05, 0, 0, Math.PI * 2); x.fill();
  for (let r = 0; r < 12; r++) for (let c = 0; c < 12; c++) {
    const col = PAL[sp[r][flip ? 11 - c : c]];
    if (!col) continue;
    const x0 = Math.round(sx + c * ps), x1 = Math.round(sx + (c + 1) * ps), y0 = Math.round(sy + r * ps), y1 = Math.round(sy + (r + 1) * ps);
    x.fillStyle = col; x.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
}
function drawCornerIcon(x, type, ox, oy, s) {
  const cx = ox + s / 2, cy = oy + s / 2, r = s * 0.32;
  x.beginPath();
  if (type === 'moon') {
    x.fillStyle = '#fdd835'; x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.fillStyle = '#211c44'; x.arc(cx + r * 0.45, cy - r * 0.3, r * 0.85, 0, Math.PI * 2); x.fill();
  } else if (type === 'star') {
    x.fillStyle = '#ff7043';
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; x.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); }
    x.fill();
  } else if (type === 'sun') {
    x.fillStyle = '#d32f2f'; x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  } else {
    x.fillStyle = '#ffd23b'; x.moveTo(cx - r * 0.7, cy - r); x.lineTo(cx + r, cy); x.lineTo(cx - r * 0.7, cy + r); x.fill();
  }
}
function drawParade(x, designKey, Wu, Hu, U, slots, syms) {
  const d = DESIGNS[designKey];
  x.fillStyle = d.bg; x.fillRect(0, 0, Wu * U, Hu * U);
  slots.forEach((s, i) => drawTile(x, designKey, syms[i], s.flip, s.x * U, s.y * U, U));
  for (const [cx, cy] of [[0, 0], [Wu - 1, 0], [0, Hu - 1], [Wu - 1, Hu - 1]]) drawCornerIcon(x, d.corner, cx * U, cy * U, U);
}
// 1マスを24×24に縮めた色の並びで、見本とくらべる
const TILE_PX = 24;
function tileFeatures(data, count) {
  const len = TILE_PX * TILE_PX * 3, out = [];
  for (let t = 0; t < count; t++) {
    const f = new Float32Array(len);
    let mean = 0;
    for (let i = 0; i < TILE_PX * TILE_PX; i++) for (let ch = 0; ch < 3; ch++) { const v = data[(t * TILE_PX * TILE_PX + i) * 4 + ch]; f[i * 3 + ch] = v; mean += v; }
    mean /= len;
    let norm = 0;
    for (let i = 0; i < len; i++) { f[i] -= mean; norm += f[i] * f[i]; }
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < len; i++) f[i] /= norm;
    out.push(f);
  }
  return out;
}
const templateCache = {};
function paradeTemplates(designKey) {
  if (templateCache[designKey]) return templateCache[designKey];
  const P = 96, big = document.createElement('canvas'); big.width = P; big.height = P;
  const bx = big.getContext('2d');
  const atlas = document.createElement('canvas'); atlas.width = TILE_PX; atlas.height = TILE_PX * 32;
  const ax = atlas.getContext('2d', { willReadFrequently: true });
  for (let flip = 0; flip < 2; flip++) for (let sym = 0; sym < 16; sym++) {
    bx.fillStyle = DESIGNS[designKey].bg; bx.fillRect(0, 0, P, P);
    drawTile(bx, designKey, sym, !!flip, 0, 0, P);
    ax.drawImage(big, 0, 0, P, P, 0, (flip * 16 + sym) * TILE_PX, TILE_PX, TILE_PX);
  }
  const f = tileFeatures(ax.getImageData(0, 0, TILE_PX, TILE_PX * 32).data, 32);
  return (templateCache[designKey] = [f.slice(0, 16), f.slice(16)]);
}
function paradeTileFeatures(img, slots, uw, uh) {
  const atlas = document.createElement('canvas'); atlas.width = TILE_PX; atlas.height = TILE_PX * slots.length;
  const ax = atlas.getContext('2d', { willReadFrequently: true });
  ax.imageSmoothingQuality = 'high';
  slots.forEach((s, i) => drawCrop(ax, img, s.x * uw, s.y * uh, uw, uh, 0, i * TILE_PX, TILE_PX, TILE_PX));
  return tileFeatures(ax.getImageData(0, 0, TILE_PX, TILE_PX * slots.length).data, slots.length);
}
function classifyParade(feats, slots, designKey) {
  const tpl = paradeTemplates(designKey);
  return feats.map((f, i) => {
    const set = tpl[slots[i].flip ? 1 : 0];
    let best = 0, bestScore = -Infinity;
    for (let s = 0; s < 16; s++) { let sc = 0; const t = set[s]; for (let k = 0; k < f.length; k++) sc += f[k] * t[k]; if (sc > bestScore) { bestScore = sc; best = s; } }
    return best;
  });
}

// --- 星空 ---
function drawStar(x, cx, cy, r, col) {
  const g = x.createRadialGradient(cx, cy, 0, cx, cy, r * 2);
  g.addColorStop(0, col); g.addColorStop(0.25, col); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r * 2, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#ffffff'; x.beginPath(); x.arc(cx, cy, r * 0.5, 0, Math.PI * 2); x.fill();
  if (Math.random() < 0.35) {
    x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = Math.max(1, r * 0.12);
    x.beginPath(); x.moveTo(cx - r * 1.6, cy); x.lineTo(cx + r * 1.6, cy); x.moveTo(cx, cy - r * 1.6); x.lineTo(cx, cy + r * 1.6); x.stroke();
  }
}
function drawStars(x, Wu, Hu, U, slots, syms) {
  const W = Wu * U, H = Hu * U, band = KINDS.stars.band * U;
  const sky = x.createLinearGradient(0, 0, W, H);
  sky.addColorStop(0, '#060b26'); sky.addColorStop(0.5, '#141d4d'); sky.addColorStop(1, '#060b26');
  x.fillStyle = sky; x.fillRect(0, 0, W, H);
  const inBand = () => { for (;;) { const px = Math.random() * W, py = Math.random() * H; if (px < band || py < band || px > W - band || py > H - band) return [px, py]; } };
  // 天の川の もや と、かすかな星(データではない)
  for (let i = 0; i < (Wu + Hu) * 1.5; i++) {
    const [px, py] = inBand(), g = x.createRadialGradient(px, py, 0, px, py, U * 2.5);
    g.addColorStop(0, 'rgba(150,170,255,0.07)'); g.addColorStop(1, 'rgba(150,170,255,0)');
    x.fillStyle = g; x.fillRect(px - U * 2.5, py - U * 2.5, U * 5, U * 5);
  }
  for (let i = 0; i < (Wu + Hu) * 6; i++) {
    const [px, py] = inBand();
    x.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.25})`; x.beginPath(); x.arc(px, py, U * (0.04 + Math.random() * 0.05), 0, Math.PI * 2); x.fill();
  }
  const cols = ['#ffffff', '#fff6c8', '#d6e4ff', '#ffe0f0'];
  slots.forEach((s, i) => {
    const j = () => (Math.random() - 0.5) * 0.16;
    drawStar(x, (s.x + (syms[i] & 1) + 0.5 + j()) * U, (s.y + (syms[i] >> 1) + 0.5 + j()) * U, U * (0.24 + Math.random() * 0.12), cols[Math.floor(Math.random() * cols.length)]);
  });
  // すみの かざり: 月・大きな星・流れ星
  const c = 2 * U;
  x.fillStyle = '#fff3b0'; x.beginPath(); x.arc(c, c, U * 1.3, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#0a1030'; x.beginPath(); x.arc(c + U * 0.6, c - U * 0.4, U * 1.15, 0, Math.PI * 2); x.fill();
  drawStar(x, W - c, c, U * 0.6, '#fff6c8'); drawStar(x, c, H - c, U * 0.6, '#d6e4ff');
  const tail = x.createLinearGradient(W - c - U * 1.6, H - c - U * 1.2, W - c + U * 0.8, H - c + U * 0.6);
  tail.addColorStop(0, 'rgba(255,255,255,0)'); tail.addColorStop(1, 'rgba(255,255,255,0.9)');
  x.strokeStyle = tail; x.lineWidth = U * 0.18; x.lineCap = 'round';
  x.beginPath(); x.moveTo(W - c - U * 1.6, H - c - U * 1.2); x.lineTo(W - c + U * 0.8, H - c + U * 0.6); x.stroke();
  drawStar(x, W - c + U * 0.8, H - c + U * 0.6, U * 0.35, '#ffffff');
}
// 2×2マスのうち いちばん明るいマスが 星の位置
function classifyStars(px, W, slots, uw, uh) {
  const lum = (cx, cy) => {
    const x0 = Math.floor((cx + 0.35) * uw), x1 = Math.max(x0 + 1, Math.floor((cx + 0.65) * uw));
    const y0 = Math.floor((cy + 0.35) * uh), y1 = Math.max(y0 + 1, Math.floor((cy + 0.65) * uh));
    let s = 0, k = 0;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const p = (yy * W + xx) * 4; s += px[p] + px[p + 1] + px[p + 2]; k++; }
    return s / k;
  };
  return slots.map((s) => {
    let best = 0, bestV = -1;
    for (let q = 0; q < 4; q++) { const v = lum(s.x + (q & 1), s.y + (q >> 1)); if (v > bestV) { bestV = v; best = q; } }
    return best;
  });
}

// --- QR風 ---
function drawQR(x, Wu, Hu, U, slots, syms) {
  const d = DESIGNS.qr, W = Wu * U, H = Hu * U;
  x.fillStyle = d.light; x.fillRect(0, 0, W, H);
  x.fillStyle = d.dark;
  x.fillRect(0, 0, W, U); x.fillRect(0, H - U, W, U); x.fillRect(0, 0, U, H); x.fillRect(W - U, 0, U, H);
  slots.forEach((s, i) => { if (syms[i]) x.fillRect(s.x * U, s.y * U, U, U); });
  for (const [cx, cy] of [[0, 0], [Wu - 4, 0], [0, Hu - 4], [Wu - 4, Hu - 4]]) {
    x.fillStyle = d.dark; x.fillRect(cx * U, cy * U, 4 * U, 4 * U);
    x.fillStyle = d.light; x.fillRect((cx + 1) * U, (cy + 1) * U, 2 * U, 2 * U);
  }
}
function classifyQR(px, W, Wu, Hu, slots, uw, uh) {
  const lum = (cx, cy) => {
    const x0 = Math.floor((cx + 0.25) * uw), x1 = Math.max(x0 + 1, Math.floor((cx + 0.75) * uw));
    const y0 = Math.floor((cy + 0.25) * uh), y1 = Math.max(y0 + 1, Math.floor((cy + 0.75) * uh));
    let s = 0, k = 0;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const p = (yy * W + xx) * 4; s += px[p] * 0.299 + px[p + 1] * 0.587 + px[p + 2] * 0.114; k++; }
    return s / k;
  };
  let dark = 0, light = 0, k = 0;
  for (let cx = 4; cx < Wu - 4; cx += 3) { dark += lum(cx, 0) + lum(cx, Hu - 1); light += lum(cx, 3) + lum(cx, Hu - 4); k += 2; }
  dark /= k; light /= k;
  if (light - dark < 40) return null;
  const thr = (dark + light) / 2;
  return slots.map((s) => (lum(s.x, s.y) < thr ? 1 : 0));
}

// ===== 帯の太さと 窓(写真・動画が入るところ) =====
// 帯の太さは 画像の短い辺に対する割合。窓は いつも写真・動画と同じ縦横比にして、写真を切らない
const BAND_CHOICES = { ほそい: 0.05, ふつう: 0.08, ふとい: 0.12 };
// 絵巻・じぶんの素材は、絵を小さくしすぎると 縮小に弱くなるので、入りきらないときは 帯を この段階で 太くする
const BAND_STEPS = [0.05, 0.06, 0.07, 0.08, 0.1, 0.12, 0.14, 0.17, 0.2];
// 絵の大きさ「おおきい」: 絵が 長い辺の 1/18 以上に なるまで 帯を太くする
const BIG_NX = 18;
const WIN_Q = 250; // 窓の位置は 画像の幅・高さを250等分した目盛りで データに入れる
// 外がわの大きさ。outerAspect が null なら「写真に合わせる」(窓のまわりに 同じ太さの帯)
function outerSize(size, photoAspect, outerAspect, band) {
  let A = outerAspect;
  if (!A) {
    const a = photoAspect >= 1 ? photoAspect : 1 / photoAspect;
    const b = (band * size) / ((1 - 2 * band) * a + 2 * band), winL = size - 2 * b, winS = winL / a;
    A = photoAspect >= 1 ? size / (winS + 2 * b) : (winS + 2 * b) / size;
  }
  return A >= 1 ? { W: size, H: Math.round(size / A) } : { W: Math.round(size * A), H: size };
}
// 帯の内がわに、写真の縦横比の窓を まんなかに置く(目盛りに そろえる)
function placeWindow(W, H, bandPx, photoAspect) {
  const aw = W - 2 * bandPx, ah = H - 2 * bandPx, s = Math.min(aw / photoAspect, ah);
  const w = s * photoAspect, h = s, q = (v, m) => Math.round((v / m) * WIN_Q);
  return { x0: q((W - w) / 2, W), y0: q((H - h) / 2, H), x1: q((W + w) / 2, W), y1: q((H + h) / 2, H) };
}
function windowPx(win, W, H) {
  const x = Math.round((win.x0 / WIN_Q) * W), y = Math.round((win.y0 / WIN_Q) * H);
  return { x, y, w: Math.round((win.x1 / WIN_Q) * W) - x, h: Math.round((win.y1 / WIN_Q) * H) - y };
}
const winBytes = (win) => [win.x0, win.y0, win.x1, win.y1];
const validWin = (w) => w.x0 < w.x1 && w.y0 < w.y1 && w.x1 <= WIN_Q && w.y1 <= WIN_Q && w.x1 - w.x0 > 25 && w.y1 - w.y0 > 25;

// --- 絵巻(emaki): 本物の絵巻から切り抜いた絵を、ちぎった和紙の帯に並べる ---
// 絵1つに1バイト: 種類(8) × 回転(45°ずつ8方向) × 左右反転 × 大小。和紙の帯は 列の数×絵の大きさ で太さが決まり、
// 入る範囲で いちばん細くなる並べ方を選ぶ
const EMAKI = {
  chojugiga: { dir: 'assets/chojugiga/', bold: true },
  hyakki: { dir: 'assets/hyakki/' },
};
const EMAKI_NX = [12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32];
const emakiSprites = {};
function loadEmaki(key) {
  if (!emakiSprites[key]) {
    emakiSprites[key] = Promise.all(Array.from({ length: 8 }, (_, i) => new Promise((ok, ng) => {
      const img = new Image(); img.onerror = ng; img.src = `${EMAKI[key].dir}${i + 1}.png`;
      img.onload = () => {
        if (!EMAKI[key].bold) return ok(img);
        const c = document.createElement('canvas'), w = Math.max(1, Math.round(img.width * 0.004)) + 1;
        c.width = img.width + w * 2; c.height = img.height + w * 2;
        const x = c.getContext('2d');
        for (let dy = -w; dy <= w; dy++) for (let dx = -w; dx <= w; dx++) if (dx * dx + dy * dy <= w * w) x.drawImage(img, w + dx, w + dy);
        ok(c);
      };
    })));
  }
  return emakiSprites[key];
}
// 画像の一部を 切りだして描く。Safariは 切りだす範囲が 画像の外に はみ出すと 何も描かないことがあるので、
// 画像の内がわに おさまる部分だけを 対応する位置に描く
function drawCrop(x, img, sx, sy, sw, sh, dx, dy, dw, dh) {
  const iw = img.width, ih = img.height, x0 = Math.max(0, sx), y0 = Math.max(0, sy), x1 = Math.min(iw, sx + sw), y1 = Math.min(ih, sy + sh);
  if (x1 <= x0 || y1 <= y0) return;
  const kx = dw / sw, ky = dh / sh;
  x.drawImage(img, x0, y0, x1 - x0, y1 - y0, dx + (x0 - sx) * kx, dy + (y0 - sy) * ky, (x1 - x0) * kx, (y1 - y0) * ky);
}
// 位置のゆらぎ用。ブラウザによって結果が変わらないよう整数だけで計算する
const hash01 = (a, b, k) => ((Math.imul(a * 73856093 ^ b * 19349663 ^ k * 83492791, 2654435761) >>> 0) % 10007) / 10007;
// データの絵は 外がわの帯の中だけに並べる(窓の位置に かかわらず 読める)
function edgeLayout(W, H, bandPx, nx) {
  const C = Math.max(W, H) / nx, rowH = C * 0.87, cells = [], rest = [];
  for (let r = 0; r * rowH < H + C; r++) for (let c = -1; c * C < W + C; c++) {
    const x = (c + (r % 2) * 0.5 + 0.25) * C + (hash01(r, c, 1) - 0.5) * 0.2 * C;
    const y = (r + 0.5) * rowH + 0.12 * C + (hash01(r, c, 2) - 0.5) * 0.2 * C;
    const e = Math.min(x, W - x, y, H - y);
    if (e >= 0.45 * C && e <= bandPx - 0.5 * C) cells.push({ x, y, r, c });
    else rest.push({ x, y, r, c, e });
  }
  return { C, cells, rest };
}
function emakiCode(W, H, bandPx, nx) {
  const L = edgeLayout(W, H, bandPx, nx), n = Math.min(255, L.cells.length), nsym = Math.max(8, Math.ceil(n / 4));
  return { L, n, nsym, cap: n - nsym - 5 };
}
function drawMotif(x, sprites, cx, cy, C, sym) {
  const img = sprites[sym >> 5], rot = (sym >> 2) & 7, mirror = (sym >> 1) & 1, big = sym & 1;
  const s = (C * (big ? 0.82 : 0.55)) / Math.max(img.width, img.height);
  x.save(); x.translate(cx, cy); x.rotate((rot * Math.PI) / 4); x.scale(mirror ? -s : s, s);
  x.drawImage(img, -img.width / 2, -img.height / 2); x.restore();
}
// 窓のまわりを 和紙で おおう。窓のふちは ゆるやかに破れた形にして、まっすぐな枠線に見せない(破れ目は 窓に少しだけ かかる)
function drawTornPaper(x, W, H, r, C, bg) {
  let wob = 0;
  const pts = [], step = Math.max(4, C * 0.18), j = () => { wob = wob * 0.6 + (Math.random() - 0.5) * 0.4; return C * (0.03 + wob * 0.05 + Math.random() * 0.03); };
  for (let px = r.x; px <= r.x + r.w; px += step) pts.push([px, r.y + j()]);
  for (let py = r.y; py <= r.y + r.h; py += step) pts.push([r.x + r.w - j(), py]);
  for (let px = r.x + r.w; px >= r.x; px -= step) pts.push([px, r.y + r.h - j()]);
  for (let py = r.y + r.h; py >= r.y; py -= step) pts.push([r.x + j(), py]);
  x.save();
  x.beginPath(); x.rect(0, 0, W, H);
  pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath();
  x.shadowColor = 'rgba(0,0,0,0.25)'; x.shadowBlur = C * 0.15;
  x.fillStyle = bg; x.fill('evenodd');
  x.restore();
}
async function buildEmaki(text, designKey, W, H, band, photoAspect, big) {
  const sprites = await loadEmaki(designKey), payload = await packText(text);
  // 絵は 入る範囲で いちばん大きく。下限の大きさでも 入らなければ 帯を太くする
  for (const b of BAND_STEPS.filter((v) => v >= band - 1e-9)) for (const nx of EMAKI_NX) {
    const bandPx = b * Math.min(W, H), win = placeWindow(W, H, bandPx, photoAspect), r = windowPx(win, W, H);
    const { L, n, nsym, cap } = emakiCode(W, H, bandPx, nx);
    if (L.cells.length < 16 || payload.length > cap) continue;
    // おおきい: この帯で いちばん大きい絵でも 小さければ、次の太さへ(いちばん太い帯なら そのまま)
    if (big && nx > BIG_NX && b < BAND_STEPS[BAND_STEPS.length - 1]) break;
    const msg = [...winBytes(win), payload.length, ...payload];
    while (msg.length < n - nsym) msg.push(0);
    const code = rsEncode(msg, nsym);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    drawTornPaper(x, W, H, r, L.C, DESIGNS[designKey].bg);
    // 飾りの絵: 画面のはしで切れるもの、帯と窓のあいだの すきま、窓のふちに すこし かかるもの
    const off = (p) => Math.max(r.x - p.x, 0, p.x - r.x - r.w) + Math.max(r.y - p.y, 0, p.y - r.y - r.h);
    L.rest.forEach((d) => {
      const g = off(d);
      if ((d.e < 0.45 * L.C && d.e > -0.4 * L.C) || g > 0.55 * L.C || (g > 0 && hash01(d.r, d.c, 4) < 0.35)) drawMotif(x, sprites, d.x, d.y, L.C, Math.floor(hash01(d.r, d.c, 3) * 256));
    });
    L.cells.forEach((cell, i) => drawMotif(x, sprites, cell.x, cell.y, L.C, (i < n ? code[i] : 0) ^ (maskVal(i) & 255)));
    c.frameInfo = { kind: 'emaki', W, H, win, text, band: b, nx };
    return c;
  }
  throw new Error('too long');
}
// 1マスを32×32に縮めた色の並びで、256通りの見本とくらべる(真ん中を重く、となりが はみ出してくる まわりを軽く)
const FEAT = 32;
const FEAT_W = new Float32Array(FEAT * FEAT).map((_, i) => { const dx = ((i % FEAT) + 0.5) / FEAT - 0.5, dy = (Math.floor(i / FEAT) + 0.5) / FEAT - 0.5; return Math.exp(-(dx * dx + dy * dy) / (2 * 0.22 * 0.22)); });
function features(data, count) {
  const len = FEAT * FEAT * 3, out = [];
  for (let t = 0; t < count; t++) {
    const f = new Float32Array(len);
    let mean = 0;
    for (let i = 0; i < FEAT * FEAT; i++) for (let ch = 0; ch < 3; ch++) { const v = data[(t * FEAT * FEAT + i) * 4 + ch]; f[i * 3 + ch] = v; mean += v; }
    mean /= len;
    let norm = 0;
    for (let i = 0; i < len; i++) { f[i] = (f[i] - mean) * FEAT_W[(i / 3) | 0]; norm += f[i] * f[i]; }
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < len; i++) f[i] /= norm;
    out.push(f);
  }
  return out;
}
const emakiTemplates = {};
async function getEmakiTemplates(key) {
  if (emakiTemplates[key]) return emakiTemplates[key];
  const sprites = await loadEmaki(key), C = 128;
  const one = document.createElement('canvas'); one.width = C; one.height = C;
  const ox = one.getContext('2d');
  const atlas = document.createElement('canvas'); atlas.width = FEAT; atlas.height = FEAT * 256;
  const ax = atlas.getContext('2d', { willReadFrequently: true });
  for (let sym = 0; sym < 256; sym++) {
    ox.fillStyle = DESIGNS[key].bg; ox.fillRect(0, 0, C, C);
    drawMotif(ox, sprites, C / 2, C / 2, C, sym);
    ax.drawImage(one, 0, 0, C, C, 0, sym * FEAT, FEAT, FEAT);
  }
  return (emakiTemplates[key] = features(ax.getImageData(0, 0, FEAT, FEAT * 256).data, 256));
}
const FEAT_S = 12;
// 32×32の色の特徴から 12×12の白黒の 粗い特徴を作る(ざっと くらべる用)
function smallFeature(f) {
  const g = new Float32Array(FEAT_S * FEAT_S), r = FEAT / FEAT_S;
  for (let y = 0; y < FEAT; y++) for (let x = 0; x < FEAT; x++) { const i = (y * FEAT + x) * 3; g[Math.min(FEAT_S - 1, (y / r) | 0) * FEAT_S + Math.min(FEAT_S - 1, (x / r) | 0)] += f[i] + f[i + 1] + f[i + 2]; }
  let m = 0; for (const v of g) m += v; m /= g.length;
  let n = 0; for (let i = 0; i < g.length; i++) { g[i] -= m; n += g[i] * g[i]; }
  n = Math.sqrt(n) || 1; for (let i = 0; i < g.length; i++) g[i] /= n;
  return g;
}
const smallTemplates = new Map();
function smallOf(tpl) { if (!smallTemplates.has(tpl)) smallTemplates.set(tpl, tpl.map(smallFeature)); return smallTemplates.get(tpl); }
function roughScore(feats, tpl) {
  const st = smallOf(tpl);
  let sum = 0;
  for (const f of feats) { const g = smallFeature(f); let best = -Infinity; for (const t of st) { let sc = 0; for (let k = 0; k < g.length; k++) sc += g[k] * t[k]; if (sc > best) best = sc; } sum += best; }
  return sum / feats.length;
}
function bestSym(f, tpl) {
  let best = 0, bestScore = -Infinity;
  for (let s = 0; s < 256; s++) { let sc = 0; const t = tpl[s]; for (let k = 0; k < f.length; k++) sc += f[k] * t[k]; if (sc > bestScore) { bestScore = sc; best = s; } }
  return [best, bestScore];
}
// 縮める前の 元の大きさの候補(作るときは 長い辺1600px、動画は1280px)。縮めると 幅・高さが整数に丸められ、
// 帯の境目にある絵の 内か外かの判定が ずれることがあるので、元の大きさで 並べ方を計算してから 縮めた画像の上で読む
function* originalSizes(W, H) {
  yield [W, H];
  const long = Math.max(W, H);
  for (const S of [1600, 1280]) {
    if (long === S) continue;
    const k = S / long;
    for (const d of [0, -1, 1, -2, 2]) yield W >= H ? [S, Math.round(H * k) + d] : [Math.round(W * k) + d, S];
  }
}
// cells の位置(元の大きさの座標)を 倍率 s で 縮めた画像から 切りだして 特徴にする
function cellFeatures(img, cells, C, s) {
  const atlas = document.createElement('canvas'); atlas.width = FEAT; atlas.height = FEAT * cells.length;
  const ax = atlas.getContext('2d', { willReadFrequently: true });
  ax.imageSmoothingQuality = 'high';
  ax.fillStyle = '#808080'; ax.fillRect(0, 0, FEAT, FEAT * cells.length);
  cells.forEach((cell, i) => drawCrop(ax, img, (cell.x - C / 2) * s, (cell.y - C / 2) * s, C * s, C * s, 0, i * FEAT, FEAT, FEAT));
  return features(ax.getImageData(0, 0, FEAT, FEAT * cells.length).data, cells.length);
}
async function readEmaki(img, hint) {
  const W = img.width, H = img.height;
  for (const band of hint ? [hint.band] : BAND_STEPS) for (const nx of hint ? [hint.nx] : EMAKI_NX) {
    const probeL = emakiCode(W, H, band * Math.min(W, H), nx).L;
    if (probeL.cells.length < 16) continue;
    // まず16個だけ、粗い特徴で ざっと くらべ、そのあと 細かく くらべる。似ていなければ この並べ方・この絵巻ではない
    const probeF = cellFeatures(img, probeL.cells.slice(0, 16), probeL.C, 1);
    for (const key of hint ? [hint.key] : Object.keys(EMAKI)) {
      const tpl = await getEmakiTemplates(key);
      if (!hint && roughScore(probeF, tpl) < 0.6) continue;
      if (probeF.map((f) => bestSym(f, tpl)[1]).reduce((a, b) => a + b, 0) / 16 < 0.75) continue;
      for (const [W0, H0] of originalSizes(W, H)) {
        const { L, n, nsym, cap } = emakiCode(W0, H0, band * Math.min(W0, H0), nx);
        if (cap < 1) continue;
        const code = cellFeatures(img, L.cells.slice(0, n), L.C, W / W0).map((f, i) => bestSym(f, tpl)[0] ^ (maskVal(i) & 255));
        try {
          const [x0, y0, x1, y1, len, ...rest] = rsDecode(code, nsym), win = { x0, y0, x1, y1 };
          if (!validWin(win) || len < 1 || len > cap) continue;
          return { kind: 'emaki', W, H, win, text: await unpackText(rest.slice(0, len)) };
        } catch (e) {}
      }
    }
  }
  return null;
}

// --- じぶんの素材(custom): ユーザーが用意した 8枚 か 16枚の絵で 絵巻と同じように並べる ---
// 帯の はじめの N マスに 素材を 正位置で1枚ずつ置き(見本)、読みとるときは その見本から 照らし合わせ用の絵を作る。
// 8枚: 種類(8)×向き(8)×左右反転×大小、16枚: 種類(16)×向き(8)×左右反転。どちらも 絵1つに1バイト
// 組み込みの絵巻の 紙の色と まちがえないよう、うすい青みの 紙にする
const CUSTOM_BG = '#e4ecf6';
const CUSTOM_COUNTS = [8, 16];
function symParts(sym, count) {
  return count === 16
    ? { t: sym >> 4, rot: (sym >> 1) & 7, mirror: sym & 1, big: 1 }
    : { t: sym >> 5, rot: (sym >> 2) & 7, mirror: (sym >> 1) & 1, big: sym & 1 };
}
const uprightSym = (t, count) => (count === 16 ? t << 4 : (t << 5) | 1);
// 絵1つを描く。img は 素材そのもの(作るとき) か、見本を切りだした四角(読むとき)
function drawCustomMotif(x, imgs, cx, cy, C, sym, fromKey) {
  const { t, rot, mirror, big } = symParts(sym, imgs.length), img = imgs[t];
  // 見本は 大きい絵として描かれているので、切りだした四角(1マスぶん)を そのまま倍率に使う
  const s = fromKey ? (big ? 1 : 0.55 / 0.82) * (C / img.width) : (C * (big ? 0.82 : 0.55)) / Math.max(img.width, img.height);
  x.save(); x.translate(cx, cy); x.rotate((rot * Math.PI) / 4); x.scale(mirror ? -s : s, s);
  x.drawImage(img, -img.width / 2, -img.height / 2); x.restore();
}
// アップロードされた画像を 素材にする: 背景が透明でなければ ふちの色を抜き、余白を切って 256px以内にする
function prepareCustomSprite(img) {
  const W0 = img.naturalWidth || img.width, H0 = img.naturalHeight || img.height, s = Math.min(1, 512 / Math.max(W0, H0));
  const W = Math.max(1, Math.round(W0 * s)), H = Math.max(1, Math.round(H0 * s));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, W, H);
  const d = x.getImageData(0, 0, W, H), px = d.data;
  const corners = [0, W - 1, (H - 1) * W, H * W - 1];
  if (corners.every((i) => px[i * 4 + 3] > 250)) {
    const bg = [0, 1, 2].map((k) => corners.reduce((a, i) => a + px[i * 4 + k], 0) / 4);
    const near = (i) => Math.hypot(px[i * 4] - bg[0], px[i * 4 + 1] - bg[1], px[i * 4 + 2] - bg[2]) < 40;
    const seen = new Uint8Array(W * H), st = [];
    for (let i = 0; i < W; i++) st.push(i, (H - 1) * W + i);
    for (let j = 0; j < H; j++) st.push(j * W, j * W + W - 1);
    while (st.length) { const i = st.pop(); if (seen[i] || !near(i)) continue; seen[i] = 1; px[i * 4 + 3] = 0; const xx = i % W, yy = (i / W) | 0; if (xx > 0) st.push(i - 1); if (xx < W - 1) st.push(i + 1); if (yy > 0) st.push(i - W); if (yy < H - 1) st.push(i + W); }
    x.putImageData(d, 0, 0);
  }
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let i = 0; i < W * H; i++) if (px[i * 4 + 3] > 20) { const xx = i % W, yy = (i / W) | 0; if (xx < minX) minX = xx; if (xx > maxX) maxX = xx; if (yy < minY) minY = yy; if (yy > maxY) maxY = yy; }
  if (maxX < 0) return c;
  const bw = maxX - minX + 1, bh = maxY - minY + 1, k = Math.min(1, 256 / Math.max(bw, bh));
  const o = document.createElement('canvas'); o.width = Math.max(1, Math.round(bw * k)); o.height = Math.max(1, Math.round(bh * k));
  const ox = o.getContext('2d'); ox.imageSmoothingQuality = 'high'; ox.drawImage(c, minX, minY, bw, bh, 0, 0, o.width, o.height);
  return o;
}
function customCode(W, H, bandPx, nx, count) {
  const L = edgeLayout(W, H, bandPx, nx), n = Math.min(255, L.cells.length - count), nsym = Math.max(8, Math.ceil(n / 4));
  return { L, n, nsym, cap: n - nsym - 5 };
}
async function buildCustom(text, sprites, W, H, band, photoAspect, big) {
  const count = sprites.length, payload = await packText(text);
  for (const b of BAND_STEPS.filter((v) => v >= band - 1e-9)) for (const nx of EMAKI_NX) {
    const bandPx = b * Math.min(W, H), win = placeWindow(W, H, bandPx, photoAspect), r = windowPx(win, W, H);
    const { L, n, nsym, cap } = customCode(W, H, bandPx, nx, count);
    if (n < 16 || payload.length > cap) continue;
    if (big && nx > BIG_NX && b < BAND_STEPS[BAND_STEPS.length - 1]) break;
    const msg = [...winBytes(win), payload.length, ...payload];
    while (msg.length < n - nsym) msg.push(0);
    const code = rsEncode(msg, nsym);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    drawTornPaper(x, W, H, r, L.C, CUSTOM_BG);
    const off = (p) => Math.max(r.x - p.x, 0, p.x - r.x - r.w) + Math.max(r.y - p.y, 0, p.y - r.y - r.h);
    L.rest.forEach((d) => {
      const g = off(d);
      if ((d.e < 0.45 * L.C && d.e > -0.4 * L.C) || g > 0.55 * L.C || (g > 0 && hash01(d.r, d.c, 4) < 0.35)) drawCustomMotif(x, sprites, d.x, d.y, L.C, Math.floor(hash01(d.r, d.c, 3) * 256));
    });
    L.cells.forEach((cell, i) => {
      if (i < count) return;
      drawCustomMotif(x, sprites, cell.x, cell.y, L.C, (i - count < n ? code[i - count] : 0) ^ (maskVal(i - count) & 255));
    });
    // 見本は 最後に、紙の色の丸を敷いてから描く(となりの絵が 見本に かぶらないように)
    L.cells.slice(0, count).forEach((cell, i) => {
      x.fillStyle = CUSTOM_BG; x.beginPath(); x.arc(cell.x, cell.y, L.C * 0.52, 0, Math.PI * 2); x.fill();
      drawCustomMotif(x, sprites, cell.x, cell.y, L.C, uprightSym(i, count));
    });
    c.frameInfo = { kind: 'emaki', W, H, win, text, band: b, nx };
    return c;
  }
  throw new Error('too long');
}
async function readCustom(img, hint) {
  const W = img.width, H = img.height;
  const full = document.createElement('canvas'); full.width = W; full.height = H;
  const fx = full.getContext('2d', { willReadFrequently: true }); fx.drawImage(img, 0, 0);
  const px = fx.getImageData(0, 0, W, H).data, bg = [0xe4, 0xec, 0xf6];
  // 見本のまわり(紙の色の丸)が 紙の色に 見えるか。見えなければ その並べ方ではない
  const ringOk = (cell, C) => {
    let k = 0, bad = 0;
    for (let a = 0; a < 24; a++) {
      for (const rr of [0.46, 0.5]) {
        const xx = Math.round(cell.x + Math.cos((a * Math.PI) / 12) * C * rr), yy = Math.round(cell.y + Math.sin((a * Math.PI) / 12) * C * rr);
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const i = (yy * W + xx) * 4;
        if (Math.hypot(px[i] - bg[0], px[i + 1] - bg[1], px[i + 2] - bg[2]) > 20) bad++;
        k++;
      }
    }
    // 見本の絵の角が 丸に少し かかることは あるので、2割までは 紙の色でなくても よい
    return k > 16 && bad <= k * 0.2;
  };
  for (const count of hint ? [hint.count] : CUSTOM_COUNTS) for (const band of hint ? [hint.band] : BAND_STEPS) for (const nx of hint ? [hint.nx] : EMAKI_NX) {
    const probe = customCode(W, H, band * Math.min(W, H), nx, count);
    if (probe.n < 16) continue;
    if (!probe.L.cells.slice(0, count).every((cell) => ringOk(cell, probe.L.C))) continue;
    const C = Math.round(probe.L.C), keys = probe.L.cells.slice(0, count).map((cell) => {
      const k = document.createElement('canvas'); k.width = C; k.height = C;
      drawCrop(k.getContext('2d'), img, cell.x - probe.L.C / 2, cell.y - probe.L.C / 2, probe.L.C, probe.L.C, 0, 0, C, C);
      return k;
    });
    // 見本を 回したり反転したりして 256通りの 照らし合わせ用の絵を作る
    const atlas = document.createElement('canvas'); atlas.width = FEAT; atlas.height = FEAT * 256;
    const ax = atlas.getContext('2d', { willReadFrequently: true });
    ax.fillStyle = CUSTOM_BG; ax.fillRect(0, 0, FEAT, FEAT * 256); ax.imageSmoothingQuality = 'high';
    for (let sym = 0; sym < 256; sym++) {
      ax.save(); ax.beginPath(); ax.rect(0, sym * FEAT, FEAT, FEAT); ax.clip();
      drawCustomMotif(ax, keys, FEAT / 2, sym * FEAT + FEAT / 2, FEAT, sym, true);
      ax.restore();
    }
    const tpl = features(ax.getImageData(0, 0, FEAT, FEAT * 256).data, 256);
    const pf = cellFeatures(img, probe.L.cells.slice(count, count + 16), probe.L.C, 1);
    if (pf.map((f) => bestSym(f, tpl)[1]).reduce((a, b) => a + b, 0) / 16 < 0.75) continue;
    for (const [W0, H0] of originalSizes(W, H)) {
      const { L, n, nsym, cap } = customCode(W0, H0, band * Math.min(W0, H0), nx, count);
      if (n < 16 || cap < 1) continue;
      const code = cellFeatures(img, L.cells.slice(count, count + n), L.C, W / W0).map((f, i) => bestSym(f, tpl)[0] ^ (maskVal(i) & 255));
      try {
        const [x0, y0, x1, y1, len, ...rest] = rsDecode(code, nsym), win = { x0, y0, x1, y1 };
        if (!validWin(win) || len < 1 || len > cap) continue;
        return { kind: 'emaki', W, H, win, text: await unpackText(rest.slice(0, len)) };
      } catch (e) {}
    }
  }
  return null;
}

async function buildFrame({ text, designKey, photoAspect, outerAspect = null, band = BAND_CHOICES['ふつう'], size = 1600, sprites = null, big = false }) {
  const d = DESIGNS[designKey], { W: W0, H: H0 } = outerSize(size, photoAspect, outerAspect, band);
  if (d.kind === 'emaki') return buildEmaki(text, designKey, W0, H0, band, photoAspect, big);
  if (d.kind === 'custom') return buildCustom(text, sprites, W0, H0, band, photoAspect, big);
  const k = KINDS[d.kind], A = W0 / H0, target = band * Math.min(W0, H0);
  const payload = await packText(text);
  // 帯(k.band マス)の太さが 選んだ太さに いちばん近い マスの数から ためし、入らなければ マスを細かくする
  const start = k.Ls.reduce((bi, L, i) => (Math.abs((k.band * size) / L - target) < Math.abs((k.band * size) / k.Ls[bi] - target) ? i : bi), 0);
  for (const L of k.Ls.slice(start)) {
    const { Wu, Hu } = frameGeom(L, A);
    const { slots, n, nsym, cap } = frameCode(d.kind, Wu, Hu);
    if (payload.length + 3 > cap) continue;
    const U = Math.max(4, Math.round(size / L)), W = Wu * U, H = Hu * U;
    const win = placeWindow(W, H, k.band * U, photoAspect), r = windowPx(win, W, H);
    const msg = [...winBytes(win), payload.length, ...payload];
    while (msg.length < n - nsym) msg.push(0);
    const syms = toSymbols(rsEncode(msg, nsym), slots.length, k.bits);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    if (d.kind === 'parade') drawParade(x, designKey, Wu, Hu, U, slots, syms);
    else if (d.kind === 'qr') drawQR(x, Wu, Hu, U, slots, syms);
    else drawStars(x, Wu, Hu, U, slots, syms);
    x.clearRect(r.x, r.y, r.w, r.h);
    c.frameInfo = { Wu, Hu, win, text };
    return c;
  }
  throw new Error('too long');
}

// 読めたら { text, Wu, Hu, inset }、読めなければ null
// hint = { kind: 'emaki'|'custom', key, count, band, nx } を渡すと その並べ方だけ読む(作った直後の チェック用)
async function readFrame(img, hint) {
  if (hint && hint.kind === 'emaki') return readEmaki(img, hint);
  if (hint && hint.kind === 'custom') return readCustom(img, hint);
  const W = img.width, H = img.height;
  let px = null;
  const tryDecode = async (syms, fc, b, Wu, Hu) => {
    let msg;
    try { msg = rsDecode(fromSymbols(syms, fc.n, b), fc.nsym); } catch (e) { return null; }
    const [x0, y0, x1, y1, len] = msg, win = { x0, y0, x1, y1 };
    if (validWin(win) && len >= 1 && len <= fc.cap - 3) {
      try { return { text: await unpackText(msg.slice(5, 5 + len)), Wu, Hu, win }; } catch (e) {}
    }
    // 以前の形(v1.7まで): [inset, 長さ, …]
    const [inset, len0] = msg;
    if (inset < 1 || 2 * inset > Math.min(Wu, Hu) - 2 || len0 < 1 || len0 > fc.cap) return null;
    const q = (v, m) => Math.round((v / m) * WIN_Q);
    try { return { text: await unpackText(msg.slice(2, 2 + len0)), Wu, Hu, win: { x0: q(inset, Wu), y0: q(inset, Hu), x1: q(Wu - inset, Wu), y1: q(Hu - inset, Hu) } }; } catch (e) { return null; }
  };
  for (const [kind, k] of Object.entries(KINDS)) for (const L of k.Ls) {
    const exact = W >= H ? (L * H) / W : (L * W) / H;
    for (const short of new Set([Math.round(exact), Math.floor(exact), Math.ceil(exact)])) {
      const Wu = W >= H ? L : short, Hu = W >= H ? short : L;
      if (Math.min(Wu, Hu) < 2 * k.band + 6) continue;
      const fc = frameCode(kind, Wu, Hu);
      if (fc.cap < 1) continue;
      const uw = W / Wu, uh = H / Hu;
      if (kind === 'parade') {
        const feats = paradeTileFeatures(img, fc.slots, uw, uh);
        for (const [key, d] of Object.entries(DESIGNS)) {
          if (d.kind !== 'parade') continue;
          const r = await tryDecode(classifyParade(feats, fc.slots, key), fc, k.bits, Wu, Hu);
          if (r) return r;
        }
      } else {
        if (!px) {
          const c = document.createElement('canvas'); c.width = W; c.height = H;
          const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
          px = x.getImageData(0, 0, W, H).data;
        }
        const syms = kind === 'qr' ? classifyQR(px, W, Wu, Hu, fc.slots, uw, uh) : classifyStars(px, W, fc.slots, uw, uh);
        const r = syms && (await tryDecode(syms, fc, k.bits, Wu, Hu));
        if (r) return r;
      }
    }
  }
  return (await readEmaki(img)) || readCustom(img);
}

// 窓(写真・動画が入るところ)の位置。W×H はフレーム画像の大きさ
function windowRect(info, W, H) {
  return windowPx(info.win, W, H);
}
// 窓いっぱいに写真・動画を描く。view = { zoom: 1〜, dx, dy }(dx・dy は窓の幅・高さに対する ずらし量)
function drawMedia(x, media, mw, mh, r, view) {
  const s = Math.max(r.w / mw, r.h / mh) * view.zoom, dw = mw * s, dh = mh * s;
  const mx = (dw - r.w) / 2 / r.w, my = (dh - r.h) / 2 / r.h;
  view.dx = Math.max(-mx, Math.min(mx, view.dx)); view.dy = Math.max(-my, Math.min(my, view.dy));
  x.save(); x.beginPath(); x.rect(r.x, r.y, r.w, r.h); x.clip();
  x.drawImage(media, r.x + (r.w - dw) / 2 + view.dx * r.w, r.y + (r.h - dh) / 2 + view.dy * r.h, dw, dh);
  x.restore();
}
// フレーム(透明な窓のフレームでも、写真入りの画像でも)の上から、窓に写真・動画を描く
// 窓の右下に 行き先を 文字で のせる(データの帯には かからない)
function drawDestLabel(x, info, W, H) {
  const s = siteOf(info.text);
  if (!s) return;
  const r = windowRect(info, W, H), label = `→ ${siteLabel(s)}`;
  let fs = Math.max(12, Math.round(Math.min(W, H) * 0.026));
  x.font = `${fs}px "DotGothic16", sans-serif`;
  while (x.measureText(label).width > r.w * 0.8 && fs > 10) { fs--; x.font = `${fs}px "DotGothic16", sans-serif`; }
  const pad = fs * 0.6, h = fs * 1.8, w = x.measureText(label).width + pad * 2, bx = r.x + r.w - w - fs * 0.5, by = r.y + r.h - h - fs * 0.5;
  x.save();
  x.fillStyle = 'rgba(0,0,0,0.6)'; x.beginPath(); x.roundRect(bx, by, w, h, h / 2); x.fill();
  x.fillStyle = '#ffffff'; x.textBaseline = 'middle'; x.fillText(label, bx + pad, by + h / 2);
  x.restore();
}
function composite(x, frameImg, info, media, mw, mh, view) {
  const r = windowRect(info, frameImg.width, frameImg.height);
  x.clearRect(0, 0, frameImg.width, frameImg.height);
  if (info.opaque) { x.drawImage(frameImg, 0, 0); drawMedia(x, media, mw, mh, r, view); }
  else { drawMedia(x, media, mw, mh, r, view); x.drawImage(frameImg, 0, 0); }
  drawDestLabel(x, info, frameImg.width, frameImg.height);
}
// フレーム画像の まんなかが 透明かどうか(写真入りの画像を フレームとして えらんだときは 透明でない)
function isOpaqueCenter(img) {
  const c = document.createElement('canvas'); c.width = 8; c.height = 8;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, img.width / 2 - 4, img.height / 2 - 4, 8, 8, 0, 0, 8, 8);
  return x.getImageData(0, 0, 1, 1).data[3] > 200;
}
// 画像・動画のファイルから フレームを読む。動画は いくつかの場面を 切りだして ためす
async function readMedia(file) {
  if (!file.type.startsWith('video/')) return readFrame(await loadImage(file));
  const v = await loadVideo(file);
  for (const t of [0.5, v.duration / 2]) {
    await seekVideo(v, Math.min(t, v.duration - 0.05));
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    const info = await readFrame(c);
    if (info) return info;
  }
  return null;
}
