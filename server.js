// ============================================================
//  لعبة "بورصة الأصدقاء" - محفظة أسهم جماعية
//  شاشة تلفزيون (host) + جوالات اللاعبين (player)
// ============================================================
const express = require('express');
const http = require('http');
const os = require('os');
const crypto = require('crypto');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ------------------------------------------------------------
//  Supabase (تسجيل الدخول + حفظ الإنجازات) — اختياري تماماً.
//  إذا ما ضبطت SUPABASE_URL / SUPABASE_SERVICE_KEY كمتغيرات بيئة،
//  اللعبة تشتغل عادي بدون حفظ دائم (بدون أخطاء).
// ------------------------------------------------------------
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || '').trim();
let supabaseAdmin = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  try {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
    console.log('✅ Supabase متصل — الحسابات والإنجازات تُحفظ بشكل دائم.');
  } catch (err) {
    console.error('⚠️  فشل الاتصال بـ Supabase (تأكد أن SUPABASE_URL يبدأ بـ https:// وصحيح):', err.message);
    supabaseAdmin = null;
  }
} else {
  console.log('ℹ️  Supabase غير مُفعّل (لا يوجد SUPABASE_URL/SUPABASE_SERVICE_KEY) — اللعبة تعمل بدون حفظ دائم للحسابات.');
}

app.set('trust proxy', 1);
app.use(express.static(__dirname + '/public'));
app.get('/healthz', (req, res) => res.send('ok'));

// ------------------------------------------------------------
//  بيانات الأسهم الأساسية — 3 قوائم يختار المضيف واحدة قبل البدء
// ------------------------------------------------------------
const STOCK_LISTS = {
  favorites: [
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
    { id: 'sabicagri', name: 'سابك للمغذيات', icon: '🌾', price: 90, volatility: 0.03, dividend: true },
    { id: 'habib', name: 'الحبيب',        icon: '🏥', price: 200,   volatility: 0.025, dividend: false },
  ],
  tasi: [
    { id: 'aramco', name: 'أرامكو السعودية', icon: '🛢️', price: 30,  volatility: 0.02,  dividend: true  },
    { id: 'sabic',   name: 'سابك',            icon: '🏭', price: 90,  volatility: 0.03,  dividend: true  },
    { id: 'snb',     name: 'الأهلي السعودي',  icon: '🏦', price: 40,  volatility: 0.025, dividend: true  },
    { id: 'stc',     name: 'الاتصالات السعودية', icon: '📶', price: 45, volatility: 0.02, dividend: true  },
    { id: 'maaden',  name: 'معادن',           icon: '⛏️', price: 55,  volatility: 0.045, dividend: false },
    { id: 'jarir',   name: 'جرير',            icon: '📚', price: 150, volatility: 0.03,  dividend: true  },
    { id: 'almarai', name: 'المراعي',          icon: '🥛', price: 55,  volatility: 0.02,  dividend: false },
    { id: 'kayan',   name: 'كيان السعودية',    icon: '🧪', price: 12,  volatility: 0.05,  dividend: false },
    { id: 'yamama',  name: 'إسمنت اليمامة',    icon: '🏗️', price: 30,  volatility: 0.035, dividend: true  },
    { id: 'savola',  name: 'صافولا',           icon: '🍬', price: 40,  volatility: 0.03,  dividend: true  },
    { id: 'albilad', name: 'بنك البلاد',       icon: '🏦', price: 30,  volatility: 0.03,  dividend: true  },
    { id: 'flynas',  name: 'طيران ناس',        icon: '✈️', price: 100, volatility: 0.06,  dividend: false },
  ],
  nasdaq: [
    { id: 'msft', name: 'مايكروسوفت',  icon: '🪟', price: 420, volatility: 0.02,  dividend: true  },
    { id: 'googl', name: 'جوجل',        icon: '🔍', price: 175, volatility: 0.025, dividend: false },
    { id: 'nvda', name: 'إنفيديا',      icon: '🎮', price: 130, volatility: 0.06,  dividend: false },
    { id: 'meta', name: 'ميتا',         icon: '📘', price: 560, volatility: 0.035, dividend: false },
    { id: 'nflx', name: 'نتفليكس',      icon: '🎬', price: 680, volatility: 0.04,  dividend: false },
    { id: 'aapl', name: 'آبل',          icon: '🍎', price: 190, volatility: 0.02,  dividend: true  },
    { id: 'amzn', name: 'أمازون',       icon: '📦', price: 180, volatility: 0.03,  dividend: false },
    { id: 'tsla', name: 'تسلا',         icon: '🚗', price: 250, volatility: 0.08,  dividend: false },
    { id: 'intc', name: 'إنتل',         icon: '💻', price: 30,  volatility: 0.04,  dividend: true  },
    { id: 'amd',  name: 'إيه إم دي',    icon: '🔧', price: 150, volatility: 0.05,  dividend: false },
    { id: 'pypl', name: 'بايبال',       icon: '💳', price: 65,  volatility: 0.035, dividend: false },
    { id: 'sbux', name: 'ستاربكس',      icon: '☕', price: 90,  volatility: 0.025, dividend: true  },
  ],
};
const LIST_META = {
  favorites: { label: '⭐ المفضلة' },
  tasi:      { label: '🇸🇦 تاسي' },
  nasdaq:    { label: '🇺🇸 ناسداك' },
};
function stockDefsFor(listKey) { return STOCK_LISTS[listKey] || STOCK_LISTS.favorites; }

