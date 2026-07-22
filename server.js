// ============================================================
//  لعبة "بورصة الأصدقاء" - محفظة أسهم جماعية
//  شاشة تلفزيون (host) + جوالات اللاعبين (player)
// ============================================================
const express = require('express');
const http = require('http');
const os = require('os');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set('trust proxy', 1);
app.use(express.static(__dirname + '/public'));
app.get('/', (req, res) => res.redirect('/host.html'));
app.get('/healthz', (req, res) => res.send('ok'));

// ------------------------------------------------------------
//  بيانات الأسهم الأساسية
// ------------------------------------------------------------
const STOCK_DEFS = [
  { id: 'btc',  name: 'بيتكوين',        icon: '₿', price: 60000, volatility: 0.10, dividend: false },
  { id: 'eth',  name: 'إيثيريوم',       icon: 'Ξ', price: 3000,  volatility: 0.11, dividend: false },
  { id: 'gold', name: 'ذهب',            icon: '🥇', price: 2000,  volatility: 0.012, dividend: false },
  { id: 'slv',  name: 'فضة',            icon: '🥈', price: 25,    volatility: 0.02,  dividend: false },
  { id: 'oil',  name: 'نفط',            icon: '🛢️', price: 80,    volatility: 0.05,  dividend: false },
  { id: 'tsla', name: 'تسلا',           icon: '🚗', price: 250,   volatility: 0.08,  dividend: false },
  { id: 'aapl', name: 'آبل',            icon: '🍎', price: 190,   volatility: 0.02,  dividend: true  },
  { id: 'amzn', name: 'أمازون',         icon: '📦', price: 180,   volatility: 0.03,  dividend: false },
  { id: 'bank', name: 'بنك الراجحي',    icon: '🏦', price: 50,    volatility: 0.015, dividend: true  },
  { id: 'air',  name: 'الدريس',         icon: '⛽', price: 30,    volatility: 0.07,  dividend: false },
];

