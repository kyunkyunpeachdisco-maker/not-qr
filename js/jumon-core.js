// 見まちがえやすい組（あ/お、い/り、う/ら、ね/れ/わ、ろ/る、は/ほ/け、た/な、さ/き/ち、ぬ/め など）から1文字ずつだけ残した32文字＝5ビット
const JUMON_KANA = 'あいうえかきくこしすせたちつてとにねのはひふへまみむもやゆよろん';
// 使っていない文字を打たれたときの読みかえ
const JUMON_ALIAS = { 'お': 'あ', 'り': 'い', 'ら': 'う', 'わ': 'ね', 'れ': 'ね', 'る': 'ろ', 'ほ': 'は', 'け': 'は', 'な': 'た',
  'ぁ': 'あ', 'ぃ': 'い', 'ぅ': 'う', 'ぇ': 'え', 'ぉ': 'あ', 'っ': 'つ', 'ゃ': 'や', 'ゅ': 'ゆ', 'ょ': 'よ', 'ゎ': 'ね' };

// CRC-10 (x^10+x^9+x^5+x^4+x+1)。10ビット以内の連続した誤りは必ず見つかるので、1文字の打ち間違いと隣どうしの入れかわりは必ず弾ける
function crc10(bits) {
  let c = 0x3ff;
  for (const b of bits) { const top = ((c >> 9) & 1) ^ b; c = (c << 1) & 0x3ff; if (top) c ^= 0x233; }
  return c;
}
async function jumonEncode(text) {
  const https = text.startsWith('https://') ? 1 : 0;
  const raw = new TextEncoder().encode(https ? text.slice(8) : text);
  let body = raw, zip = 0;
  if (typeof CompressionStream === 'function') {
    try { const z = await pipeBytes(raw, new CompressionStream('deflate-raw')); if (z.length < raw.length) { body = z; zip = 1; } } catch (e) {}
  }
  const bits = [https, zip];
  for (const b of body) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  while (bits.length % 5) bits.push(0);
  const crc = crc10(bits);
  for (let i = 9; i >= 0; i--) bits.push((crc >> i) & 1);
  let out = '';
  for (let i = 0; i < bits.length; i += 5) out += JUMON_KANA[bits.slice(i, i + 5).reduce((v, b) => v * 2 + b, 0)];
  return out;
}
function jumonNormalize(str) {
  let s = str.normalize('NFKC').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  s = s.normalize('NFD').replace(/[゙゚]/g, '').normalize('NFC').replace(/\s/g, '');
  let text = '', bad = '';
  for (const ch of s) {
    const c = JUMON_KANA.includes(ch) ? ch : JUMON_ALIAS[ch];
    if (c) text += c; else if (!bad.includes(ch)) bad += ch;
  }
  return { text, bad };
}
async function jumonDecode(input) {
  const { text, bad } = jumonNormalize(input);
  if (bad) return { error: `つかえない もじが あります：${bad}` };
  if (text.length < 4) return { error: 'じゅもんが みじかすぎます' };
  const bits = [];
  for (const ch of text) { const v = JUMON_KANA.indexOf(ch); for (let i = 4; i >= 0; i--) bits.push((v >> i) & 1); }
  const data = bits.slice(0, -10);
  if (crc10(data) !== bits.slice(-10).reduce((v, b) => v * 2 + b, 0)) return { error: 'じゅもんが ちがいます' };
  const n = Math.floor((data.length - 2) / 8);
  if (data.slice(2 + n * 8).some((b) => b)) return { error: 'じゅもんが ちがいます' };
  let bytes = new Uint8Array(n);
  for (let i = 0; i < n; i++) bytes[i] = data.slice(2 + i * 8, 10 + i * 8).reduce((v, b) => v * 2 + b, 0);
  try {
    if (data[1]) {
      if (typeof DecompressionStream !== 'function') return { error: 'このブラウザでは よめない じゅもんです' };
      bytes = await pipeBytes(bytes, new DecompressionStream('deflate-raw'));
    }
    return { text: (data[0] ? 'https://' : '') + new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
  } catch (e) {
    return { error: 'じゅもんが ちがいます' };
  }
}

// リンクには ひらがなの代わりに 英数字1文字ずつを使う(ひらがなのままだと %E3%82%8D… の羅列になって長くなるため)
const LINK_CHARS = '0123456789abcdefghijklmnopqrstuv';
// リンクは 読みとり用の ふっかつページを 開く
const shareUrl = (j) => `${new URL('fukkatsu.html', location.href).href}#j=${[...j].map((ch) => LINK_CHARS[JUMON_KANA.indexOf(ch)]).join('')}`;
// リンクの #j=… / 以前の #jumon=… から じゅもんを取りだす。なければ null
function jumonFromHash(hash) {
  const mj = hash.match(/#j=([0-9a-v]+)/), m = hash.match(/#jumon=([^&\s]+)/);
  if (mj) return [...mj[1]].map((c) => JUMON_KANA[LINK_CHARS.indexOf(c)]).join('');
  if (m) { try { return decodeURIComponent(m[1]); } catch (e) {} }
  return null;
}
// コピーする文章: じゅもんを見せてから、その下にリンク
const shareText = (j) => `ふっかつのじゅもん\n${groups(j, 12).map((r) => groups(r, 4).join(' ')).join('\n')}\n${shareUrl(j)}`;

// 画像のじゅもんは 決まったマス目に1文字ずつ置く(画像から読みとるときも同じ位置を見る)
const IMG = { W: 720, top: 120, lineH: 56, cell: 46, gap: 24, perRow: 12 };
const cellX = (i) => (IMG.W - (IMG.perRow * IMG.cell + 2 * IMG.gap)) / 2 + i * IMG.cell + Math.floor(i / 4) * IMG.gap;
async function drawJumonImage(j, text) {
  try { await document.fonts.load('34px "DotGothic16"'); } catch (e) {}
  const rows = groups(j, IMG.perRow);
  const W = IMG.W, H = IMG.top + rows.length * IMG.lineH + 40;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#0a0b1c'; x.fillRect(16, 16, W - 32, H - 32);
  x.strokeStyle = '#f4f4f8'; x.lineWidth = 6; x.strokeRect(19, 19, W - 38, H - 38);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '30px "DotGothic16", monospace'; x.fillStyle = '#ffd23b'; x.fillText('ふっかつのじゅもん', W / 2, 66);
  // 行き先も 文字で 見せておく(じゅもんの位置には かからない)
  const site = text && siteOf(text);
  if (site) { x.font = '18px "DotGothic16", monospace'; x.fillStyle = '#b6b6d8'; x.fillText(`行き先：${siteLabel(site)}`, W / 2, 100); }
  x.font = '34px "DotGothic16", monospace'; x.fillStyle = '#f4f4f8';
  rows.forEach((r, ri) => [...r].forEach((ch, i) => x.fillText(ch, cellX(i) + IMG.cell / 2, IMG.top + ri * IMG.lineH + IMG.lineH / 2)));
  return c;
}
// 1マスを12×12に区切った明るさで、32文字の見本と くらべる
function cellFeature(px, w, row, i) {
  const G = 12, x0 = cellX(i) + 4, y0 = IMG.top + row * IMG.lineH + 9, size = 38, f = new Float32Array(G * G);
  let ink = 0;
  for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
    let s = 0, k = 0;
    for (let yy = Math.floor(y0 + (gy * size) / G); yy < Math.floor(y0 + ((gy + 1) * size) / G); yy++)
      for (let xx = Math.floor(x0 + (gx * size) / G); xx < Math.floor(x0 + ((gx + 1) * size) / G); xx++) { const p = (yy * w + xx) * 4; s += px[p] * 0.299 + px[p + 1] * 0.587 + px[p + 2] * 0.114; k++; }
    f[gy * G + gx] = s / k;
    if (s / k > 100) ink++;
  }
  const mean = f.reduce((a, b) => a + b, 0) / f.length;
  let norm = 0;
  for (let k = 0; k < f.length; k++) { f[k] -= mean; norm += f[k] * f[k]; }
  norm = Math.sqrt(norm) || 1;
  for (let k = 0; k < f.length; k++) f[k] /= norm;
  return { f, ink };
}
const pixelsOf = (c) => c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
let jumonTemplates = null;
async function readJumonImage(img) {
  if (!jumonTemplates) {
    const t = await drawJumonImage(JUMON_KANA), px = pixelsOf(t);
    jumonTemplates = [...JUMON_KANA].map((ch, k) => ({ ch, f: cellFeature(px, t.width, Math.floor(k / IMG.perRow), k % IMG.perRow).f }));
  }
  // 横幅720に そろえてから、決まったマス目を読む
  const H = Math.round((img.height * IMG.W) / img.width), rows = Math.round((H - IMG.top - 40) / IMG.lineH);
  if (rows < 1 || rows > 20) return '';
  const c = document.createElement('canvas'); c.width = IMG.W; c.height = H;
  c.getContext('2d').drawImage(img, 0, 0, IMG.W, H);
  const px = pixelsOf(c);
  let out = '';
  for (let r = 0; r < rows; r++) for (let i = 0; i < IMG.perRow; i++) {
    const { f, ink } = cellFeature(px, IMG.W, r, i);
    if (ink < 3) continue;
    let best = null, bestScore = -Infinity;
    for (const t of jumonTemplates) { let s = 0; for (let k = 0; k < f.length; k++) s += f[k] * t.f[k]; if (s > bestScore) { bestScore = s; best = t.ch; } }
    out += best;
  }
  return out;
}