// ------------------------------------------------------------
//  شخصية كل سهم: قطاع + نمط شخصية + سيولة (تؤثر بمدى تحرك سعره من صفقة كبيرة)
//  السيولة من 1 (ضعيفة، تتحرك بسرعة) إلى 10 (عالية، مستقرة أمام الصفقات الكبيرة)
// ------------------------------------------------------------
const STOCK_META = {
  btc:       { sector: 'عملات رقمية',    personality: 'High-Risk', liquidity: 8 },
  eth:       { sector: 'عملات رقمية',    personality: 'High-Risk', liquidity: 7 },
  gold:      { sector: 'سلع',            personality: 'Stable',    liquidity: 9 },
  slv:       { sector: 'سلع',            personality: 'Stable',    liquidity: 6 },
  oil:       { sector: 'طاقة',           personality: 'Growth',    liquidity: 7 },
  tsla:      { sector: 'سيارات',         personality: 'Growth',    liquidity: 8 },
  aapl:      { sector: 'تقنية',          personality: 'Stable',    liquidity: 9 },
  amzn:      { sector: 'تجارة إلكترونية', personality: 'Growth',    liquidity: 8 },
  bank:      { sector: 'بنوك',           personality: 'Stable',    liquidity: 7 },
  air:       { sector: 'طاقة/تجزئة',     personality: 'Growth',    liquidity: 5 },
  sabicagri: { sector: 'زراعة/كيماويات', personality: 'Stable',    liquidity: 5 },
  habib:     { sector: 'رعاية صحية',     personality: 'Stable',    liquidity: 4 },
  aramco:    { sector: 'طاقة',           personality: 'Stable',    liquidity: 9 },
  sabic:     { sector: 'بتروكيماويات',   personality: 'Stable',    liquidity: 7 },
  snb:       { sector: 'بنوك',           personality: 'Stable',    liquidity: 8 },
  stc:       { sector: 'اتصالات',        personality: 'Stable',    liquidity: 7 },
  maaden:    { sector: 'تعدين',          personality: 'Growth',    liquidity: 5 },
  jarir:     { sector: 'تجزئة',          personality: 'Stable',    liquidity: 4 },
  almarai:   { sector: 'أغذية',          personality: 'Stable',    liquidity: 5 },
  kayan:     { sector: 'بتروكيماويات',   personality: 'Penny',     liquidity: 3 },
  yamama:    { sector: 'إسمنت',          personality: 'Stable',    liquidity: 4 },
  savola:    { sector: 'أغذية',          personality: 'Stable',    liquidity: 5 },
  albilad:   { sector: 'بنوك',           personality: 'Stable',    liquidity: 5 },
  flynas:    { sector: 'طيران',          personality: 'Growth',    liquidity: 4 },
  msft:      { sector: 'تقنية',          personality: 'Stable',    liquidity: 9 },
  googl:     { sector: 'تقنية',          personality: 'Stable',    liquidity: 9 },
  nvda:      { sector: 'تقنية',          personality: 'Meme',      liquidity: 8 },
  meta:      { sector: 'تقنية',          personality: 'Growth',    liquidity: 8 },
  nflx:      { sector: 'ترفيه',          personality: 'Growth',    liquidity: 7 },
  intc:      { sector: 'تقنية',          personality: 'Penny',     liquidity: 6 },
  amd:       { sector: 'تقنية',          personality: 'Meme',      liquidity: 7 },
  pypl:      { sector: 'تقنية مالية',    personality: 'Growth',    liquidity: 6 },
  sbux:      { sector: 'تجزئة',          personality: 'Stable',    liquidity: 6 },
};
function metaFor(id) { return STOCK_META[id] || { sector: 'عام', personality: 'Growth', liquidity: 5 }; }

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

// قوالب أخبار عامة تُطبّق على أي سهم (تغطي القوائم الجديدة: تاسي وناسداك وأي سهم اكتتاب)
const GENERIC_STOCK_NEWS = [
  { type: 'pos', text: 'يعلن أرباحاً فصلية تفوق توقعات المحللين', min: 0.05, max: 0.12 },
  { type: 'pos', text: 'يوقع صفقة استحواذ كبرى ترفع معنويات المستثمرين', min: 0.08, max: 0.16 },
  { type: 'pos', text: 'ترقية من وكالة تصنيف عالمية تدفع السهم للارتفاع', min: 0.04, max: 0.1  },
  { type: 'pos', text: 'توسع كبير في أسواق جديدة يبهر المستثمرين', min: 0.06, max: 0.13 },
  { type: 'neg', text: 'تراجع حاد في الإيرادات يثير قلق المستثمرين', min: 0.05, max: 0.12 },
  { type: 'neg', text: 'تحقيق تنظيمي مفاجئ يضغط على السهم', min: 0.06, max: 0.14 },
  { type: 'neg', text: 'استقالة الرئيس التنفيذي تربك الأسواق', min: 0.04, max: 0.1  },
  { type: 'neg', text: 'تراجع تصنيفها الائتماني يثير قلق المستثمرين', min: 0.05, max: 0.11 },
];

// يبني حوض أخبار خاص باللعبة الحالية: الأخبار العامة + المخصصة لأسهم موجودة فعلاً + قوالب عامة لكل سهم
function buildNewsPoolForGame(game) {
  const pool = NEWS_POOL.filter(item => item.scope === 'global' || game.stocks.some(s => s.id === item.scope));
  for (const s of game.stocks) addGenericNewsForStock(pool, s);
  return pool;
}
function addGenericNewsForStock(pool, stock) {
  for (const g of GENERIC_STOCK_NEWS) pool.push({ scope: stock.id, type: g.type, text: g.text, min: g.min, max: g.max });
}

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
                                   : game.stocks[Math.floor(Math.random() * game.stocks.length)].id;
      p.frozenStock = target;
      p.frozenUntil = Date.now() + 30000;
    } },
  { type: 'challenge', text: 'بطاقة تحدي ⚠️: "ضريبة النجاح" -3% من رصيدك النقدي', apply: p => { p.cash = Math.round(p.cash * 0.97); } },
];

