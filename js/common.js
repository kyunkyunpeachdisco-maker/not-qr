// ===== 3つのアプリで共通の しくみ =====
const $ = (id) => document.getElementById(id);
const groups = (s, n) => s.match(new RegExp(`.{1,${n}}`, 'g')) || [];

// ===== リード・ソロモン符号(GF(256))。読みまちがえた部分を あとから なおす =====
const GF_EXP = new Uint8Array(512), GF_LOG = new Uint8Array(256);
{ let x = 1; for (let i = 0; i < 255; i++) { GF_EXP[i] = x; GF_LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; } for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255]; }
const gfMul = (a, b) => (a && b ? GF_EXP[GF_LOG[a] + GF_LOG[b]] : 0);
const gfPow = (a, n) => GF_EXP[(((GF_LOG[a] * n) % 255) + 255) % 255];
const gfInv = (a) => GF_EXP[255 - GF_LOG[a]];
const gfDiv = (a, b) => (a ? GF_EXP[(GF_LOG[a] + 255 - GF_LOG[b]) % 255] : 0);
const polyScale = (p, x) => p.map((c) => gfMul(c, x));
const polyAdd = (p, q) => {
  const r = new Array(Math.max(p.length, q.length)).fill(0);
  p.forEach((c, i) => { r[i + r.length - p.length] ^= c; });
  q.forEach((c, i) => { r[i + r.length - q.length] ^= c; });
  return r;
};
const polyMul = (p, q) => {
  const r = new Array(p.length + q.length - 1).fill(0);
  for (let i = 0; i < p.length; i++) for (let j = 0; j < q.length; j++) r[i + j] ^= gfMul(p[i], q[j]);
  return r;
};
const polyEval = (p, x) => p.reduce((y, c) => gfMul(y, x) ^ c, 0);

function rsEncode(msg, nsym) {
  let g = [1];
  for (let i = 0; i < nsym; i++) g = polyMul(g, [1, GF_EXP[i]]);
  const out = [...msg, ...new Array(nsym).fill(0)];
  for (let i = 0; i < msg.length; i++) { const c = out[i]; if (c) for (let j = 1; j < g.length; j++) out[i + j] ^= gfMul(g[j], c); }
  return [...msg, ...out.slice(msg.length)];
}
// Berlekamp-Massey で誤りの位置、Forney で誤りの値を求める
function rsDecode(code, nsym) {
  const msg = [...code];
  const synd = [0];
  for (let i = 0; i < nsym; i++) synd.push(polyEval(msg, GF_EXP[i]));
  if (synd.every((s) => !s)) return msg.slice(0, -nsym);
  let errLoc = [1], oldLoc = [1];
  for (let i = 0; i < nsym; i++) {
    const K = i + 1;
    let delta = synd[K];
    for (let j = 1; j < errLoc.length; j++) delta ^= gfMul(errLoc[errLoc.length - 1 - j], synd[K - j]);
    oldLoc = [...oldLoc, 0];
    if (delta) {
      if (oldLoc.length > errLoc.length) { const nl = polyScale(oldLoc, delta); oldLoc = polyScale(errLoc, gfInv(delta)); errLoc = nl; }
      errLoc = polyAdd(errLoc, polyScale(oldLoc, delta));
    }
  }
  while (errLoc.length && !errLoc[0]) errLoc.shift();
  const errs = errLoc.length - 1;
  if (errs * 2 > nsym) throw new Error('too many errors');
  const rev = [...errLoc].reverse(), pos = [];
  for (let i = 0; i < msg.length; i++) if (polyEval(rev, gfPow(2, i)) === 0) pos.push(msg.length - 1 - i);
  if (pos.length !== errs) throw new Error('locate failed');
  const coefPos = pos.map((p) => msg.length - 1 - p);
  let eLoc = [1];
  for (const c of coefPos) eLoc = polyMul(eLoc, polyAdd([1], [gfPow(2, c), 0]));
  const errEval = polyMul([...synd].reverse(), eLoc).slice(-eLoc.length);
  const X = coefPos.map((c) => gfPow(2, c));
  for (let i = 0; i < X.length; i++) {
    const xInv = gfInv(X[i]);
    let prime = 1;
    for (let j = 0; j < X.length; j++) if (j !== i) prime = gfMul(prime, 1 ^ gfMul(xInv, X[j]));
    if (!prime) throw new Error('forney failed');
    msg[pos[i]] ^= gfDiv(gfMul(X[i], polyEval(errEval, xInv)), prime);
  }
  for (let i = 0; i < nsym; i++) if (polyEval(msg, GF_EXP[i])) throw new Error('verify failed');
  return msg.slice(0, -nsym);
}