// ------------------------------------------------------------
//  الأخبار (عامة / خاصة بسهم)
// ------------------------------------------------------------
const NEWS_POOL = [
  { scope: 'global', type: 'pos', text: 'تحسّن مؤشرات الاقتصاد العالمي.. ارتفاع عام في كل الأسواق!', min: 0.03, max: 0.07 },
  { scope: 'global', type: 'pos', text: 'البنك المركزي يخفض الفائدة.. موجة تفاؤل تجتاح الأسواق', min: 0.02, max: 0.05 },
  { scope: 'global', type: 'neg', text: 'أزمة اقتصادية عالمية مفاجئة.. هبوط حاد في كل الأسواق!', min: 0.04, max: 0.08 },
  { scope: 'global', type: 'neg', text: 'ارتفاع التضخم يثير قلق المستثمرين.. تراجع عام في الأسعار', min: 0.02, max: 0.05 },

  { scope: 'btc', type: 'pos', text: 'دولة كبرى تعلن اعتماد البيتكوين عملة رسمية!', min: 0.18, max: 0.38 },
  { scope: 'btc', type: 'neg', text: 'حظر تعدين العملات الرقمية في دولة كبرى', min: 0.18, max: 0.35 },
  { scope: 'eth', type: 'pos', text: 'تحديث ضخم لشبكة إيثيريوم يبهر المطورين', min: 0.15, max: 0.32 },
  { scope: 'eth', type: 'neg', text: 'ثغرة أمنية تهز الثقة بعملة إيثيريوم', min: 0.15, max: 0.3 },
  { scope: 'gold', type: 'pos', text: 'توتر جيوسياسي يدفع المستثمرين نحو الذهب كملاذ آمن', min: 0.05, max: 0.09 },
  { scope: 'gold', type: 'neg', text: 'الدولار يقوى بشكل كبير.. تراجع في أسعار الذهب', min: 0.03, max: 0.06 },
  { scope: 'slv', type: 'pos', text: 'طلب صناعي كبير يرفع أسعار الفضة', min: 0.05, max: 0.1 },
  { scope: 'slv', type: 'neg', text: 'تراجع الطلب الصناعي على الفضة', min: 0.04, max: 0.08 },
  { scope: 'oil', type: 'pos', text: 'أوبك+ تتفق على خفض الإنتاج بشكل كبير', min: 0.12, max: 0.24 },
  { scope: 'oil', type: 'neg', text: 'فائض ضخم في المعروض النفطي العالمي', min: 0.12, max: 0.22 },
  { scope: 'tsla', type: 'pos', text: 'تسلا تكسر الرقم القياسي لمبيعات الربع الحالي', min: 0.14, max: 0.28 },
  { scope: 'tsla', type: 'neg', text: 'استدعاء واسع لسيارات تسلا بسبب عيب فني', min: 0.14, max: 0.25 },
  { scope: 'aapl', type: 'pos', text: 'آبل تطلق منتجاً ثورياً جديداً يبهر الأسواق', min: 0.06, max: 0.12 },
  { scope: 'aapl', type: 'neg', text: 'تراجع كبير في مبيعات آيفون بالسوق الصيني', min: 0.05, max: 0.1 },
  { scope: 'amzn', type: 'pos', text: 'أمازون تحقق أرباحاً قياسية في موسم التسوق', min: 0.08, max: 0.15 },
  { scope: 'amzn', type: 'neg', text: 'إضراب واسع لعمال مستودعات أمازون', min: 0.07, max: 0.13 },
  { scope: 'bank', type: 'pos', text: 'بنك الراجحي يعلن أرباحاً فصلية قوية', min: 0.04, max: 0.08 },
  { scope: 'bank', type: 'neg', text: 'فضيحة مالية تهز قطاع البنوك', min: 0.06, max: 0.12 },
  { scope: 'air',  type: 'pos', text: 'الدريس تفتتح محطات وقود جديدة وتحقق نمواً قياسياً بالإيرادات', min: 0.1, max: 0.2 },
  { scope: 'air',  type: 'neg', text: 'ارتفاع تكاليف التشغيل يضغط على هوامش أرباح الدريس', min: 0.09, max: 0.18 },
];

// ------------------------------------------------------------
//  بطاقات فرصة / تحدي
// ------------------------------------------------------------
const CARDS = [
  { type: 'opportunity', text: 'بطاقة فرصة 🎉: هبة نقدية مفاجئة +2,000$', apply: p => { p.cash += 2000; } },
  { type: 'opportunity', text: 'بطاقة فرصة 🎉: صفقتك القادمة بدون فرق سعر (سبريد)', apply: p => { p.noSpreadNext = true; } },
  { type: 'opportunity', text: 'بطاقة فرصة 🎉: أرباح توزيعاتك القادمة مضاعفة', apply: p => { p.doubleDividend = true; } },
  { type: 'challenge',   text: 'بطاقة تحدي ⚠️: رسوم مفاجئة -1,000$', apply: p => { p.cash = Math.max(0, p.cash - 1000); } },
  { type: 'challenge',   text: 'بطاقة تحدي ⚠️: تجميد سهم عشوائي من محفظتك لمدة 30 ثانية', apply: (p, game) => {
      const owned = Object.keys(p.holdings).filter(id => p.holdings[id] > 0);
      const target = owned.length ? owned[Math.floor(Math.random() * owned.length)]
                                   : STOCK_DEFS[Math.floor(Math.random() * STOCK_DEFS.length)].id;
      p.frozenStock = target;
      p.frozenUntil = Date.now() + 30000;
    } },
  { type: 'challenge', text: 'بطاقة تحدي ⚠️: "ضريبة النجاح" -3% من رصيدك النقدي', apply: p => { p.cash = Math.round(p.cash * 0.97); } },
];

const SPREAD = 0.006;        // فرق سعر البيع/الشراء الكلي 0.6% (0.3% فوق ± 0.3% تحت منتصف السعر)
const TICK_MS = 11000;       // تحديث الأسعار كل 11 ثانية
const START_CASH = 100000;
const MARGIN_MS = 5 * 60000; // مدة التمويل المضاعف: 5 دقائق
const MARGIN_MAX_USES = 3;   // عدد مرات التمويل المسموحة لكل لاعب

