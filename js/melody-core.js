// ===== きょくの くみたて =====
// 1音=8分音符=0.2秒。データはメロディだけに入れる(1音3ビット)。
// メロディ音域(C5〜E6)には ほかのパートの基本音が入らないようにして、聞きとりやすくしている
const T = 0.2;
const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);
const DATA_MIDI = [72, 74, 76, 79, 81, 84, 86, 88]; // ド レ ミ ソ ラ ド レ ミ(ペンタトニック)
const MARK_MIDI = [91, 93]; // 合図用のソ・ラ(データには使わない高さ)
const CAND_HZ = [...DATA_MIDI, ...MARK_MIDI].map(midiHz);
const NOTE_NAME = ['ド', 'レ', 'ミ', 'ソ', 'ラ', 'ド', 'レ', 'ミ', 'ソ', 'ラ'];
const MARK_LEN = 4, HDR_LEN = 9; // 合図ソラソラ + 長さ(3音)を3回くりかえす
const MAX_K = 191;
const nsymFor = (k) => Math.max(8, Math.ceil(k / 3));
// コード進行(根音の半音数, 短調か)。データには関係ない飾り
const PROGS = [
  [[0, 0], [7, 0], [9, 1], [5, 0]],
  [[9, 1], [5, 0], [0, 0], [7, 0]],
  [[0, 0], [9, 1], [5, 0], [7, 0]],
  [[5, 0], [7, 0], [4, 1], [9, 1]],
];
const ROOT_NAME = { 0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A' };

async function songFromText(text) {
  const payload = await packText(text);
  const k = payload.length;
  if (k > MAX_K) throw new Error('too long');
  const code = rsEncode(payload, nsymFor(k));
  const hdr = [(k >> 6) & 7, (k >> 3) & 7, k & 7];
  const bits = [];
  for (const b of code) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  while (bits.length % 3) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 3) data.push(bits[i] * 4 + bits[i + 1] * 2 + bits[i + 2]);
  const melody = [...new Array(8).fill(null), ...MARK_MIDI, ...MARK_MIDI, ...[...hdr, ...hdr, ...hdr, ...data].map((s) => DATA_MIDI[s])];
  while (melody.length % 8) melody.push(null);
  melody.push(84, ...new Array(7).fill(null)); // さいごの小節は のばして おわる
  return { melody, prog: PROGS[code.reduce((a, b) => a + b, 0) % PROGS.length], k, n: code.length };
}
const songBars = (song) => song.melody.length / 8;
const chordOf = (song, b) => (b === songBars(song) - 1 ? [0, 0] : song.prog[b % 4]);
function triad([root, minor]) {
  return [0, minor ? 3 : 4, 7].map((x) => { let n = 48 + root + x; while (n < 55) n += 12; while (n >= 67) n -= 12; return n; }).sort((a, b) => a - b);
}