// ------------------------------------------------------------
//  الإنجازات (badges) — تُحفظ بحساب اللاعب إذا كان مسجّل دخول
// ------------------------------------------------------------
const ACHIEVEMENTS = {
  first_win:      { icon: '🏆', title: 'الفائز الأول',   desc: 'فُز بجولة كاملة' },
  top3_finish:    { icon: '🥉', title: 'ثلاثي القمة',     desc: 'اتنهي بالمركز الثالث أو أفضل (3 لاعبين فأكثر)' },
  high_roller:    { icon: '💰', title: 'ثري السوق',       desc: 'وصلت محفظتك 200,000$ في وقت ما' },
  active_trader:  { icon: '📊', title: 'متداول نشط',      desc: 'نفّذت 20 صفقة أو أكثر بجولة واحدة' },
  margin_master:  { icon: '🚀', title: 'سيد التمويل',     desc: 'استخدمت التمويل المضاعف وربحت بالنهاية' },
  crash_survivor: { icon: '🛡️', title: 'نجا من الانهيار', desc: 'تفاديت الاحتفاظ بالسهم المنهار حتى النهاية' },
  moon_hunter:    { icon: '🎯', title: 'صائد الفرص',      desc: 'ركبت السهم الصاروخي لنهاية الجولة' },
  ipo_participant:{ icon: '🎪', title: 'مكتتب المستقبل',  desc: 'شاركت باكتتاب "نصف الثلث"' },
  diamond_hands:  { icon: '💎', title: 'يد من حديد',      desc: 'ما بعت ولا سهم طول الجولة وربحت' },
  comeback_king:  { icon: '🔥', title: 'ملك العودة',      desc: 'تعافيت من هبوط حاد وفزت بالجولة' },
  first_million:  { icon: '🤑', title: 'أول مليون',       desc: 'وصلت محفظتك مليون دولار في وقت ما' },
  paper_hands:    { icon: '📄', title: 'يد ورقية',        desc: 'بعت سهماً بخسارة خلال أقل من 20 ثانية من شرائه' },
  scalping_machine:{ icon: '⚡', title: 'آلة السكالبينغ',  desc: 'نفّذت 10 صفقات أو أكثر خلال 90 ثانية فقط' },
  risk_addict:    { icon: '🎰', title: 'مدمن المخاطرة',   desc: 'استخدمت التمويل المضاعف 3 مرات كاملة بجولة واحدة' },
  perfect_trade:  { icon: '🎯', title: 'الصفقة المثالية', desc: 'حققت ربح 50% أو أكثر بصفقة بيع واحدة' },
  lucky_trader:   { icon: '🍀', title: 'محظوظ السوق',      desc: 'سحبت بطاقة فرصة وأنهيت الجولة بثلاثي القمة' },
  market_survivor:{ icon: '🌪️', title: 'ناجي السوق',      desc: 'أنهيت الجولة بربح رغم إفلاس شركة خلالها' },
  flash_trader:   { icon: '⏱️', title: 'المتداول الخاطف',  desc: 'نفّذت أول صفقة خلال 15 ثانية من بداية الجولة' },
  profit_hunter:  { icon: '🏹', title: 'صياد الأرباح',     desc: 'حققت 50,000$ أرباح محققة من صفقات البيع' },
  wall_street_legend:{ icon: '🗽', title: 'أسطورة وول ستريت', desc: 'فُزت بالجولة بمحفظة تجاوزت 500,000$' },
};

function evaluateAchievements(game, player, rank, totalPlayers) {
  const unlocked = [];
  if (rank === 0) unlocked.push('first_win');
  if (rank <= 2 && totalPlayers >= 3) unlocked.push('top3_finish');
  const peak = player.history && player.history.length ? Math.max(...player.history) : player.cash;
  const trough = player.history && player.history.length ? Math.min(...player.history) : player.cash;
  if (peak >= 200000) unlocked.push('high_roller');
  if ((player.orders || []).length >= 20) unlocked.push('active_trader');
  if (player.marginUsesLeft < MARGIN_MAX_USES) {
    const finalValue = portfolioValue(game, player);
    if (finalValue > START_CASH) unlocked.push('margin_master');
  }
  const doomed = game.stocks.find(s => s.isDoomed);
  if (doomed && (player.holdings[doomed.id] || 0) === 0) unlocked.push('crash_survivor');
  const moon = game.stocks.find(s => s.isMooning);
  if (moon && (player.holdings[moon.id] || 0) > 0) unlocked.push('moon_hunter');
  if ((player.orders || []).some(o => o.stockId === 'ipo')) unlocked.push('ipo_participant');
  const hasSell = (player.orders || []).some(o => o.action === 'sell');
  const gainPct = ((portfolioValue(game, player) - START_CASH) / START_CASH) * 100;
  if (!hasSell && (player.orders || []).length > 0 && gainPct > 0) unlocked.push('diamond_hands');
  if (trough < START_CASH * 0.85 && rank === 0) unlocked.push('comeback_king');

  const orders = player.orders || [];
  const finalValue = portfolioValue(game, player);

  if (peak >= 1000000) unlocked.push('first_million');

  // يد ورقية: بيع بخسارة خلال 20 ثانية من آخر شراء لنفس السهم
  const paperHands = orders.some(o => {
    if (o.action !== 'sell' || !(o.profit < 0)) return false;
    const lastBuy = orders.find(b => b.action === 'buy' && b.stockId === o.stockId && b.time <= o.time);
    return lastBuy && (o.time - lastBuy.time) <= 20000;
  });
  if (paperHands) unlocked.push('paper_hands');

  // آلة السكالبينغ: 10 صفقات أو أكثر خلال أي نافذة 90 ثانية
  if (orders.length >= 10) {
    const times = orders.map(o => o.time).sort((a, b) => a - b);
    let scalped = false;
    for (let i = 0; i + 9 < times.length; i++) {
      if (times[i + 9] - times[i] <= 90000) { scalped = true; break; }
    }
    if (scalped) unlocked.push('scalping_machine');
  }

  if (player.marginUsesLeft === 0) unlocked.push('risk_addict');

  const perfectTrade = orders.some(o => o.action === 'sell' && o.profitPct >= 50);
  if (perfectTrade) unlocked.push('perfect_trade');

  if (player.gotLuckyCard && rank <= 2 && totalPlayers >= 3) unlocked.push('lucky_trader');

  const bankruptStock = game.stocks.find(s => s.bankrupt);
  if (bankruptStock && gainPct > 0) unlocked.push('market_survivor');

  if (orders.length && game.startTime) {
    const firstOrderTime = Math.min(...orders.map(o => o.time));
    if (firstOrderTime - game.startTime <= 15000) unlocked.push('flash_trader');
  }

  const totalRealizedProfit = orders.filter(o => o.action === 'sell').reduce((sum, o) => sum + (o.profit || 0), 0);
  if (totalRealizedProfit >= 50000) unlocked.push('profit_hunter');

  if (rank === 0 && finalValue >= 500000) unlocked.push('wall_street_legend');

  return unlocked;
}

