// ============================================================
//  دوال مشتركة بين شاشة المضيف وشاشة اللاعب
// ============================================================

function fmtMoney(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

function fmtTime(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60), s = totalSec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function fmtClock(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}

// يمنع حقن HTML من أسماء اللاعبين (نص حر يدخله المستخدم) قبل إدراجها بالصفحة
const _escMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, c => _escMap[c]);
}

const AVATAR_COLORS = ['#00c805', '#5b8def', '#ffb020', '#ff5252', '#a78bfa', '#22d3ee', '#f472b6', '#fbbf24', '#34d399', '#f87171'];
function colorFor(name) {
  let h = 0;
  for (const c of (name || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(name) { return (name || '?').trim().slice(0, 2).toUpperCase(); }

// ------------------------------------------------------------
//  رسم شموع يابانية مفرغة (hollow candles) على canvas
//  candles: [{o,h,l,c}, ...]  الأقدم أولاً
// ------------------------------------------------------------
function drawCandles(canvas, candles, count) {
  if (!canvas || !candles || !candles.length) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const list = count ? candles.slice(-count) : candles;
  let min = Infinity, max = -Infinity;
  list.forEach(c => { if (c.l < min) min = c.l; if (c.h > max) max = c.h; });
  if (!isFinite(min) || !isFinite(max) || min === max) { min -= 1; max += 1; }
  const pad = h * 0.1;
  const range = (max - min) || 1;
  const yOf = v => h - pad - ((v - min) / range) * (h - pad * 2);

  const n = list.length;
  const slot = w / n;
  const bodyW = Math.max(1.5, Math.min(slot * 0.62, 11));

  list.forEach((c, i) => {
    const x = slot * i + slot / 2;
    const up = c.c >= c.o;
    const color = up ? '#00c805' : '#ff5252';

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, yOf(c.h));
    ctx.lineTo(x, yOf(c.l));
    ctx.stroke();

    const yOpen = yOf(c.o), yClose = yOf(c.c);
    const top = Math.min(yOpen, yClose);
    const bh = Math.max(1.2, Math.abs(yClose - yOpen));
    if (up) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.strokeRect(x - bodyW / 2, top, bodyW, bh);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(x - bodyW / 2, top, bodyW, bh);
    }
  });
}

// ------------------------------------------------------------
//  نغمة قصيرة عند الأخبار (بدون ملفات صوتية خارجية)
// ------------------------------------------------------------
let _audioCtx;
function playChime(type) {
  try {
    _audioCtx = _audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _audioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const freqs = type === 'neg' ? [520, 370] : [660, 880];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      const t0 = now + i * 0.12;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.38);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + 0.4);
    });
  } catch (e) { /* الصوت غير متاح، تجاهل */ }
}