// 波形を直接計算して曲を作る(音の部品を何千個もつなぐより ずっと軽い)
function synthSong(song, sr, t0 = 0.1) {
  const out = new Float32Array(Math.ceil((song.melody.length * T + 0.5) * sr));
  const tone = (type, hz, start, dur, vol) => {
    const s0 = Math.round(start * sr), n = Math.round(dur * sr), att = 0.005 * sr, rel = 0.01 * sr, inc = hz / sr;
    let ph = 0;
    for (let i = 0; i < n && s0 + i < out.length; i++) {
      ph += inc; ph -= Math.floor(ph);
      const v = type === 'square' ? (ph < 0.5 ? 1 : -1) : ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph;
      out[s0 + i] += v * vol * Math.min(1, i / att, (n - i) / rel);
    }
  };
  // ノイズを 1次のフィルターで低音/高音だけにして、だんだん小さくする
  const hit = (start, dur, vol, ftype, fhz) => {
    const s0 = Math.round(start * sr), n = Math.round(dur * sr), a = Math.exp((-2 * Math.PI * fhz) / sr);
    let lp = 0;
    for (let i = 0; i < n && s0 + i < out.length; i++) {
      const w = Math.random() * 2 - 1;
      lp = (1 - a) * w + a * lp;
      out[s0 + i] += (ftype === 'lowpass' ? lp * 3 : w - lp) * vol * Math.pow(0.001 / vol, i / n);
    }
  };
  const bars = songBars(song);
  for (let b = 0; b < bars; b++) {
    const chord = chordOf(song, b), tri = triad(chord), bass = 36 + chord[0];
    const tb = t0 + b * 8 * T;
    if (b === bars - 1) {
      tone('triangle', midiHz(bass), tb, 7 * T, 0.35);
      tri.forEach((m) => tone('square', midiHz(m), tb, 7 * T, 0.03));
      hit(tb, 1.2, 0.15, 'highpass', 5000);
      continue;
    }
    for (let s = 0; s < 8; s++) {
      const t = tb + s * T;
      tone('triangle', midiHz(bass + (s % 2 ? 12 : 0)), t, T * 0.9, 0.35);
      const arp = [0, 1, 2, 1];
      tone('square', midiHz(tri[arp[(s * 2) % 4]]), t, T * 0.45, 0.035);
      tone('square', midiHz(tri[arp[(s * 2 + 1) % 4]]), t + T / 2, T * 0.45, 0.035);
      hit(t, 0.03, 0.05, 'highpass', 7000);
      if (s % 4 === 0) hit(t, 0.08, 0.5, 'lowpass', 150);
      if (s % 4 === 2) hit(t, 0.05, 0.18, 'highpass', 1000);
    }
  }
  song.melody.forEach((m, i) => {
    if (m === null) return;
    const last = i >= song.melody.length - 8;
    tone('square', midiHz(m), t0 + i * T, last ? 7 * T : T * 0.88, 0.13);
  });
  for (let i = 0; i < out.length; i++) out[i] *= 0.7;
  return out;
}
async function renderSong(song, sr = 44100) {
  const data = synthSong(song, sr), buf = new AudioBuffer({ length: data.length, sampleRate: sr, numberOfChannels: 1 });
  buf.copyToChannel(data, 0);
  return buf;
}

function songToAbc(song) {
  const name = { 72: 'c', 74: 'd', 76: 'e', 79: 'g', 81: 'a', 84: "c'", 86: "d'", 88: "e'", 91: "g'", 93: "a'" };
  let abc = 'X:1\nM:4/4\nL:1/8\nQ:1/4=150\nK:C\n';
  const bars = songBars(song);
  for (let b = 0; b < bars; b++) {
    const [root, minor] = chordOf(song, b);
    const notes = song.melody.slice(b * 8, b * 8 + 8);
    let body;
    if (b === bars - 1) body = "c'8";
    else if (notes.every((m) => m === null)) body = 'z8';
    else body = notes.map((m) => (m === null ? 'z' : name[m])).join('');
    abc += `"${ROOT_NAME[root]}${minor ? 'm' : ''}"${body}` + (b === bars - 1 ? ' |]' : b % 4 === 3 ? ' |\n' : ' | ');
  }
  return abc;
}