async function persistPlayerResult(game, player, rank, totalPlayers) {
  if (!supabaseAdmin || !player.authUserId) return;
  try {
    const uid = player.authUserId;
    const { data: existing } = await supabaseAdmin.from('profiles').select('*').eq('id', uid).single();
    const finalValue = portfolioValue(game, player);
    const peak = player.history && player.history.length ? Math.max(...player.history) : finalValue;
    const updates = {
      id: uid,
      username: player.name,
      games_played: (existing?.games_played || 0) + 1,
      games_won: (existing?.games_won || 0) + (rank === 0 ? 1 : 0),
      top3_finishes: (existing?.top3_finishes || 0) + (rank <= 2 && totalPlayers >= 3 ? 1 : 0),
      total_trades: (existing?.total_trades || 0) + (player.orders || []).length,
      best_portfolio_value: Math.max(existing?.best_portfolio_value || 0, peak),
    };
    await supabaseAdmin.from('profiles').upsert(updates);

    const unlocked = evaluateAchievements(game, player, rank, totalPlayers);
    if (unlocked.length) {
      const rows = unlocked.map(key => ({ user_id: uid, achievement_key: key }));
      await supabaseAdmin.from('player_achievements').upsert(rows, { onConflict: 'user_id,achievement_key', ignoreDuplicates: true });
    }
  } catch (err) {
    console.error('Supabase persist error:', err.message);
  }
}

const SPREAD = 0.006;        // فرق سعر البيع/الشراء الكلي 0.6% (0.3% فوق ± 0.3% تحت منتصف السعر)
const TICK_MS = 11000;       // تحديث الأسعار كل 11 ثانية
const START_CASH = 100000;
const MARGIN_MS = 5 * 60000; // مدة التمويل المضاعف: 5 دقائق
const MARGIN_MAX_USES = 3;   // عدد مرات التمويل المسموحة لكل لاعب

function round2(n) { return Math.round(n * 100) / 100; }
function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function isSuddenDeath(game) { return game.status === 'running' && (game.endTime - Date.now()) <= 60000; }
function spreadFor(game) { return isSuddenDeath(game) ? SPREAD * 2 : SPREAD; }

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

function freshStocks(listKey) {
  return stockDefsFor(listKey).map(s => ({
    ...s,
    ...metaFor(s.id),
    startPrice: s.price,
    prevPrice: s.price,
    changePct: 0,
    minPrice: round2(s.price * 0.05),
    maxPrice: round2(s.price * 15),
    drift: 0,
    isDoomed: false,
    isMooning: false,
    bankrupt: false,
    tradingHalted: false,
    candles: [{ o: s.price, h: s.price, l: s.price, c: s.price }],
  }));
}

// يختار عشوائياً سهماً "منهاراً" وآخر "صاروخياً" لكل لعبة، ويحسب انحدار السعر
// اللازم حتى يصل السهم لهدفه تقريباً مع نهاية الوقت المحدد للعبة
function pickWildStocks(game, durationMs) {
  const pool = [...game.stocks];
  const doomedIdx = Math.floor(Math.random() * pool.length);
  const doomed = pool.splice(doomedIdx, 1)[0];
  const moonIdx = Math.floor(Math.random() * pool.length);
  const moon = pool[moonIdx];

  const ticks = Math.max(1, Math.floor(durationMs / TICK_MS));
  doomed.isDoomed = true;
  // 40% فرصة أن الشركة تنهار للإفلاس الكامل، غير ذلك تهبط بشدة لكن تبقى حية
  const goesBankrupt = Math.random() < 0.4;
  doomed.minPrice = round2(doomed.startPrice * (goesBankrupt ? 0.001 : 0.02));
  doomed.drift = Math.log(goesBankrupt ? 0.008 : 0.05) / ticks;

  moon.isMooning = true;
  moon.maxPrice = round2(moon.startPrice * 30);
  moon.drift = Math.log(12) / ticks; // يرتفع نحو ~12 ضعف سعره الأصلي

  addNews(game, '📉 تحذير من مصادر السوق: أحد الأسهم مقبل على انهيار حاد هذه الجولة!', 'neg', null);
  addNews(game, '📈 شائعات عن سهم واحد سيحقق أرقاماً خيالية هذه الجولة!', 'pos', null);
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
    listKey: 'favorites',
    stocks: freshStocks('favorites'),
    players: new Map(),    // socketId -> player
    news: [],              // recent news log
    newsPool: [],
    timers: {},
    crownLeaderId: null,
    crownSince: 0,
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
    gotLuckyCard: false,
    marginActive: false,
    marginLoan: 0,
    marginExpiresAt: 0,
    marginUsesLeft: MARGIN_MAX_USES,
    history: [START_CASH],
    joinedAt: Date.now(),
    connected: true,
    authUserId: null,
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
  const costBasisUsed = avgCost * qty;
  const profit = proceeds - costBasisUsed;
  player.holdings[stock.id] = Math.max(0, owned - qty);
  player.costBasis[stock.id] = Math.max(0, (player.costBasis[stock.id] || 0) - avgCost * qty);
  if (player.holdings[stock.id] <= 0) { player.holdings[stock.id] = 0; player.costBasis[stock.id] = 0; }
  player.cash += proceeds;
  recordOrder(player, stock, 'sell', qty, price, {
    profit: round2(profit),
    profitPct: costBasisUsed > 0 ? Math.round((profit / costBasisUsed) * 10000) / 100 : 0,
  });
}