function round2(n) { return Math.round(n * 100) / 100; }

// ------------------------------------------------------------
//  إدارة الألعاب (غرف)
// ------------------------------------------------------------
const games = new Map(); // code -> game

function randCode() {
  let code;
  do { code = String(Math.floor(1000 + Math.random() * 9000)); } while (games.has(code));
  return code;
}

function makeCandle(open, close) {
  const body = Math.abs(close - open) || open * 0.001;
  const upWick = body * (0.2 + Math.random() * 0.6);
  const downWick = body * (0.2 + Math.random() * 0.6);
  const high = Math.max(open, close) + upWick;
  const low = Math.max(0.01, Math.min(open, close) - downWick);
  return { o: round2(open), h: round2(high), l: round2(low), c: round2(close) };
}

function freshStocks() {
  return STOCK_DEFS.map(s => ({
    ...s,
    startPrice: s.price,
    prevPrice: s.price,
    changePct: 0,
    candles: [{ o: s.price, h: s.price, l: s.price, c: s.price }],
  }));
}

function createGame(hostSocketId) {
  const code = randCode();
  const game = {
    code,
    hostSocketId,
    hostToken: crypto.randomUUID(),
    status: 'lobby',       // lobby | running | ended
    durationMs: 30 * 60000,
    startTime: null,
    endTime: null,
    stocks: freshStocks(),
    players: new Map(),    // socketId -> player
    news: [],              // recent news log
    timers: {},
  };
  games.set(code, game);
  return game;
}

function newPlayer(name) {
  return {
    id: null,
    token: crypto.randomUUID(),
    name,
    cash: START_CASH,
    holdings: {},          // stockId -> qty (whole shares)
    costBasis: {},         // stockId -> total $ invested in current open position
    orders: [],            // transaction history
    noSpreadNext: false,
    doubleDividend: false,
    frozenStock: null,
    frozenUntil: 0,
    marginActive: false,
    marginLoan: 0,
    marginExpiresAt: 0,
    marginUsesLeft: MARGIN_MAX_USES,
    history: [START_CASH],
    joinedAt: Date.now(),
    connected: true,
  };
}

function applyBuy(player, stock, qty, price) {
  const cost = qty * price;
  player.cash -= cost;
  player.holdings[stock.id] = (player.holdings[stock.id] || 0) + qty;
  player.costBasis[stock.id] = (player.costBasis[stock.id] || 0) + cost;
  recordOrder(player, stock, 'buy', qty, price);
}

function applySell(player, stock, qty, price) {
  const owned = player.holdings[stock.id] || 0;
  const avgCost = owned > 0 ? (player.costBasis[stock.id] || 0) / owned : 0;
  const proceeds = qty * price;
  player.holdings[stock.id] = Math.max(0, owned - qty);
  player.costBasis[stock.id] = Math.max(0, (player.costBasis[stock.id] || 0) - avgCost * qty);
  if (player.holdings[stock.id] <= 0) { player.holdings[stock.id] = 0; player.costBasis[stock.id] = 0; }
  player.cash += proceeds;
  recordOrder(player, stock, 'sell', qty, price);
}

function activateMargin(game, player) {
  if (player.marginActive) return { ok: false, msg: 'لديك تمويل مضاعف نشط بالفعل' };
  if (player.marginUsesLeft <= 0) return { ok: false, msg: 'استخدمت كل مرات التمويل المضاعف المتاحة (3)' };
  const loan = Math.round(player.cash);
  if (loan <= 0) return { ok: false, msg: 'لا يوجد رصيد نقدي كافٍ لأخذ تمويل' };
  player.cash += loan;
  player.marginLoan = loan;
  player.marginActive = true;
  player.marginUsesLeft -= 1;
  player.marginExpiresAt = Date.now() + MARGIN_MS;
  const timerKey = 'margin_' + player.token;
  game.timers[timerKey] = setTimeout(() => closeMargin(game, player), MARGIN_MS);
  addNews(game, `🚀 ${player.name} فعّل تمويل مضاعف! رأس ماله تضاعف مؤقتاً لمدة 5 دقائق`, 'pos', null);
  return { ok: true };
}