// ===== ききとり =====
// 10ミリ秒ごとに、10個の高さそれぞれの強さを Goertzel法で はかる
function makeListener(sr) {
  const N = 2048, hop = Math.round(sr / 100);
  const win = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  const co = CAND_HZ.map((f) => 2 * Math.cos((2 * Math.PI * f) / sr));
  let buf = new Float32Array(sr * 10), len = 0;
  const frames = [];
  return {
    frames, sync: null, scanFrom: 0,
    append(chunk) {
      if (len + chunk.length > buf.length) { const nb = new Float32Array(Math.max(buf.length * 2, len + chunk.length)); nb.set(buf.subarray(0, len)); buf = nb; }
      buf.set(chunk, len); len += chunk.length;
      while (frames.length * hop + N <= len) {
        const st = frames.length * hop, e = new Float32Array(co.length);
        for (let c = 0; c < co.length; c++) {
          const cc = co[c]; let s1 = 0, s2 = 0;
          for (let i = 0; i < N; i++) { const s0 = buf[st + i] * win[i] + cc * s1 - s2; s2 = s1; s1 = s0; }
          e[c] = s1 * s1 + s2 * s2 - cc * s1 * s2;
        }
        frames.push(e);
      }
    },
    // 時刻tから始まる1音ぶんの、まんなかあたり(35%〜85%)の強さの合計。まだ聞こえていなければnull
    slot(t) {
      const a = Math.max(0, Math.ceil(((t + 0.35 * T) * sr - N / 2) / hop)), b = Math.floor(((t + 0.85 * T) * sr - N / 2) / hop);
      if (b >= frames.length) return null;
      const v = new Float32Array(co.length);
      for (let k = a; k <= b; k++) for (let c = 0; c < co.length; c++) v[c] += frames[k][c];
      return v;
    },
  };
}
const share = (v, c, n = v.length) => { let s = 0; for (let i = 0; i < n; i++) s += v[i]; return s > 0 ? v[c] / s : 0; };
const argmax8 = (v) => { let best = 0; for (let i = 1; i < 8; i++) if (v[i] > v[best]) best = i; return best; };

// 聞こえたぶんだけ読みすすめる。{status: 'listening'|'reading'|'done'|'fail', got, total, text}
async function listenStep(L) {
  if (L.sync === null) {
    let t = L.scanFrom, region = null, waiting = false;
    for (;; t += 0.01) {
      let s = 0;
      for (let m = 0; m < MARK_LEN; m++) { const v = L.slot(t + m * T); if (!v) { waiting = true; break; } s += share(v, 8 + (m % 2)); }
      if (waiting) break;
      if (s > 3) { if (!region) region = [t, t]; region[1] = t; } else if (region) break;
    }
    if (waiting) { L.scanFrom = region ? region[0] : Math.max(0, t - 0.01); return { status: 'listening' }; }
    L.sync = (region[0] + region[1]) / 2;
  }
  const hdr = [];
  for (let j = 0; j < 3; j++) {
    const sum = new Float32Array(8);
    for (let r = 0; r < 3; r++) {
      const v = L.slot(L.sync + (MARK_LEN + r * 3 + j) * T);
      if (!v) return { status: 'reading', got: 0, total: 1 };
      for (let c = 0; c < 8; c++) sum[c] += share(v, c, 8);
    }
    hdr.push(argmax8(sum));
  }
  const k = hdr[0] * 64 + hdr[1] * 8 + hdr[2];
  if (k < 1 || k > MAX_K) return { status: 'fail' };
  const nsym = nsymFor(k), n = k + nsym, total = Math.ceil((n * 8) / 3);
  const bits = [];
  for (let i = 0; i < total; i++) {
    const v = L.slot(L.sync + (MARK_LEN + HDR_LEN + i) * T);
    if (!v) return { status: 'reading', got: i, total };
    const s = argmax8(v);
    bits.push((s >> 2) & 1, (s >> 1) & 1, s & 1);
  }
  const code = [];
  for (let i = 0; i < n; i++) code.push(bits.slice(i * 8, i * 8 + 8).reduce((x, b) => x * 2 + b, 0));
  try { return { status: 'done', text: await unpackText(rsDecode(code, nsym)), got: total, total }; }
  catch (e) { return { status: 'fail' }; }
}
async function decodeSamples(samples, sr) {
  const L = makeListener(sr);
  L.append(samples);
  L.append(new Float32Array(sr)); // 末尾がちょうど切れていても最後の音まで はかれるように
  const r = await listenStep(L);
  return r.status === 'done' ? r : { status: 'fail' };
}