const WHALE_THRESHOLD = 30000; // صفقة بهذا الحجم أو أكبر تُعتبر "حوت" وتُعلن للجميع

// أثر السوق: صفقة كبيرة تحرّك السعر فعلياً حسب سيولة السهم (سيولة أقل = أثر أكبر لكل دولار)
function applyMarketImpact(stock, orderValue, direction) {
  const liquidity = stock.liquidity || 5;
  const impactPct = clamp(orderValue / (liquidity * 60000), 0, 0.12);
  if (impactPct <= 0.0005) return;
  const open = stock.price;
  stock.price = clamp(stock.price * (1 + direction * impactPct), stock.minPrice, stock.maxPrice);
  // نمدد آخر شمعة بدل إضافة شمعة جديدة لكل صفقة (حتى ما تمتلئ الشموع بسرعة)
  const last = stock.candles[stock.candles.length - 1];
  if (last) {
    last.c = round2(stock.price);
    last.h = round2(Math.max(last.h, stock.price, open));
    last.l = round2(Math.min(last.l, stock.price, open));
  }
}

function announceWhale(game, player, stock, action, amount) {
  addNews(game, `🐳 حوت بالسوق! ${player.name} ${action === 'buy' ? 'اشترى' : 'باع'} ${stock.icon} ${stock.name} بصفقة ضخمة (${fmtDollar(amount)})`, action === 'buy' ? 'pos' : 'neg', stock.id, 'whale');
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
  const warnDelay = Math.max(0, MARGIN_MS - 30000);
  game.timers[timerKey + '_warn'] = setTimeout(() => {
    if (!player.marginActive) return;
    io.to(player.id).emit('news:event', { text: '⚠️ تنبيه: تمويلك المضاعف سينتهي خلال 30 ثانية! سيتم تسييل محفظتك تلقائياً وسداد القرض', type: 'neg' });
  }, warnDelay);
  addNews(game, `🚀 ${player.name} فعّل تمويل مضاعف! رأس ماله تضاعف مؤقتاً لمدة 5 دقائق`, 'pos', null);
  return { ok: true };
}

function closeMargin(game, player) {
  if (!player.marginActive) return;
  for (const s of game.stocks) {
    const qty = player.holdings[s.id] || 0;
    if (qty > 0) {
      const sellPrice = s.price * (1 - spreadFor(game) / 2);
      applySell(player, s, qty, sellPrice);
    }
  }
  player.cash -= player.marginLoan;
  if (player.cash < 0) player.cash = 0;
  player.marginActive = false;
  player.marginLoan = 0;
  player.marginExpiresAt = 0;
  clearTimeout(game.timers['margin_' + player.token + '_warn']);
  delete game.timers['margin_' + player.token];
  delete game.timers['margin_' + player.token + '_warn'];
  addNews(game, `⏰ انتهت مهلة تمويل ${player.name} — تصفية تلقائية لمحفظته وسداد التمويل`, 'neg', null);
  broadcast(game);
}

function recordOrder(player, stock, action, qty, price, extra) {
  const order = {
    stockId: stock.id,
    stockName: stock.name,
    icon: stock.icon,
    action,
    qty,
    price: round2(price),
    total: round2(qty * price),
    time: Date.now(),
  };
  if (extra) Object.assign(order, extra);
  player.orders.unshift(order);
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

const CROWN_HOLD_MS = 60000; // مدة البقاء بالمركز الأول قبل ظهور التاج

function leaderboard(game) {
  const sorted = [...game.players.values()]
    .map(p => {
      const value = portfolioValue(game, p);
      const gainPct = Math.round(((value - START_CASH) / START_CASH) * 10000) / 100;
      return {
        id: p.id,
        name: p.name,
        cash: Math.round(p.cash),
        value,
        gainPct,
        holdings: p.holdings,
        connected: p.connected,
        marginActive: p.marginActive,
        hasCrown: false,
      };
    })
    .sort((a, b) => b.value - a.value);

  if (game.status === 'running' && sorted.length) {
    const now = Date.now();
    const leader = sorted[0];
    if (game.crownLeaderId !== leader.id) {
      game.crownLeaderId = leader.id;
      game.crownSince = now;
    }
    leader.hasCrown = (now - (game.crownSince || now)) >= CROWN_HOLD_MS;
  }
  return sorted;
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
      buyPrice: round2(s.price * (1 + spreadFor(game) / 2)),
      sellPrice: round2(s.price * (1 - spreadFor(game) / 2)),
      changePct: s.changePct,
      sessionChangePct: Math.round(((s.price - s.startPrice) / s.startPrice) * 10000) / 100,
      dividend: s.dividend,
      minPrice: s.minPrice,
      maxPrice: s.maxPrice,
      candles: s.candles,
      sector: s.sector,
      personality: s.personality,
      bankrupt: !!s.bankrupt,
      tradingHalted: !!s.tradingHalted,
    })),
    suddenDeath: isSuddenDeath(game),
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

function addNews(game, text, type, stockId, kind) {
  game.news.push({ text, type, stockId, t: Date.now(), kind: kind || 'news' });
  io.to('room:' + game.code).emit('news:event', { text, type, stockId, kind: kind || 'news' });
}