function closeMargin(game, player) {
  if (!player.marginActive) return;
  for (const s of game.stocks) {
    const qty = player.holdings[s.id] || 0;
    if (qty > 0) {
      const sellPrice = s.price * (1 - SPREAD / 2);
      applySell(player, s, qty, sellPrice);
    }
  }
  player.cash -= player.marginLoan;
  if (player.cash < 0) player.cash = 0;
  player.marginActive = false;
  player.marginLoan = 0;
  player.marginExpiresAt = 0;
  delete game.timers['margin_' + player.token];
  addNews(game, `⏰ انتهت مهلة تمويل ${player.name} — تصفية تلقائية لمحفظته وسداد التمويل`, 'neg', null);
  broadcast(game);
}

function recordOrder(player, stock, action, qty, price) {
  player.orders.unshift({
    stockId: stock.id,
    stockName: stock.name,
    icon: stock.icon,
    action,
    qty,
    price: round2(price),
    total: round2(qty * price),
    time: Date.now(),
  });
  if (player.orders.length > 100) player.orders.length = 100;
}

function portfolioValue(game, player) {
  let v = player.cash;
  for (const s of game.stocks) {
    const qty = player.holdings[s.id] || 0;
    if (qty) v += qty * s.price;
  }
  if (player.marginActive) v -= player.marginLoan; // القرض التزام يُخصم من صافي القيمة
  return Math.round(v);
}

function leaderboard(game) {
  return [...game.players.values()]
    .map(p => {
      const value = portfolioValue(game, p);
      const gainPct = Math.round(((value - START_CASH) / START_CASH) * 10000) / 100;
      return {
        name: p.name,
        cash: Math.round(p.cash),
        value,
        gainPct,
        holdings: p.holdings,
        connected: p.connected,
        marginActive: p.marginActive,
      };
    })
    .sort((a, b) => b.value - a.value);
}

function publicState(game) {
  const now = Date.now();
  let timeLeftMs = 0;
  if (game.status === 'running') timeLeftMs = Math.max(0, game.endTime - now);
  else if (game.status === 'lobby') timeLeftMs = game.durationMs;
  return {
    code: game.code,
    status: game.status,
    durationMs: game.durationMs,
    timeLeftMs,
    stocks: game.stocks.map(s => ({
      id: s.id, name: s.name, icon: s.icon,
      price: round2(s.price),
      buyPrice: round2(s.price * (1 + SPREAD / 2)),
      sellPrice: round2(s.price * (1 - SPREAD / 2)),
      changePct: s.changePct,
      sessionChangePct: Math.round(((s.price - s.startPrice) / s.startPrice) * 10000) / 100,
      dividend: s.dividend,
      candles: s.candles,
    })),
    players: leaderboard(game),
    news: game.news.slice(-8),
  };
}

function playerState(game, socketId) {
  const p = game.players.get(socketId);
  if (!p) return null;
  const value = portfolioValue(game, p);
  const avgCost = {};
  for (const sid of Object.keys(p.holdings)) {
    const qty = p.holdings[sid];
    if (qty > 0) avgCost[sid] = round2((p.costBasis[sid] || 0) / qty);
  }
  return {
    name: p.name,
    token: p.token,
    cash: Math.round(p.cash),
    value,
    gainPct: Math.round(((value - START_CASH) / START_CASH) * 10000) / 100,
    holdings: p.holdings,
    avgCost,
    orders: p.orders,
    noSpreadNext: p.noSpreadNext,
    doubleDividend: p.doubleDividend,
    frozenStock: p.frozenUntil > Date.now() ? p.frozenStock : null,
    marginActive: p.marginActive,
    marginLoan: p.marginLoan,
    marginExpiresAt: p.marginActive ? p.marginExpiresAt : 0,
    marginUsesLeft: p.marginUsesLeft,
    history: p.history,
  };
}