// ===== ことば ⇔ バイト列(先頭1バイト: bit0=先頭のhttps://を省いた, bit1=圧縮した) =====
async function pipeBytes(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}
async function packText(text) {
  const https = text.startsWith('https://') ? 1 : 0;
  const raw = new TextEncoder().encode(https ? text.slice(8) : text);
  let body = raw, zip = 0;
  if (typeof CompressionStream === 'function') {
    try { const z = await pipeBytes(raw, new CompressionStream('deflate-raw')); if (z.length < raw.length) { body = z; zip = 1; } } catch (e) {}
  }
  return [https | (zip << 1), ...body];
}
async function unpackText(bytes) {
  let body = new Uint8Array(bytes.slice(1));
  if (bytes[0] & 2) body = await pipeBytes(body, new DecompressionStream('deflate-raw'));
  return (bytes[0] & 1 ? 'https://' : '') + new TextDecoder('utf-8', { fatal: true }).decode(body);
}

// 行き先のサイトを 文字で示す。よく知られたサービスは ドメインが完全に一致したときだけ 名前を出す
// (youtube.com.example.xyz のような にせのURLに だまされないように)
const KNOWN_SITES = [
  ['YouTube', ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be']],
  ['X', ['x.com', 'www.x.com', 'mobile.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com']],
  ['Instagram', ['instagram.com', 'www.instagram.com']],
  ['TikTok', ['tiktok.com', 'www.tiktok.com', 'vt.tiktok.com', 'vm.tiktok.com']],
  ['note', ['note.com']],
  ['LINE', ['line.me', 'liff.line.me']],
  ['Googleマップ', ['maps.app.goo.gl']],
];
function siteOf(text) {
  const t = text.trim();
  if (/\s/.test(t)) return null;
  let u; try { u = new URL(t); } catch (e) { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.toLowerCase(), hit = KNOWN_SITES.find(([, hs]) => hs.includes(host));
  return { url: u.href, host, name: hit ? hit[0] : null };
}
const siteLabel = (s) => (s.name ? `${s.name}（${s.host}）` : s.host);
// 読みとった結果の「このばしょへ いく」と 行き先の表示。知らないサイトは 開く前に たしかめる
function showDestination(text, linkId, destId) {
  const s = siteOf(text), link = document.getElementById(linkId), dest = document.getElementById(destId);
  link.classList.toggle('hidden', !s); dest.classList.toggle('hidden', !s);
  if (!s) return;
  link.href = s.url;
  dest.textContent = s.name ? `行き先：${siteLabel(s)}` : `行き先：${s.host}（よく知られたサイトでは ありません。開く前に たしかめてください）`;
  dest.style.color = s.name ? '#7ad17a' : '#ffb46a';
  link.onclick = s.name ? null : (e) => { if (!confirm(`${s.host} を ひらきます。よろしいですか？`)) e.preventDefault(); };
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('load'));
    img.src = typeof src === 'string' ? src : URL.createObjectURL(src);
  });
}
// 動画の場面を移す。iPhoneでは 移ったあとの合図が来ないことがあるので、1.5秒で あきらめて進む
const seekVideo = (v, t) => new Promise((ok) => {
  const done = () => { clearTimeout(tm); ok(); };
  const tm = setTimeout(done, 1500);
  v.onseeked = done; v.currentTime = t;
});
// 動画を読みこんで、t秒の場面を表示できる状態にする。
// iPhoneでは 読みこみ終わりの合図が来ないことがあるので、大きさがわかったら 少しだけ再生して止め、絵を出させる
async function loadVideo(file, t = 0.1) {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.src = URL.createObjectURL(file);
  await new Promise((ok, ng) => { v.onloadedmetadata = ok; v.onerror = () => ng(new Error('load')); v.load(); });
  try { await v.play(); v.pause(); } catch (e) {}
  await seekVideo(v, Math.min(t, (v.duration || 1) / 2));
  return v;
}
const toBlob = (c, type, q) => new Promise((r) => c.toBlob(r, type, q));
// 保存するファイル名の末尾に日時をつける(例: fukkatsu-frame-20261029-103015.jpg)
function stampName(base, ext) {
  const d = new Date(), z = (n) => String(n).padStart(2, '0');
  return `${base}-${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}.${ext}`;
}
// スマホは共有シート(写真やファイルに保存できる)、PCのChrome・Edgeは「名前を付けて保存」、それ以外はダウンロード
async function saveBlob(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  if (/iPhone|iPad|Android/.test(navigator.userAgent) && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch (e) {
      if (e.name === 'AbortError') return;
      // 作るのに 時間が かかると、ボタンを押してから 時間が たちすぎて 共有シートを ひらけない(iPhone)。もう一度 押してもらう
      if (e.name === 'NotAllowedError' && !saveBlob.retrying) return askToSave(blob, name);
    }
  }
  if (window.showSaveFilePicker) {
    try {
      const h = await window.showSaveFilePicker({ suggestedName: name });
      const w = await h.createWritable(); await w.write(blob); await w.close();
      return;
    } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// 時間のかかる保存(動画)。スマホは ボタンを押してから 時間がたつと 共有シートを ひらけないので、
// できあがったら「ほぞんする」ボタンを出して もう一度 押してもらう
function saveBlobLater(blob, name) {
  if (/iPhone|iPad|Android/.test(navigator.userAgent)) return askToSave(blob, name);
  return saveBlob(blob, name);
}
// 「ほぞんする」ボタンを 画面の下に出し、押されたら 保存する(押した その場でなら 共有シートを ひらける)
function askToSave(blob, name) {
  document.getElementById('save-ready')?.remove();
  const box = document.createElement('div');
  box.id = 'save-ready';
  box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:1000;padding:14px 16px calc(14px + env(safe-area-inset-bottom));background:#1b1c2e;border-top:2px solid #ffd23b;display:flex;gap:10px;align-items:center;justify-content:center';
  const ok = document.createElement('button'), no = document.createElement('button');
  ok.textContent = '✓ できました。ここを押して ほぞんする'; ok.style.cssText = 'flex:1;max-width:420px;padding:14px;font-size:16px;font-weight:bold;border:0;border-radius:8px;background:#ffd23b;color:#05060d';
  no.textContent = '×'; no.style.cssText = 'padding:14px 16px;font-size:16px;border:0;border-radius:8px;background:#33354d;color:#fff';
  ok.onclick = async () => { box.remove(); saveBlob.retrying = true; try { await saveBlob(blob, name); } finally { saveBlob.retrying = false; } };
  no.onclick = () => box.remove();
  box.append(ok, no); document.body.append(box);
}

// コピーして、押したボタンの文字を しばらく「✓ コピーしました」にする(メッセージ欄は スクロールで見えないことがあるため)
async function copyWithFeedback(btn, s) {
  const label = btn.dataset.label || (btn.dataset.label = btn.textContent);
  let ok = true;
  try { await navigator.clipboard.writeText(s); }
  catch (e) {
    // クリップボードAPIが使えないときの予備
    const t = document.createElement('textarea'); t.value = s; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select(); ok = document.execCommand('copy'); t.remove();
  }
  btn.textContent = ok ? '✓ コピーしました' : 'コピーできませんでした';
  clearTimeout(btn._t); btn._t = setTimeout(() => { btn.textContent = label; }, 1800);
}

// ===== 動画を 1コマずつ 書きだす(WebCodecs) =====
// 録画(MediaRecorder)だと iPhoneで 途中から コマが 録られなくなることがあるので、
// 決まった時刻ごとに 絵を描いて 時刻つきで 書きだす。使えないブラウザでは null を返す(そのときは 録画で作る)
const scriptsLoaded = {};
function loadScriptOnce(src) {
  if (!scriptsLoaded[src]) scriptsLoaded[src] = new Promise((ok, ng) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = ng; document.head.appendChild(s); });
  return scriptsLoaded[src];
}
// canvas: 描く先(幅・高さは偶数)、audio: { sampleRate, channels: [Float32Array…] } か null。
// コマの作り方は どちらか: draw(t) … t秒の絵を canvas に描く(1/fps 秒ごとに 呼ばれる)
//                          source(emit) … 自分で canvas に描いて emit(その絵の時刻) を呼ぶ。終わったら 返す(動画の再生に 合わせるとき)
async function encodeVideoFile({ canvas, fps = 30, duration, draw, source, audio, bitrate = 8000000, onProgress }) {
  if (!window.VideoEncoder || !window.VideoFrame || (audio && !window.AudioEncoder)) return null;
  const W = canvas.width, H = canvas.height;
  let vconf = null;
  for (const codec of ['avc1.640033', 'avc1.4d0033', 'avc1.42e033']) {
    const c = { codec, width: W, height: H, bitrate, framerate: fps };
    try { if ((await VideoEncoder.isConfigSupported(c)).supported) { vconf = c; break; } } catch (e) {}
  }
  if (!vconf) return null;
  let aconf = null;
  if (audio) {
    aconf = { codec: 'mp4a.40.2', sampleRate: audio.sampleRate, numberOfChannels: audio.channels.length, bitrate: 192000 };
    try { if (!(await AudioEncoder.isConfigSupported(aconf)).supported) return null; } catch (e) { return null; }
  }
  try { await loadScriptOnce('https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/build/mp4-muxer.min.js'); } catch (e) { return null; }
  const target = new Mp4Muxer.ArrayBufferTarget();
  const muxer = new Mp4Muxer.Muxer({ target, video: { codec: 'avc', width: W, height: H }, audio: aconf ? { codec: 'aac', sampleRate: aconf.sampleRate, numberOfChannels: aconf.numberOfChannels } : undefined, fastStart: 'in-memory', firstTimestampBehavior: 'offset' });
  let failed = null;
  const venc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { failed = e; } });
  venc.configure(vconf);
  let count = 0, lastKey = -Infinity;
  const emit = (t) => {
    const frame = new VideoFrame(canvas, { timestamp: Math.round(t * 1e6) });
    const key = t - lastKey >= 2;  // 2秒ごとに キーフレーム
    if (key) lastKey = t;
    venc.encode(frame, { keyFrame: key });
    frame.close(); count++;
    if (onProgress) onProgress(Math.min(1, t / duration));
  };
  if (source) await source(emit);
  else {
    const n = Math.ceil(duration * fps);
    for (let i = 0; i < n; i++) {
      await draw(i / fps);
      emit(i / fps);
      while (venc.encodeQueueSize > 8 && !failed) await new Promise((ok) => setTimeout(ok, 5));
      if (failed) throw failed;
    }
  }
  if (failed || !count) throw failed || new Error('no frames');
  await venc.flush();
  if (aconf) {
    const aenc = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: (e) => { failed = e; } });
    aenc.configure(aconf);
    const len = audio.channels[0].length, step = 4096;
    for (let s = 0; s < len; s += step) {
      const m = Math.min(step, len - s), data = new Float32Array(m * audio.channels.length);
      audio.channels.forEach((ch, k) => data.set(ch.subarray(s, s + m), k * m));
      const ad = new AudioData({ format: 'f32-planar', sampleRate: audio.sampleRate, numberOfFrames: m, numberOfChannels: audio.channels.length, timestamp: Math.round((s / audio.sampleRate) * 1e6), data });
      aenc.encode(ad); ad.close();
      while (aenc.encodeQueueSize > 16 && !failed) await new Promise((ok) => setTimeout(ok, 5));
    }
    await aenc.flush();
  }
  if (failed) throw failed;
  muxer.finalize();
  const blob = new Blob([target.buffer], { type: 'video/mp4' });
  // 書きだした動画の長さが 合っているか たしかめる(おかしければ null にして 録画で作りなおす)
  const ok = await new Promise((res) => {
    const v = document.createElement('video'), url = URL.createObjectURL(blob), tm = setTimeout(() => res(true), 4000);
    v.preload = 'metadata'; v.muted = true;
    v.onloadedmetadata = () => { clearTimeout(tm); res(!isFinite(v.duration) || Math.abs(v.duration - duration) < 1); URL.revokeObjectURL(url); };
    v.onerror = () => { clearTimeout(tm); res(false); };
    v.src = url;
  });
  return ok ? blob : null;
}