// ------------------------------------------------------------
//  حلقات اللعبة
// ------------------------------------------------------------
function tickPrices(game) {
  const suddenDeath = isSuddenDeath(game);
  const volMult = suddenDeath ? 1.8 : 1;
  for (const s of game.stocks) {
    if (s.bankrupt) continue; // توقف التداول تماماً، السعر ثابت عند الصفر
    const open = s.price;
    const randomWalk = (Math.random() - 0.5) * 2 * s.volatility * volMult + (s.drift || 0);
    const close = clamp(open * (1 + randomWalk), s.minPrice, s.maxPrice);
    s.prevPrice = open;
    s.price = close;
    s.changePct = Math.round(((close - open) / open) * 10000) / 100;
    s.candles.push(makeCandle(open, close));
    if (s.candles.length > 60) s.candles.shift();

    // إفلاس: إذا سهم "منهار" هبط تحت 3% من سعره الأصلي، تُعلن الشركة إفلاسها ويتوقف التداول
    if (s.isDoomed && !s.bankrupt && s.price <= s.startPrice * 0.03) {
      s.bankrupt = true;
      s.tradingHalted = true;
      s.price = 0.01;
      s.changePct = -100;
      s.candles.push(makeCandle(open, 0.01));
      addNews(game, `💀 إفلاس! أعلنت ${s.icon} ${s.name} إفلاسها وتوقف التداول عليها فوراً`, 'neg', s.id, 'bankruptcy');
    }
  }
}

function triggerNews(game) {
  const pool = game.newsPool && game.newsPool.length ? game.newsPool : NEWS_POOL;
  const item = pool[Math.floor(Math.random() * pool.length)];
  const pct = item.min + Math.random() * (item.max - item.min);
  const sign = item.type === 'pos' ? 1 : -1;
  if (item.scope === 'global') {
    for (const s of game.stocks) {
      const open = s.price;
      s.price = clamp(s.price * (1 + sign * pct), s.minPrice, s.maxPrice);
      s.candles.push(makeCandle(open, s.price));
      if (s.candles.length > 60) s.candles.shift();
    }
    addNews(game, item.text, item.type, null);
  } else {
    const s = game.stocks.find(x => x.id === item.scope);
    if (s) {
      const open = s.price;
      s.price = clamp(s.price * (1 + sign * pct), s.minPrice, s.maxPrice);
      s.candles.push(makeCandle(open, s.price));
      if (s.candles.length > 60) s.candles.shift();
      addNews(game, `${s.icon} ${s.name}: ${item.text}`, item.type, s.id);
    }
  }
}