function broadcast(game) {
  // track portfolio value history per player (for possible future mini chart)
  for (const p of game.players.values()) {
    const v = portfolioValue(game, p);
    const last = p.history[p.history.length - 1];
    if (last !== v) {
      p.history.push(v);
      if (p.history.length > 60) p.history.shift();
    }
  }
  io.to('room:' + game.code).emit('state:update', publicState(game));
  for (const socketId of game.players.keys()) {
    io.to(socketId).emit('player:update', playerState(game, socketId));
  }
}

function addNews(game, text, type, stockId) {
  game.news.push({ text, type, stockId, t: Date.now() });
  io.to('room:' + game.code).emit('news:event', { text, type, stockId });
}

// ------------------------------------------------------------
//  حلقات اللعبة
// ------------------------------------------------------------
function tickPrices(game) {
  for (const s of game.stocks) {
    const open = s.price;
    const randomWalk = (Math.random() - 0.5) * 2 * s.volatility;
    const close = Math.max(0.5, open * (1 + randomWalk));
    s.prevPrice = open;
    s.price = close;
    s.changePct = Math.round(((close - open) / open) * 10000) / 100;
    s.candles.push(makeCandle(open, close));
    if (s.candles.length > 60) s.candles.shift();
  }
}

function triggerNews(game) {
  const item = NEWS_POOL[Math.floor(Math.random() * NEWS_POOL.length)];
  const pct = item.min + Math.random() * (item.max - item.min);
  const sign = item.type === 'pos' ? 1 : -1;
  if (item.scope === 'global') {
    for (const s of game.stocks) {
      const open = s.price;
      s.price = Math.max(0.5, s.price * (1 + sign * pct));
      s.candles.push(makeCandle(open, s.price));
      if (s.candles.length > 60) s.candles.shift();
    }
    addNews(game, item.text, item.type, null);
  } else {
    const s = game.stocks.find(x => x.id === item.scope);
    if (s) {
      const open = s.price;
      s.price = Math.max(0.5, s.price * (1 + sign * pct));
      s.candles.push(makeCandle(open, s.price));
      if (s.candles.length > 60) s.candles.shift();
      addNews(game, `${s.icon} ${s.name}: ${item.text}`, item.type, s.id);
    }
  }
}

function payDividends(game) {
  const payers = game.stocks.filter(s => s.dividend);
  if (!payers.length) return;
  let paidAny = false;
  for (const p of game.players.values()) {
    let total = 0;
    for (const s of payers) {
      const qty = p.holdings[s.id] || 0;
      if (qty > 0) total += qty * s.price * 0.02; // 2% توزيعات
    }
    if (total > 0) {
      if (p.doubleDividend) { total *= 2; p.doubleDividend = false; }
      p.cash += total;
      paidAny = true;
    }
  }
  if (paidAny) addNews(game, '💰 توزيعات أرباح! حاملو أسهم آبل وبنك الراجحي حصلوا على أرباح نقدية', 'pos', null);
}

function drawCard(game) {
  const players = [...game.players.values()];
  if (!players.length) return;
  const player = players[Math.floor(Math.random() * players.length)];
  const card = CARDS[Math.floor(Math.random() * CARDS.length)];
  card.apply(player, game);
  io.to(player.id).emit('card:drawn', { text: card.text, type: card.type });
  addNews(game, `🎴 ${player.name} سحب ${card.text}`, card.type === 'opportunity' ? 'pos' : 'neg', null);
}

function startGame(game, durationMs) {
  game.status = 'running';
  game.durationMs = durationMs;
  game.startTime = Date.now();
  game.endTime = game.startTime + durationMs;

  game.timers.price = setInterval(() => { tickPrices(game); broadcast(game); }, TICK_MS);
  scheduleNews(game);
  game.timers.dividend = setInterval(() => { payDividends(game); broadcast(game); }, 90000);
  game.timers.card = setInterval(() => { drawCard(game); }, 50000);
  game.timers.broadcast = setInterval(() => broadcast(game), 1500);
  game.timers.end = setTimeout(() => endGame(game), durationMs);

  broadcast(game);
}