// أحداث درامية إضافية: عصر قصير (short squeeze) أو ضخ وتفريغ (pump & dump)
function triggerSpecialEvent(game) {
  const eligible = game.stocks.filter(s => !s.bankrupt);
  if (!eligible.length) return;
  const stock = eligible[Math.floor(Math.random() * eligible.length)];
  const kind = Math.random() < 0.5 ? 'squeeze' : 'pumpdump';

  if (kind === 'squeeze') {
    const pct = 0.4 + Math.random() * 0.5; // +40% إلى +90%
    const open = stock.price;
    stock.price = clamp(stock.price * (1 + pct), stock.minPrice, stock.maxPrice);
    stock.candles.push(makeCandle(open, stock.price));
    if (stock.candles.length > 60) stock.candles.shift();
    addNews(game, `💥 عصر مفاجئ (Short Squeeze) على ${stock.icon} ${stock.name}! ارتفاع صاروخي بلحظات`, 'pos', stock.id, 'squeeze');
  } else {
    const pumpPct = 0.5 + Math.random() * 0.5; // +50% إلى +100%
    const open = stock.price;
    stock.price = clamp(stock.price * (1 + pumpPct), stock.minPrice, stock.maxPrice);
    stock.candles.push(makeCandle(open, stock.price));
    if (stock.candles.length > 60) stock.candles.shift();
    addNews(game, `🚀 ${stock.icon} ${stock.name} يقفز بشكل مفاجئ ومريب!`, 'pos', stock.id, 'pump');
    const dumpDelay = 14000 + Math.random() * 10000;
    const key = 'pumpdump_' + stock.id + '_' + Date.now();
    game.timers[key] = setTimeout(() => {
      if (game.status !== 'running' || stock.bankrupt) return;
      const dumpPct = 0.4 + Math.random() * 0.35; // -40% إلى -75%
      const o2 = stock.price;
      stock.price = clamp(stock.price * (1 - dumpPct), stock.minPrice, stock.maxPrice);
      stock.candles.push(makeCandle(o2, stock.price));
      if (stock.candles.length > 60) stock.candles.shift();
      addNews(game, `📉 انهيار مفاجئ لسهم ${stock.icon} ${stock.name} بعد الارتفاع الوهمي — كانت عملية ضخ وتفريغ!`, 'neg', stock.id, 'dump');
      delete game.timers[key];
      broadcast(game);
    }, dumpDelay);
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
  if (paidAny) addNews(game, '💰 توزيعات أرباح! حاملو الأسهم الموزّعة للأرباح 💵 حصلوا على أرباح نقدية', 'pos', null);
}

function drawCard(game) {
  const players = [...game.players.values()];
  if (!players.length) return;
  const player = players[Math.floor(Math.random() * players.length)];
  const card = CARDS[Math.floor(Math.random() * CARDS.length)];
  card.apply(player, game);
  if (card.type === 'opportunity') player.gotLuckyCard = true;
  io.to(player.id).emit('card:drawn', { text: card.text, type: card.type });
  addNews(game, `🎴 ${player.name} سحب ${card.text}`, card.type === 'opportunity' ? 'pos' : 'neg', null);
}

function startGame(game, durationMs, listKey) {
  game.status = 'running';
  game.durationMs = durationMs;
  game.startTime = Date.now();
  game.endTime = game.startTime + durationMs;
  game.listKey = STOCK_LISTS[listKey] ? listKey : (game.listKey || 'favorites');
  game.stocks = freshStocks(game.listKey);
  pickWildStocks(game, durationMs);
  game.newsPool = buildNewsPoolForGame(game);
  scheduleIPO(game, durationMs);

  game.timers.price = setInterval(() => { tickPrices(game); broadcast(game); }, TICK_MS);
  scheduleNews(game);
  game.timers.dividend = setInterval(() => { payDividends(game); broadcast(game); }, 90000);
  game.timers.card = setInterval(() => { drawCard(game); }, 50000);
  game.timers.broadcast = setInterval(() => broadcast(game), 1500);
  game.timers.end = setTimeout(() => endGame(game), durationMs);

  const suddenDeathDelay = Math.max(0, durationMs - 60000);
  if (durationMs > 60000) {
    game.timers.suddenDeathAnnounce = setTimeout(() => {
      if (game.status !== 'running') return;
      addNews(game, '🚨 دخلنا الدقيقة الأخيرة! السوق يشتعل — تقلبات جامحة وأخبار متلاحقة حتى صافرة النهاية', 'neg', null, 'announcer');
      broadcast(game);
    }, suddenDeathDelay);
  }

  broadcast(game);
}

// يضيف سهم اكتتاب مفاجئ "شركة نصف الثلث" في وقت عشوائي أثناء اللعبة
function scheduleIPO(game, durationMs) {
  const minDelay = durationMs * 0.2;
  const maxDelay = durationMs * 0.7;
  const delay = Math.max(8000, minDelay + Math.random() * (maxDelay - minDelay));
  game.timers.ipo = setTimeout(() => {
    if (game.status !== 'running') return;
    const price = round2(15 + Math.random() * 15);
    const ipoStock = {
      id: 'ipo', name: 'شركة نصف الثلث', icon: '🎪',
      sector: 'اكتتاب جديد', personality: 'Meme', liquidity: 2,
      price, startPrice: price, prevPrice: price, changePct: 0,
      volatility: 0.09, dividend: false,
      minPrice: round2(price * 0.05), maxPrice: round2(price * 15),
      drift: 0, isDoomed: false, isMooning: false, bankrupt: false, tradingHalted: false,
      candles: [{ o: price, h: price, l: price, c: price }],
    };
    game.stocks.push(ipoStock);
    addGenericNewsForStock(game.newsPool, ipoStock);
    addNews(game, `🎉 اكتتاب مفاجئ! سهم "نصف الثلث" 🎪 يبدأ التداول الآن بسعر ${fmtDollar(price)}`, 'pos', ipoStock.id);
    broadcast(game);
  }, delay);
}

function fmtDollar(n) { return '$' + Math.round(n).toLocaleString('en-US'); }

function scheduleNews(game) {
  const now = Date.now();
  const inSuddenDeath = game.status === 'running' && (game.endTime - now) <= 60000;
  const base = inSuddenDeath ? 8000 : 20000;
  const span = inSuddenDeath ? 8000 : 20000;
  const delay = base + Math.random() * span; // أسرع بمرحلة الموت المفاجئ
  game.timers.news = setTimeout(() => {
    if (game.status !== 'running') return;
    if (Math.random() < 0.22) triggerSpecialEvent(game);
    else triggerNews(game);
    broadcast(game);
    scheduleNews(game);
  }, delay);
}

// يحسب إحصائيات نهاية الجولة (أعلى ربح، أكبر خسارة، أسرع صفقة...) لكل لاعب ويحدد أبرزها للعرض
function buildMatchStats(game) {
  const players = [...game.players.values()];
  const perPlayer = players.map(p => {
    const orders = p.orders || [];
    const sells = orders.filter(o => o.action === 'sell');
    const totalRealizedProfit = sells.reduce((s, o) => s + (o.profit || 0), 0);
    const winningSells = sells.filter(o => (o.profit || 0) > 0).length;
    const winRate = sells.length ? Math.round((winningSells / sells.length) * 100) : 0;
    const biggestWin = sells.reduce((m, o) => Math.max(m, o.profit || 0), 0);
    const biggestLoss = sells.reduce((m, o) => Math.min(m, o.profit || 0), 0);
    const leverageUses = MARGIN_MAX_USES - p.marginUsesLeft;
    let fastestTradeMs = null;
    const sorted = [...orders].sort((a, b) => a.time - b.time);
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].time - sorted[i - 1].time;
      if (fastestTradeMs === null || gap < fastestTradeMs) fastestTradeMs = gap;
    }
    return {
      name: p.name,
      totalTrades: orders.length,
      totalRealizedProfit: round2(totalRealizedProfit),
      winRate,
      biggestWin: round2(biggestWin),
      biggestLoss: round2(biggestLoss),
      leverageUses,
      fastestTradeMs,
      finalValue: portfolioValue(game, p),
    };
  });

  const pick = (arr, key, dir) => {
    const valid = arr.filter(x => x[key] !== null && x[key] !== undefined && !Number.isNaN(x[key]));
    if (!valid.length) return null;
    return valid.reduce((best, cur) => ((dir === 'max' ? cur[key] > best[key] : cur[key] < best[key]) ? cur : best));
  };

  return {
    perPlayer,
    highlights: {
      highestProfit: pick(perPlayer, 'totalRealizedProfit', 'max'),
      biggestLoss: pick(perPlayer, 'biggestLoss', 'min'),
      mostTrades: pick(perPlayer, 'totalTrades', 'max'),
      highestWinRate: pick(perPlayer.filter(p => p.totalTrades > 0), 'winRate', 'max'),
      fastestTrade: pick(perPlayer.filter(p => p.fastestTradeMs !== null), 'fastestTradeMs', 'min'),
      highestLeverage: pick(perPlayer.filter(p => p.leverageUses > 0), 'leverageUses', 'max'),
      biggestSingleWin: pick(perPlayer.filter(p => p.biggestWin > 0), 'biggestWin', 'max'),
      mvp: pick(perPlayer, 'finalValue', 'max'),
    },
  };
}

function endGame(game) {
  game.status = 'ended';
  clearAllTimers(game);
  const results = leaderboard(game);
  const stats = buildMatchStats(game);
  io.to('room:' + game.code).emit('game:ended', { results, stats });
  broadcast(game);

  // حفظ النتائج والإنجازات للاعبين المسجّلين (لا يوقف اللعبة إذا فشل)
  const totalPlayers = results.length;
  const playersByName = new Map([...game.players.values()].map(p => [p.name, p]));
  results.forEach((r, rank) => {
    const player = playersByName.get(r.name);
    if (!player || !player.authUserId) return;
    const unlocked = evaluateAchievements(game, player, rank, totalPlayers);
    if (unlocked.length) {
      io.to(player.id).emit('achievements:unlocked', { keys: unlocked, meta: unlocked.map(k => ACHIEVEMENTS[k]) });
    }
    persistPlayerResult(game, player, rank, totalPlayers);
  });
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

  socket.on('host:start', ({ code, durationMs, listKey }) => {
    const game = games.get(code);
    if (!game || game.status !== 'lobby') return;
    if (game.players.size < 1) { socket.emit('errorMsg', 'أضف لاعباً واحداً على الأقل قبل البدء'); return; }
    startGame(game, durationMs || 30 * 60000, listKey);
  });

  socket.on('host:reset', ({ code }) => {
    const game = games.get(code);
    if (!game) return;
    clearAllTimers(game);
    game.status = 'lobby';
    game.stocks = freshStocks(game.listKey || 'favorites');
    game.news = [];
    game.newsPool = [];
    game.crownLeaderId = null;
    game.crownSince = 0;
    for (const p of game.players.values()) {
      p.cash = START_CASH; p.holdings = {}; p.costBasis = {}; p.orders = []; p.noSpreadNext = false;
      p.doubleDividend = false; p.frozenStock = null; p.frozenUntil = 0; p.gotLuckyCard = false;
      p.marginActive = false; p.marginLoan = 0; p.marginExpiresAt = 0; p.marginUsesLeft = MARGIN_MAX_USES;
      p.history = [START_CASH];
    }
    broadcast(game);
  });

  socket.on('player:join', async ({ code, name, authToken }) => {
    const game = games.get(code);
    if (!game) { socket.emit('errorMsg', 'كود اللعبة غير صحيح'); return; }
    if (game.status !== 'lobby') { socket.emit('errorMsg', 'اللعبة بدأت بالفعل، انتظر الجولة القادمة'); return; }
    if (game.players.size >= 10) { socket.emit('errorMsg', 'اكتمل عدد اللاعبين (10)'); return; }
    const player = newPlayer(name.trim().slice(0, 16) || 'لاعب');
    player.id = socket.id;
    if (authToken && supabaseAdmin) {
      try {
        const { data } = await supabaseAdmin.auth.getUser(authToken);
        if (data && data.user) player.authUserId = data.user.id;
      } catch (e) { /* رمز غير صالح، يكمل كلاعب زائر */ }
    }
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
    const buyPrice = useMid ? stock.price : stock.price * (1 + spreadFor(game) / 2);
    const sellPrice = useMid ? stock.price : stock.price * (1 - spreadFor(game) / 2);

    if (action === 'buy') {
      if (stock.tradingHalted) { socket.emit('errorMsg', '🚫 التداول متوقف على هذا السهم (إفلاس)'); return; }
      const cost = qty * buyPrice;
      if (cost > player.cash + 0.01) { socket.emit('errorMsg', 'رصيدك النقدي لا يكفي لهذه الكمية'); return; }
      applyBuy(player, stock, qty, buyPrice);
      applyMarketImpact(stock, cost, 1);
      socket.emit('trade:confirmed', { action: 'buy', qty, price: round2(buyPrice), total: round2(cost), stockName: stock.name, icon: stock.icon });
      if (cost >= WHALE_THRESHOLD) announceWhale(game, player, stock, 'buy', cost);
    } else if (action === 'sell') {
      const owned = player.holdings[stockId] || 0;
      if (qty > owned) { socket.emit('errorMsg', 'لا تملك هذه الكمية لبيعها'); return; }
      const proceeds = qty * sellPrice;
      applySell(player, stock, qty, sellPrice);
      if (!stock.bankrupt) applyMarketImpact(stock, proceeds, -1);
      socket.emit('trade:confirmed', { action: 'sell', qty, price: round2(sellPrice), total: round2(proceeds), stockName: stock.name, icon: stock.icon });
      if (proceeds >= WHALE_THRESHOLD) announceWhale(game, player, stock, 'sell', proceeds);
    } else {
      return;
    }

    if (player.noSpreadNext) player.noSpreadNext = false;
    broadcast(game);
  });

  socket.on('player:liquidate', ({ code }) => {
    const game = games.get(code);
    if (!game || game.status !== 'running') return;
    const player = game.players.get(socket.id);
    if (!player) return;
    const useMid = player.noSpreadNext;
    let soldCount = 0, skippedFrozen = false;
    for (const s of game.stocks) {
      const qty = player.holdings[s.id] || 0;
      if (qty <= 0) continue;
      if (player.frozenStock === s.id && player.frozenUntil > Date.now()) { skippedFrozen = true; continue; }
      const sellPrice = useMid ? s.price : s.price * (1 - spreadFor(game) / 2);
      applySell(player, s, qty, sellPrice);
      soldCount++;
    }
    if (player.noSpreadNext) player.noSpreadNext = false;
    if (soldCount === 0) { socket.emit('errorMsg', skippedFrozen ? 'سهمك الوحيد مجمد حالياً، لا يمكن تسييله' : 'لا توجد أسهم في محفظتك لتسييلها'); return; }
    socket.emit('liquidate:done', { soldCount, skippedFrozen });
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