function scheduleNews(game) {
  const delay = 20000 + Math.random() * 20000; // 20-40s
  game.timers.news = setTimeout(() => {
    if (game.status !== 'running') return;
    triggerNews(game);
    broadcast(game);
    scheduleNews(game);
  }, delay);
}

function endGame(game) {
  game.status = 'ended';
  clearAllTimers(game);
  const results = leaderboard(game);
  io.to('room:' + game.code).emit('game:ended', { results });
  broadcast(game);
}

function clearAllTimers(game) {
  for (const key of Object.keys(game.timers)) {
    clearInterval(game.timers[key]);
    clearTimeout(game.timers[key]);
  }
  game.timers = {};
}

// ------------------------------------------------------------
//  Socket.io
// ------------------------------------------------------------
io.on('connection', socket => {

  socket.on('host:create', () => {
    const game = createGame(socket.id);
    socket.join('room:' + game.code);
    socket.data.hostCode = game.code;
    socket.emit('host:created', { code: game.code, hostToken: game.hostToken });
    broadcast(game);
  });

  socket.on('host:rejoin', ({ code, hostToken }) => {
    const game = games.get(code);
    if (!game || game.hostToken !== hostToken) { socket.emit('errorMsg', 'تعذر استرجاع الجلسة، أنشئ لعبة جديدة'); return; }
    game.hostSocketId = socket.id;
    socket.join('room:' + game.code);
    socket.data.hostCode = game.code;
    socket.emit('host:created', { code: game.code, hostToken: game.hostToken });
    broadcast(game);
  });

  socket.on('host:start', ({ code, durationMs }) => {
    const game = games.get(code);
    if (!game || game.status !== 'lobby') return;
    if (game.players.size < 1) { socket.emit('errorMsg', 'أضف لاعباً واحداً على الأقل قبل البدء'); return; }
    startGame(game, durationMs || 30 * 60000);
  });

  socket.on('host:reset', ({ code }) => {
    const game = games.get(code);
    if (!game) return;
    clearAllTimers(game);
    game.status = 'lobby';
    game.stocks = freshStocks();
    game.news = [];
    for (const p of game.players.values()) {
      p.cash = START_CASH; p.holdings = {}; p.costBasis = {}; p.orders = []; p.noSpreadNext = false;
      p.doubleDividend = false; p.frozenStock = null; p.frozenUntil = 0;
      p.marginActive = false; p.marginLoan = 0; p.marginExpiresAt = 0; p.marginUsesLeft = MARGIN_MAX_USES;
      p.history = [START_CASH];
    }
    broadcast(game);
  });

  socket.on('player:join', ({ code, name }) => {
    const game = games.get(code);
    if (!game) { socket.emit('errorMsg', 'كود اللعبة غير صحيح'); return; }
    if (game.status !== 'lobby') { socket.emit('errorMsg', 'اللعبة بدأت بالفعل، انتظر الجولة القادمة'); return; }
    if (game.players.size >= 10) { socket.emit('errorMsg', 'اكتمل عدد اللاعبين (10)'); return; }
    const player = newPlayer(name.trim().slice(0, 16) || 'لاعب');
    player.id = socket.id;
    game.players.set(socket.id, player);
    socket.join('room:' + game.code);
    socket.data.gameCode = code;
    socket.data.token = player.token;
    socket.emit('player:joined', { code, name: player.name, token: player.token });
    broadcast(game);
  });

  socket.on('player:rejoin', ({ code, token }) => {
    const game = games.get(code);
    if (!game) { socket.emit('errorMsg', 'كود اللعبة غير صحيح أو انتهت اللعبة'); return; }
    let found = null, oldId = null;
    for (const [sid, p] of game.players.entries()) {
      if (p.token === token) { found = p; oldId = sid; break; }
    }
    if (!found) { socket.emit('errorMsg', 'تعذر استرجاع جلستك، انضم من جديد'); return; }
    if (oldId !== socket.id) {
      game.players.delete(oldId);
      found.id = socket.id;
      game.players.set(socket.id, found);
    }
    found.connected = true;
    socket.join('room:' + game.code);
    socket.data.gameCode = code;
    socket.data.token = found.token;
    socket.emit('player:joined', { code, name: found.name, token: found.token, rejoined: true, status: game.status });
    broadcast(game);
  });

  socket.on('player:trade', ({ code, stockId, action, qty }) => {
    const game = games.get(code);
    if (!game || game.status !== 'running') return;
    const player = game.players.get(socket.id);
    if (!player) return;
    const stock = game.stocks.find(s => s.id === stockId);
    if (!stock) return;

    qty = Math.floor(Number(qty));
    if (!qty || qty <= 0) { socket.emit('errorMsg', 'اختر كمية صحيحة'); return; }

    if (player.frozenStock === stockId && player.frozenUntil > Date.now()) {
      socket.emit('errorMsg', 'هذا السهم مجمد مؤقتاً بسبب بطاقة تحدي!');
      return;
    }

    const useMid = player.noSpreadNext;
    const buyPrice = useMid ? stock.price : stock.price * (1 + SPREAD / 2);
    const sellPrice = useMid ? stock.price : stock.price * (1 - SPREAD / 2);

    if (action === 'buy') {
      const cost = qty * buyPrice;
      if (cost > player.cash + 0.01) { socket.emit('errorMsg', 'رصيدك النقدي لا يكفي لهذه الكمية'); return; }
      applyBuy(player, stock, qty, buyPrice);
      socket.emit('trade:confirmed', { action: 'buy', qty, price: round2(buyPrice), total: round2(cost), stockName: stock.name, icon: stock.icon });
    } else if (action === 'sell') {
      const owned = player.holdings[stockId] || 0;
      if (qty > owned) { socket.emit('errorMsg', 'لا تملك هذه الكمية لبيعها'); return; }
      const proceeds = qty * sellPrice;
      applySell(player, stock, qty, sellPrice);
      socket.emit('trade:confirmed', { action: 'sell', qty, price: round2(sellPrice), total: round2(proceeds), stockName: stock.name, icon: stock.icon });
    } else {
      return;
    }

    if (player.noSpreadNext) player.noSpreadNext = false;
    broadcast(game);
  });

  socket.on('player:margin', ({ code }) => {
    const game = games.get(code);
    if (!game || game.status !== 'running') return;
    const player = game.players.get(socket.id);
    if (!player) return;
    const res = activateMargin(game, player);
    if (!res.ok) { socket.emit('errorMsg', res.msg); return; }
    broadcast(game);
  });

  socket.on('disconnect', () => {
    const code = socket.data.gameCode;
    if (code && games.has(code)) {
      const game = games.get(code);
      if (game.players.has(socket.id)) {
        if (game.status === 'lobby') {
          game.players.delete(socket.id);
        } else {
          const p = game.players.get(socket.id);
          if (p) p.connected = false;
        }
        broadcast(game);
      }
    }
    for (const game of games.values()) {
      if (game.hostSocketId === socket.id && game.status === 'lobby' && game.players.size === 0) {
        clearAllTimers(game);
        games.delete(game.code);
      }
    }
  });
});

// ------------------------------------------------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  console.log('==============================================');
  console.log('  بورصة الأصدقاء تعمل الآن 🎮');
  console.log('  افتح شاشة التلفزيون على:');
  console.log(`     http://localhost:${PORT}/host.html`);
  if (ips.length) {
    ips.forEach(ip => console.log(`     http://${ip}:${PORT}/host.html`));
    console.log('  واللاعبون يفتحون من جوالاتهم (نفس شبكة الواي فاي):');
    ips.forEach(ip => console.log(`     http://${ip}:${PORT}/player.html`));
  }
  console.log('==============================================');
});
