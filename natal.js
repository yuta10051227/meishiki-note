// 命式計算エンジン（自前・VIELE secretary から流用）。astronomy-engine(MIT) で天体位置を算出。
// 四柱推命・算命学(人体星図/十大主星/十二大従星/天中殺/大運/日月年運/相性)・西洋・インド占星術。
// ※ ビルド不要の単体ページ用に astronomy-engine を esm.sh から読み込む。
import * as A from "https://esm.sh/astronomy-engine@2.1.19";

const norm = (d) => ((d % 360) + 360) % 360;
const SIGNS = ["牡羊", "牡牛", "双子", "蟹", "獅子", "乙女", "天秤", "蠍", "射手", "山羊", "水瓶", "魚"];
const G = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const Z = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const NAK = ["アシュヴィニー", "バラニー", "クリッティカー", "ローヒニー", "ムリガシラー", "アールドラー", "プナルヴァス", "プシュヤ", "アーシュレーシャー", "マガー", "プールヴァファルグニー", "ウッタラファルグニー", "ハスタ", "チトラー", "スヴァーティー", "ヴィシャーカー", "アヌラーダー", "ジエーシュター", "ムーラ", "プールヴァアシャーダー", "ウッタラアシャーダー", "シュラヴァナ", "ダニシュター", "シャタビシャー", "プールヴァバードラパダー", "ウッタラバードラパダー", "レーヴァティー"];
// ヴィムショッタリ・ダシャー（合計120年）。ナクシャトラ起点ルーラー順。
const DASHA = [["ケートゥ", 7], ["金星", 20], ["太陽", 6], ["月", 10], ["火星", 7], ["ラーフ", 18], ["木星", 16], ["土星", 19], ["水星", 17]];

const signOf = (lon) => SIGNS[Math.floor(norm(lon) / 30)] + "座";
const degInSign = (lon) => (norm(lon) % 30).toFixed(1);

function jdn(y, m, d) {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}
// 日柱: 1990-10-05 = 癸卯(index39) で較正
const DAY_ANCHOR = jdn(1990, 10, 5) - 39;

// Lahiri アヤナムシャ近似（J2000=約23.86°, 約0.0139°/年ドリフト）
function lahiri(year) { return 23.86 + (year - 2000) * 0.013889; }

export function computeChart(birth) {
  const { date, time = "12:00", utcOffset = 9, lat = 35.68, lon = 139.69 } = birth || {};
  const [Y, M, D] = String(date).split("-").map(Number);
  const [hh, mm] = String(time).split(":").map(Number);
  const utc = new Date(Date.UTC(Y, M - 1, D, hh - utcOffset, mm || 0));
  const t = A.MakeTime(utc);

  // 天体黄経（of date, tropical）
  const elon = (body) =>
    body === A.Body.Sun ? norm(A.SunPosition(t).elon)
      : body === A.Body.Moon ? norm(A.EclipticGeoMoon(t).lon)
        : norm(A.Ecliptic(A.GeoVector(body, t, true)).elon);
  const P = {
    太陽: elon(A.Body.Sun), 月: elon(A.Body.Moon), 水星: elon(A.Body.Mercury),
    金星: elon(A.Body.Venus), 火星: elon(A.Body.Mars), 木星: elon(A.Body.Jupiter), 土星: elon(A.Body.Saturn),
  };

  // ASC（上昇宮）
  const gst = A.SiderealTime(t);
  const ramcDeg = norm(gst * 15 + lon);
  const eps = 23.4393 * Math.PI / 180, ramc = ramcDeg * Math.PI / 180, phi = lat * Math.PI / 180;
  const asc = norm(Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps))) * 180 / Math.PI);

  // ── 四柱推命 ──
  // 年柱（立春[約2/4]で切替）
  const solarYear = (M < 2 || (M === 2 && D < 4)) ? Y - 1 : Y;
  const yIdx = ((solarYear - 1984) % 60 + 60) % 60;
  const yearPillar = G[yIdx % 10] + Z[yIdx % 12];
  // 月柱（太陽黄経で節月を判定。立春=黄経315°=寅月）
  const bucket = Math.floor(norm(P.太陽 - 315) / 30); // 0=寅..11=丑
  const monthBranch = (2 + bucket) % 12;
  const yearStem = yIdx % 10;
  const tigerStem = (yearStem % 5 * 2 + 2) % 10; // 五虎遁: 寅月の天干
  const monthStem = (tigerStem + bucket) % 10;
  const monthPillar = G[monthStem] + Z[monthBranch];
  // 日柱
  const dIdx = ((jdn(Y, M, D) - DAY_ANCHOR) % 60 + 60) % 60;
  const dayStem = dIdx % 10;
  const dayPillar = G[dayStem] + Z[dIdx % 12];
  // 時柱（五鼠遁）
  const hourBranch = Math.floor(((hh + 1) % 24) / 2);
  const hourStem = (dayStem % 5 * 2 + hourBranch) % 10;
  const hourPillar = G[hourStem] + Z[hourBranch];

  // ── インド占星術（サイデリアル）──
  const ayan = lahiri(Y);
  const sidMoon = norm(P.月 - ayan);
  const nakIdx = Math.floor(sidMoon / (360 / 27));
  const nakFrac = (sidMoon % (360 / 27)) / (360 / 27);
  const sidSun = norm(P.太陽 - ayan);

  // 現行ヴィムショッタリ・ダシャー（大運/サブ期）
  const dasha = currentDasha(utc, nakIdx, nakFrac, new Date());

  // 命式テキスト（Geminiへ渡す根拠）
  const lines = [
    `生年月日: ${date} ${time} / 出生地(緯度${lat} 経度${lon}) / UTC+${utcOffset}`,
    `四柱推命: 年柱 ${yearPillar} / 月柱 ${monthPillar} / 日柱 ${dayPillar} / 時柱 ${hourPillar} ・ 日主 ${G[dayStem]}`,
    `西洋占星術: ${Object.entries(P).map(([k, v]) => `${k} ${signOf(v)}${degInSign(v)}°`).join(" / ")} / ASC ${signOf(asc)}${degInSign(asc)}°`,
    `インド占星術: 月のナクシャトラ ${NAK[nakIdx]} / 月 ${signOf(sidMoon)}(サイデリアル) / 太陽 ${signOf(sidSun)}(サイデリアル)`,
    `インド大運(ダシャー): ${dasha.md}期 中の ${dasha.ad}期${dasha.adRange ? `（${dasha.adRange}）` : ""}`,
  ];

  return {
    text: lines.join("\n"),
    yearPillar, monthPillar, dayPillar, hourPillar, dayMaster: G[dayStem],
    western: Object.fromEntries(Object.entries(P).map(([k, v]) => [k, signOf(v)])),
    asc: signOf(asc),
    nakshatra: NAK[nakIdx],
    dasha,
  };
}

// 現行ダシャー（大運MD・サブ期AD）を求める
function currentDasha(birthUtc, nakIdx, nakFrac, today) {
  const startRulerIdx = nakIdx % 9;
  // 大運の並びと開始日
  const mds = [];
  let cursor = new Date(birthUtc);
  for (let i = 0; i < 9; i++) {
    const [ruler, yrs] = DASHA[(startRulerIdx + i) % 9];
    const dur = i === 0 ? yrs * (1 - nakFrac) : yrs;
    const start = new Date(cursor);
    const end = new Date(cursor.getTime() + dur * 365.2425 * 86400000);
    mds.push({ ruler, yrs, start, end });
    cursor = end;
  }
  const md = mds.find((p) => today >= p.start && today < p.end) || mds[mds.length - 1];
  // サブ期(AD)
  let adRuler = md.ruler, adRange = "";
  const mdRulerIdx = DASHA.findIndex((x) => x[0] === md.ruler);
  let c2 = new Date(md.start);
  const mdLen = md.end - md.start;
  for (let i = 0; i < 9; i++) {
    const [ruler, yrs] = DASHA[(mdRulerIdx + i) % 9];
    const adLen = mdLen * (yrs / 120);
    const s = new Date(c2), e = new Date(c2.getTime() + adLen);
    if (today >= s && today < e) { adRuler = ruler; adRange = `${s.getFullYear()}.${s.getMonth() + 1}〜${e.getFullYear()}.${e.getMonth() + 1}`; break; }
    c2 = e;
  }
  return { md: md.ruler, ad: adRuler, adRange };
}

/* ──────────────────────────────────────────────────────────────
   その日の「気」：本人の日主（五行）と、その日の日干の五行の関係から
   スコア(1〜5)とスタンス(攻め/守り/整える/労い)を決定論的に算出。
   → 日ごとに本当に変化する運気の波を作る（AI任せの固定値を排除）。
   ────────────────────────────────────────────────────────────── */
const FIVE = { 甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土", 己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水" };
const GEN = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };   // X 生 Y
const CTRL = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" };  // X 剋 Y

// dateISO("YYYY-MM-DD") の日干支から関係を出す
function relationFor(meElem, dateISO) {
  const d = new Date(dateISO + "T00:00:00");
  const idx = ((jdn(d.getFullYear(), d.getMonth() + 1, d.getDate()) - DAY_ANCHOR) % 60 + 60) % 60;
  const stem = G[idx % 10], branch = Z[idx % 12];
  const other = FIVE[stem];
  let relation, score, stance, focus;
  if (other === meElem) { relation = "比和（仲間の気）"; score = 3; stance = "整える"; focus = "足場を固め、淡々と整える日。無理に広げない。"; }
  else if (GEN[other] === meElem) { relation = "印（支えられる）"; score = 4; stance = "労い"; focus = "人や学びに支えられる日。受け取り、休み、充電してよい。"; }
  else if (GEN[meElem] === other) { relation = "食傷（生み出す）"; score = 5; stance = "攻め"; focus = "表現・発信・制作が伸びる日。アウトプットで前進。"; }
  else if (CTRL[meElem] === other) { relation = "財（掴みにいく）"; score = 4; stance = "攻め"; focus = "成果・お金を取りにいける日。動けば返ってくる。"; }
  else { relation = "官殺（試される）"; score = 2; stance = "守り"; focus = "プレッシャーがかかる日。守りを固め、背伸びしない。"; }
  return { ganZhi: stem + branch, stem, branch, element: other, relation, score, stance, focus };
}

// 本日・明日・今月の日別スコアを返す
export function dayEnergy(birth, todayISO) {
  const me = FIVE[computeChart(birth).dayMaster] || "水";
  const t = new Date(todayISO + "T00:00:00");
  const tomorrow = new Date(t); tomorrow.setDate(t.getDate() + 1);
  const iso = (x) => x.toISOString().slice(0, 10);
  const today = relationFor(me, todayISO);
  const tmr = relationFor(me, iso(tomorrow));
  // 今月の日別スコア（運気グラフ用）
  const yy = t.getFullYear(), mm = t.getMonth();
  const dim = new Date(yy, mm + 1, 0).getDate();
  const monthDays = [];
  for (let day = 1; day <= dim; day++) monthDays.push(relationFor(me, `${yy}-${String(mm + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`).score);
  return { me, today, tomorrow: tmr, monthDays };
}

// 複数の日付の「気」をまとめて返す（命式計算は1回だけ）。逆算チェーンの本番日コンディション用。
// 返り値: { "YYYY-MM-DD": { stance, score, relation, focus, ... } }
export function stancesFor(birth, dateISOs) {
  const out = {};
  try {
    const me = FIVE[computeChart(birth).dayMaster] || "水";
    for (const d of dateISOs || []) {
      if (d && !out[d]) out[d] = relationFor(me, String(d).slice(0, 10));
    }
  } catch { /* 出生情報が不正なら何も返さない */ }
  return out;
}

/* ──────────────────────────────────────────────────────────────
   算命学：十大主星（中心星）＝ あなたの「経営キャラ」
   日干 × 月支の蔵干(本気) の通変星から、決定論的に1つの星を算出。
   占いというより気質の型。遊び心＋自己理解で「毎日開きたくなる」を補強。
   ────────────────────────────────────────────────────────────── */
const HIDDEN = { 子: "癸", 丑: "己", 寅: "甲", 卯: "乙", 辰: "戊", 巳: "丙", 午: "丁", 未: "己", 申: "庚", 酉: "辛", 戌: "戊", 亥: "壬" };
// 通変星 → 算命学・十大主星
const TEN_GOD_TO_STAR = {
  比肩: "貫索星", 劫財: "石門星", 食神: "鳳閣星", 傷官: "調舒星", 偏財: "禄存星",
  正財: "司禄星", 偏官: "車騎星", 正官: "牽牛星", 偏印: "龍高星", 印綬: "玉堂星",
};
// 日干(me) と 対象干(other) の通変星を判定
function tenGod(meStem, otherStem) {
  const me = FIVE[meStem], ot = FIVE[otherStem];
  const sameYin = (G.indexOf(meStem) % 2) === (G.indexOf(otherStem) % 2); // 陰陽が同じか
  if (me === ot) return sameYin ? "比肩" : "劫財";
  if (GEN[me] === ot) return sameYin ? "食神" : "傷官";   // 我 生 彼
  if (CTRL[me] === ot) return sameYin ? "偏財" : "正財";  // 我 剋 彼
  if (CTRL[ot] === me) return sameYin ? "偏官" : "正官";  // 彼 剋 我
  if (GEN[ot] === me) return sameYin ? "偏印" : "印綬";   // 彼 生 我
  return "比肩";
}
const STAR_DESC = {
  貫索星: { emoji: "🌳", title: "独立独歩タイプ", desc: "マイペースに一つを貫く人。ブレない軸が最大の強み。", biz: "流行を追うより『自分のやり方をコツコツ続ける』ことで信頼と実績が積み上がります。", attack: "続けてきた定番をもう一歩前へ。" },
  石門星: { emoji: "🤝", title: "輪を広げるタイプ", desc: "人を巻き込み輪を作る社交家。仲間づくりが得意。", biz: "一人で抱えるより、コラボ・コミュニティ・チームで動くと一気に伸びます。", attack: "仲間・コラボに声をかけて巻き込みを。" },
  鳳閣星: { emoji: "🍀", title: "楽しむ表現タイプ", desc: "自然体で楽しみながら表現する人。場を和ませる発信が映える。", biz: "肩肘張らない発信や体験提供が武器。『楽しさ』をそのまま商品にできます。", attack: "楽しい発信・体験で人を集めて。" },
  調舒星: { emoji: "🎨", title: "こだわり職人タイプ", desc: "繊細で美意識が高い表現者。独自の世界観で深く刺さる。", biz: "量より質。世界観・作品性を磨いて『あなただから』の指名を取りにいきましょう。", attack: "こだわりの世界観を一点集中で出して。" },
  禄存星: { emoji: "💝", title: "奉仕・愛情タイプ", desc: "面倒見がよく与える人。サービス精神で人とお金を引き寄せる。", biz: "手厚いホスピタリティが収益に直結。『尽くす』があなたの集客力です。", attack: "手厚い特典・サービスで攻めて。" },
  司禄星: { emoji: "🏦", title: "堅実・蓄積タイプ", desc: "地道に積み上げ管理する堅実家。継続・ストック化が得意。", biz: "サブスク・会員制・リピートなど『積み上がる売上』と好相性です。", attack: "リピート・会員化の案内を出して。" },
  車騎星: { emoji: "⚡", title: "行動・突破タイプ", desc: "スピードと行動力で前進する人。動いて道を開く実行派。", biz: "考える前にまず動く。スピード勝負・先陣・営業の現場で力を発揮します。", attack: "スピード勝負。先陣を切って動いて。" },
  牽牛星: { emoji: "🎖️", title: "信頼・実務タイプ", desc: "真面目で責任感が強く、信用を大事にする人。", biz: "きっちりした実務とブランド・権威性で『安心して任せられる』を売りに。", attack: "実績・信頼を前面に打ち出して。" },
  龍高星: { emoji: "🐉", title: "冒険・革新タイプ", desc: "好奇心旺盛で型破り。新しい挑戦・改造・海外に縁。", biz: "新規開拓や既存のやり方の刷新で輝く。実験を恐れず仕掛けていきましょう。", attack: "新しい企画・試みを仕掛けて。" },
  玉堂星: { emoji: "📚", title: "知性・教育タイプ", desc: "学びと伝えるのが得意な理論派。教えること全般と好相性。", biz: "講座・体系化したコンテンツ・教える仕事で価値が最大化します。", attack: "教える・解説コンテンツで価値を出して。" },
};
// あなたの経営キャラ（算命学・中心星）を返す。出生情報が無ければ null。
export function sanmei(birth) {
  if (!birth || !birth.date) return null;
  try {
    const c = computeChart(birth);
    const me = c.dayMaster;
    const monthBranch = String(c.monthPillar).slice(-1);
    const hidden = HIDDEN[monthBranch] || me;
    const god = tenGod(me, hidden);
    const star = TEN_GOD_TO_STAR[god] || "貫索星";
    return { star, god, ...STAR_DESC[star] };
  } catch { return null; }
}

/* ──────────────────────────────────────────────────────────────
   算命学：人体星図（陽占）の完全版。高尾系・標準マッピングで決定論計算。
   - 五主星（十大主星）：中央=月支蔵干 / 北=年支蔵干 / 南=日支蔵干 / 東=月干 / 西=年干
   - 十二大従星（エネルギー）：初年=年支 / 中年=月支 / 晩年=日支 の十二運から変換
   - 日干タイプ（五行×陰陽の気質）
   - 干支三柱（陰占の素データ）
   AI不使用・完全決定論。
   ────────────────────────────────────────────────────────────── */

// 十二運（十二支星）：陽干は順行・陰干は逆行。長生の起点支から12支を順に当てる。
// 起点（長生）: 甲=亥, 丙/戊=寅, 庚=巳, 壬=申（陽・順行） / 乙=午, 丁/己=酉, 辛=子, 癸=卯（陰・逆行）
// 12段階の並び（長生から）: 長生→沐浴→冠帯→建禄→帝旺→衰→病→死→墓→絶→胎→養
const UNSEI_ORDER = ["長生", "沐浴", "冠帯", "建禄", "帝旺", "衰", "病", "死", "墓", "絶", "胎", "養"];
const CHANGSHENG = { 甲: "亥", 丙: "寅", 戊: "寅", 庚: "巳", 壬: "申", 乙: "午", 丁: "酉", 己: "酉", 辛: "子", 癸: "卯" };
// 日干と支から十二運名を返す
function unseiOf(meStem, branch) {
  const startBranch = CHANGSHENG[meStem];
  const startIdx = Z.indexOf(startBranch);
  const branchIdx = Z.indexOf(branch);
  const yang = (G.indexOf(meStem) % 2) === 0; // 甲丙戊庚壬=陽
  // 起点からの支のステップ数（陽=順行 / 陰=逆行）
  const step = yang
    ? ((branchIdx - startIdx) % 12 + 12) % 12
    : ((startIdx - branchIdx) % 12 + 12) % 12;
  return UNSEI_ORDER[step];
}

// 十二運 → 十二大従星（名称・エネルギー値1〜12）。高尾系標準対応。
const UNSEI_TO_JUSEI = {
  胎: { name: "天報星", energy: 3 },
  養: { name: "天印星", energy: 6 },
  長生: { name: "天貴星", energy: 9 },
  沐浴: { name: "天恍星", energy: 7 },
  冠帯: { name: "天南星", energy: 10 },
  建禄: { name: "天禄星", energy: 11 },
  帝旺: { name: "天将星", energy: 12 },
  衰: { name: "天堂星", energy: 8 },
  病: { name: "天胡星", energy: 4 },
  死: { name: "天極星", energy: 2 },
  墓: { name: "天庫星", energy: 5 },
  絶: { name: "天馳星", energy: 1 },
};
// 十二大従星の時期別・起業家向けの勢いコメント
const JUSEI_MEANING = {
  天報星: "変化と可能性の星。多方向に芽を出す、アイデアの時期。",
  天印星: "守られ育まれる星。人の助けを借りて素直に伸びる時期。",
  天貴星: "純粋で真っ直ぐな星。理想を掲げて学び育つ時期。",
  天恍星: "夢とロマンの星。憧れに動かされ、人を惹きつける時期。",
  天南星: "若き行動力の星。勢いで一気に攻め込める時期。",
  天禄星: "現実的な働き者の星。地に足をつけ着実に積む時期。",
  天将星: "最大エネルギーの星。トップに立ち大きく勝負できる時期。",
  天堂星: "円熟と知恵の星。経験を生かし、まとめ役で力を発揮する時期。",
  天胡星: "繊細な感性の星。無理せず内面・専門性を深める時期。",
  天極星: "精神性の星。手放し、本質に集中して再生する時期。",
  天庫星: "蓄積と継承の星。資産・ノウハウをストックし守る時期。",
  天馳星: "スピードと無限の星。型を超え自由に駆け抜ける時期。",
};

// 日干タイプ（十干10種）。五行×陰陽の気質、起業家向けの一言。
const DAY_TYPE = {
  甲: { label: "陽の木＝大樹タイプ", desc: "真っ直ぐ上へ伸びるリーダー気質。曲げない芯で組織を引っ張る。" },
  乙: { label: "陰の木＝草花タイプ", desc: "しなやかに環境へ適応する世渡り上手。人と絡んで生き残る。" },
  丙: { label: "陽の火＝太陽タイプ", desc: "明るく目立つ発信者。情熱と存在感で人を巻き込む。" },
  丁: { label: "陰の火＝灯火タイプ", desc: "繊細で一点を温める集中力。専門性と細やかさで信頼を得る。" },
  戊: { label: "陽の土＝山岳タイプ", desc: "どっしり構える安定の人。スケールの大きさと包容力が武器。" },
  己: { label: "陰の土＝田畑タイプ", desc: "実りを育てる現実家。地道に育成・運用して成果を積む。" },
  庚: { label: "陽の金＝鉄鋼タイプ", desc: "決断と実行の改革者。白黒つける突破力で局面を打開する。" },
  辛: { label: "陰の金＝宝石タイプ", desc: "磨かれた美意識とプライド。質と完成度で勝負する職人肌。" },
  壬: { label: "陽の水＝大海タイプ", desc: "発想自由で器が大きい。流れを読み、大胆に動く戦略家。" },
  癸: { label: "陰の水＝雨露タイプ", desc: "知的で気配り上手。情報・潤いを行き渡らせる調整役。" },
};

// 主星の位置メタ（高尾系・人体星図の十字配置）。位置の意味は標準的な人体星図の配当に準拠。
const POS_META = {
  center: { posLabel: "中央（胸）・中心星", posMeaning: "本質・本来の自分。経営の核となる素の気質。", source: "月支蔵干" },
  north: { posLabel: "頭・第四命星", posMeaning: "目上・年長者（親／上司）から見たあなた。精神性と仕事への向き合い方。", source: "年支蔵干" },
  south: { posLabel: "腹・第二命星", posMeaning: "社会的な顔・目下（部下／子）から見たあなた。現実の行動・実務の出方。", source: "日支蔵干" },
  east: { posLabel: "右手・第一命星", posMeaning: "配偶者・家庭・身近な人から見たあなた。プライベートでの出方。", source: "月干" },
  west: { posLabel: "左手・第三命星", posMeaning: "友人・兄弟・恋人から見たあなた。仲間うちでの魅力。", source: "年干" },
};

// 主星を1つ組み立てる
function buildStar(pos, me, sourceStem) {
  const god = tenGod(me, sourceStem);
  const star = TEN_GOD_TO_STAR[god] || "貫索星";
  const d = STAR_DESC[star];
  const m = POS_META[pos];
  return {
    pos,
    posLabel: m.posLabel,
    posMeaning: m.posMeaning,
    source: m.source,
    sourceStem,
    star,
    god,
    emoji: d.emoji,
    title: d.title,
    desc: d.desc,
    biz: d.biz,
  };
}

// 算命学・人体星図（陽占）の完全データを返す。出生情報が無ければ null。
export function sanmeiDetail(birth) {
  if (!birth || !birth.date) return null;
  try {
    const c = computeChart(birth);
    const me = c.dayMaster;

    const yearStem = String(c.yearPillar).slice(0, 1);
    const yearBranch = String(c.yearPillar).slice(-1);
    const monthStem = String(c.monthPillar).slice(0, 1);
    const monthBranch = String(c.monthPillar).slice(-1);
    const dayBranch = String(c.dayPillar).slice(-1);

    // ── 五主星（十大主星） ──
    const center = buildStar("center", me, HIDDEN[monthBranch] || me); // 月支蔵干
    const north = buildStar("north", me, HIDDEN[yearBranch] || me);    // 年支蔵干
    const south = buildStar("south", me, HIDDEN[dayBranch] || me);     // 日支蔵干
    const east = buildStar("east", me, monthStem);                     // 月干
    const west = buildStar("west", me, yearStem);                      // 年干
    const stars = [center, north, south, east, west];

    // ── 十二大従星（エネルギー）3つ ──
    const mkEnergy = (phase, branch) => {
      const unsei = unseiOf(me, branch);
      const j = UNSEI_TO_JUSEI[unsei];
      return { phase, name: j.name, energy: j.energy, unsei, meaning: JUSEI_MEANING[j.name] };
    };
    const energies = [
      mkEnergy("初年", yearBranch),  // 初年期=年支
      mkEnergy("中年", monthBranch), // 中年期=月支
      mkEnergy("晩年", dayBranch),   // 晩年期=日支
    ];

    // ── 日干タイプ ──
    const dt = DAY_TYPE[me];
    const dayType = {
      stem: me,
      element: FIVE[me],
      yinYang: (G.indexOf(me) % 2) === 0 ? "陽" : "陰",
      label: dt.label,
      desc: dt.desc,
    };

    return {
      center,
      stars,
      energies,
      dayType,
      pillars: { year: c.yearPillar, month: c.monthPillar, day: c.dayPillar },
    };
  } catch { return null; }
}

/* ════════════════════════════════════════════════════════════════
   算命学・新規4関数（すべて決定論・AI不使用）
   1) tenchusatsu  天中殺
   2) daiun        大運（10年ロードマップ）
   3) aishou       2人の相性
   4) familyFortune 家族・チーム全体の今日の運気
   ════════════════════════════════════════════════════════════════ */

// 60干支のindex(0=甲子..59=癸亥)を求めるユーティリティ
function ganzhiIndex(stem, branch) {
  // 干支は 10と12の最小公倍数=60周期。stemIdx は 0..9, branchIdx は 0..11。
  // index は 0..59 で stem=index%10, branch=index%12 を満たす唯一の値。
  const s = G.indexOf(stem), b = Z.indexOf(branch);
  for (let i = 0; i < 60; i++) if (i % 10 === s && i % 12 === b) return i;
  return 0;
}
function ganzhiName(idx) {
  const i = ((idx % 60) + 60) % 60;
  return G[i % 10] + Z[i % 12];
}

/* ── 1) 天中殺 ────────────────────────────────────────────────
   日柱の属する旬（10干支ずつ6グループ）で決まる。
   旬の起点（甲で始まるindex 0,10,20,30,40,50）→ 抜け落ちる2支=天中殺。
   甲子旬(0-9): 戌亥 / 甲戌旬(10-19): 申酉 / 甲申旬(20-29): 午未
   甲午旬(30-39): 辰巳 / 甲辰旬(40-49): 寅卯 / 甲寅旬(50-59): 子丑
   → 各旬は支を10個しか使わず、12支のうち2支が「空亡(天中殺)」になる。 */
const JUN_TENCHU = [
  { jun: "甲子旬", branches: ["戌", "亥"], name: "戌亥天中殺" },
  { jun: "甲戌旬", branches: ["申", "酉"], name: "申酉天中殺" },
  { jun: "甲申旬", branches: ["午", "未"], name: "午未天中殺" },
  { jun: "甲午旬", branches: ["辰", "巳"], name: "辰巳天中殺" },
  { jun: "甲辰旬", branches: ["寅", "卯"], name: "寅卯天中殺" },
  { jun: "甲寅旬", branches: ["子", "丑"], name: "子丑天中殺" },
];

export function tenchusatsu(birth) {
  try {
    if (!birth || !birth.date) return null;
    const c = computeChart(birth);
    const dayStem = String(c.dayPillar).slice(0, 1);
    const dayBranch = String(c.dayPillar).slice(-1);
    const dayIdx = ganzhiIndex(dayStem, dayBranch);
    const junIdx = Math.floor(dayIdx / 10); // 0..5
    const info = JUN_TENCHU[junIdx];
    if (!info) return null;

    // branches に当たる十二支の西暦年（今年=2026 以降で近い2つ）を算出。
    // 年の干支は computeChart の年柱ロジックと同じ基準: index = (year-1984) % 60。
    const thisYear = new Date().getFullYear();
    const years = [];
    let y = thisYear;
    while (years.length < 2 && y < thisYear + 24) {
      const yi = (((y - 1984) % 60) + 60) % 60;
      const yb = Z[yi % 12];
      if (info.branches.includes(yb)) years.push(y);
      y++;
    }

    return {
      name: info.name,
      jun: info.jun,
      branches: info.branches.slice(),
      years,
      desc: "運気の休息・充電期。新規拡大より整理・内省が吉。",
    };
  } catch { return null; }
}

/* ── 2) 大運（10年ロードマップ）─────────────────────────────────
   月柱を起点に、陽男陰女=順行／陰男陽女=逆行で60干支を10年ごとに進退。
   立運（開始年齢）= 出生から次の節入りまでの日数 / 3 を近似（簡易: 出生日の太陽黄経が
   節（30°区切り,起点315°）を越えるまでの度数 → 1日≒1°換算で日数化 → /3 年）。
   gender 未設定なら順行を仮定し assumed=true。 */
const DAIUN_THEME = {
  貫索星: "我が道を貫き、土台を太くする10年。看板事業を磨き込む。",
  石門星: "仲間・コラボで広げる10年。チームとネットワークが資産になる。",
  鳳閣星: "楽しみながら発信・体験で広げる10年。遊び心が売上に変わる。",
  調舒星: "こだわりと世界観を尖らせる10年。指名・ブランド化が進む。",
  禄存星: "尽くし与えることで人とお金が集まる10年。ホスピタリティ拡大期。",
  司禄星: "積み上げ・仕組み化の10年。リピート/会員で安定収益を築く。",
  車騎星: "スピードと行動で攻める10年。先陣を切り市場を取りにいく。",
  牽牛星: "信頼と実績を固める10年。権威性で大きな仕事を任される。",
  龍高星: "挑戦・刷新・新規開拓の10年。型を破り新領域へ踏み出す。",
  玉堂星: "学び・教える・体系化の10年。知の資産で価値を最大化する。",
};

export function daiun(birth) {
  try {
  if (!birth || !birth.date) return null;
  const c = computeChart(birth);
  const me = c.dayMaster;
  if (!me) return null;
  const yearStem = String(c.yearPillar).slice(0, 1);
  const monthIdx = ganzhiIndex(String(c.monthPillar).slice(0, 1), String(c.monthPillar).slice(-1));

  // 順逆判定: 年干の陰陽 × 性別。陽年干=甲丙戊庚壬(index偶数)。
  const yangYear = (G.indexOf(yearStem) % 2) === 0;
  const gender = (birth && birth.gender) || "";
  let assumed = false, forward;
  if (gender === "male") forward = yangYear;        // 陽男=順 / 陰男=逆
  else if (gender === "female") forward = !yangYear; // 陰女=順 / 陽女=逆
  else { forward = true; assumed = true; }           // 未設定は順行仮定

  // 立運（開始年齢）の近似: 出生時の太陽黄経から次の節（30°境界, 起点315°）までの度数。
  // 順行なら次の節まで、逆行なら前の節までの度数を使う（簡易）。1°≒1日, 3日=1歳。
  let startAge = 0;
  try {
    const [Y, M, D] = String(birth.date).split("-").map(Number);
    const [hh = 12, mm = 0] = String(birth.time || "12:00").split(":").map(Number);
    const utcOffset = birth.utcOffset ?? 9;
    const utc = new Date(Date.UTC(Y, M - 1, D, hh - utcOffset, mm));
    const sunLon = norm(A.SunPosition(A.MakeTime(utc)).elon);
    const fromSetsu = norm(sunLon - 315); // 立春315°起点での節内位置 0..360
    const within = fromSetsu % 30;        // 直近の節からの経過度数
    const deg = forward ? (30 - within) : within; // 次/前の節までの度数
    startAge = Math.max(0, Math.round((deg / 3) * 10) / 10); // 度=日, /3=年
  } catch { startAge = 0; }

  // 現在年齢
  const now = new Date();
  let age = now.getFullYear() - Number(String(birth.date).split("-")[0]);
  const bm = Number(String(birth.date).split("-")[1]), bd = Number(String(birth.date).split("-")[2]);
  if (now.getMonth() + 1 < bm || (now.getMonth() + 1 === bm && now.getDate() < bd)) age--;

  // 各大運期(10年)を作る。第1期は startAge から始まる。
  const period = (k) => {
    const idx = ((monthIdx + (forward ? k : -k)) % 60 + 60) % 60;
    const ganzhi = ganzhiName(idx);
    const stem = ganzhi.slice(0, 1);
    const god = tenGod(me, stem);
    const star = TEN_GOD_TO_STAR[god] || "貫索星";
    const unsei = unseiOf(me, ganzhi.slice(-1));
    const ageFrom = Math.round((startAge + k * 10) * 10) / 10;
    const ageTo = Math.round((startAge + (k + 1) * 10) * 10) / 10;
    return { k, ageFrom, ageTo, ganzhi, god, star, unsei, theme: DAIUN_THEME[star] };
  };

  // 立運前（未来生まれ/乳児など age<startAge）かどうか。
  // この場合は「現在どの大運期にも入っていない（立運前）」とし、第1期を"現在"と誤表示しない。
  const preStart = age < startAge;

  // 現在どの期にいるか（k>=0 で ageFrom<=age<ageTo を満たす最初）。立運前は curK=-1（該当なし）。
  let curK = -1;
  if (!preStart) {
    curK = 0;
    for (let k = 0; k < 12; k++) {
      const p = period(k);
      if (age < p.ageTo) { curK = k; break; }
      curK = k;
    }
  }
  const cur = preStart ? null : period(curK);

  // ロードマップ: 立運前は第0〜4期を表示（current無し）。それ以外は現在含む前後計5期。
  let from = preStart ? 0 : Math.max(0, curK - 2);
  if (from + 4 > 11) from = Math.max(0, 11 - 4);
  const roadmap = [];
  for (let k = from; k <= from + 4; k++) {
    const p = period(k);
    roadmap.push({ ageFrom: p.ageFrom, ageTo: p.ageTo, ganzhi: p.ganzhi, star: p.star, theme: p.theme, current: !preStart && k === curK });
  }

  // current: 立運前は preStart フラグを立て、age と startAge のみ返す（期データは null）。
  // ★UI担当向け: daiun().current は preStart=true の場合 ganzhi/star/theme 等が無い（age と startAge と preStart のみ）。
  //   その場合 roadmap には current:true が一つも無い（どの期も「現在」にしない）。
  const current = preStart
    ? { preStart: true, age, startAge, ageFrom: null, ageTo: null, ganzhi: null, god: null, star: null, unsei: null, theme: null }
    : { preStart: false, age, ageFrom: cur.ageFrom, ageTo: cur.ageTo, ganzhi: cur.ganzhi, god: cur.god, star: cur.star, unsei: cur.unsei, theme: cur.theme };

  return {
    assumed,
    direction: forward ? "順行" : "逆行",
    startAge,
    preStart,            // ★追加: 立運前（まだ大運が始まっていない）なら true
    current,
    roadmap,
  };
  } catch { return null; }
}

/* ── 3) 2人の相性 ──────────────────────────────────────────────
   日干関係・五行バランス・中心星グループ・日支関係を重み付けで総合。 */

// 干合（天干合）: 甲己/乙庚/丙辛/丁壬/戊癸。陰陽が結びつき新たな五行を生む最良の縁。
const GANGOU = { 甲: "己", 己: "甲", 乙: "庚", 庚: "乙", 丙: "辛", 辛: "丙", 丁: "壬", 壬: "丁", 戊: "癸", 癸: "戊" };
// 支合（六合）: 子丑/寅亥/卯戌/辰酉/巳申/午未。
const SHIGOU = { 子: "丑", 丑: "子", 寅: "亥", 亥: "寅", 卯: "戌", 戌: "卯", 辰: "酉", 酉: "辰", 巳: "申", 申: "巳", 午: "未", 未: "午" };
// 冲（七冲）: 子午/丑未/寅申/卯酉/辰戌/巳亥。
const CHONG = { 子: "午", 午: "子", 丑: "未", 未: "丑", 寅: "申", 申: "寅", 卯: "酉", 酉: "卯", 辰: "戌", 戌: "辰", 巳: "亥", 亥: "巳" };
// 三合: 申子辰(水)/亥卯未(木)/寅午戌(火)/巳酉丑(金)。同グループ2支=三合の縁。
const SANGOU_GROUPS = [["申", "子", "辰"], ["亥", "卯", "未"], ["寅", "午", "戌"], ["巳", "酉", "丑"]];
function isSangou(a, b) {
  if (a === b) return false;
  return SANGOU_GROUPS.some((g) => g.includes(a) && g.includes(b));
}
// 十大主星を3グループに大別（性質の近さ）。守備=貫索/石門/牽牛/司禄, 伝達=鳳閣/調舒/玉堂, 攻撃=禄存/車騎/龍高。
const STAR_GROUP = {
  貫索星: "守備", 石門星: "守備", 牽牛星: "守備", 司禄星: "守備",
  鳳閣星: "伝達", 調舒星: "伝達", 玉堂星: "伝達",
  禄存星: "行動", 車騎星: "行動", 龍高星: "行動",
};

export function aishou(birthA, birthB) {
  try {
    // 防御: A/Bどちらかの birth.date が不正なら null（UIが落ちないことを優先）
    if (!birthA || !birthA.date || !birthB || !birthB.date) return null;
    const ca = computeChart(birthA), cb = computeChart(birthB);
    const meA = ca.dayMaster, meB = cb.dayMaster;
    if (!meA || !meB) return null;
    const sa = sanmeiDetail(birthA), sb = sanmeiDetail(birthB);
    const elemA = FIVE[meA], elemB = FIVE[meB];
    const branchA = String(ca.dayPillar).slice(-1), branchB = String(cb.dayPillar).slice(-1);
    const starA = sa?.center?.star || "貫索星", starB = sb?.center?.star || "貫索星";

    // 加減算式（基準50点）。加点だけでなく冲=大減点・剋=減点を入れ、30台〜100に分布させる。
    let score = 50;
    const notes = [];
    const reasons = []; // スコアの根拠の断片（UI表示用）

    // (1) 日干関係（重み最大）
    let kanRel;
    if (GANGOU[meA] === meB) {
      score += 26; kanRel = "干合";
      notes.push("日干が干合。惹かれ合い結びつく最良の縁。");
      reasons.push("日干が干合(+)");
    } else if (GEN[elemA] === elemB) {
      score += 16; kanRel = "Aが生む";
      notes.push("AがBを生かす関係。AはBを育て支える。");
      reasons.push("日干が相生(+)");
    } else if (GEN[elemB] === elemA) {
      score += 16; kanRel = "Bが生む";
      notes.push("BがAを生かす関係。BはAを育て支える。");
      reasons.push("日干が相生(+)");
    } else if (elemA === elemB) {
      score += 10; kanRel = "比和";
      notes.push("日干が同じ五行。価値観が近く息が合う。");
      reasons.push("日干が比和(+)");
    } else if (CTRL[elemA] === elemB) {
      score -= 10; kanRel = "Aが剋す";
      notes.push("AがBを律する関係。摩擦も出るが、Aが主導すれば噛み合う。");
      reasons.push("日干が相剋(-)");
    } else if (CTRL[elemB] === elemA) {
      score -= 10; kanRel = "Bが剋す";
      notes.push("BがAを律する関係。摩擦も出るが、Bが主導すれば噛み合う。");
      reasons.push("日干が相剋(-)");
    } else { kanRel = "中立"; }

    // (2) 中心星グループの相性
    const ga = STAR_GROUP[starA], gb = STAR_GROUP[starB];
    if (ga === gb) {
      score += 6; notes.push(`中心星が同系統(${ga})。動き方の感覚が揃う。`);
      reasons.push("中心星が同系統(+)");
    } else {
      score -= 2; notes.push(`中心星が異系統(${ga}×${gb})。役割を分けると強い。`);
      reasons.push("中心星が異系統(±)");
    }

    // (3) 日支の関係（冲=大減点 / 相剋=減点 / 支合・三合・同支=加点）
    let zhiRel;
    if (SHIGOU[branchA] === branchB) {
      score += 16; zhiRel = "支合";
      notes.push("日支が支合。距離が縮まり安定する組み合わせ。");
      reasons.push("日支が支合(+)");
    } else if (isSangou(branchA, branchB)) {
      score += 16; zhiRel = "三合";
      notes.push("日支が三合。同じ目的に向かい協力しやすい。");
      reasons.push("日支が三合(+)");
    } else if (branchA === branchB) {
      score += 8; zhiRel = "同支";
      notes.push("日支が同じ。似た者同士で居心地がよい。");
      reasons.push("日支が同支(+)");
    } else if (CHONG[branchA] === branchB) {
      score -= 18; zhiRel = "冲";
      notes.push("日支が冲。強く刺激し合う一方で、衝突や温度差も生まれやすい。");
      reasons.push("日支が冲(--)");
    } else {
      // 日支の五行が相剋なら減点
      const be = FIVE[HIDDEN[branchA]] || "", bbe = FIVE[HIDDEN[branchB]] || "";
      if (be && bbe && (CTRL[be] === bbe || CTRL[bbe] === be)) {
        score -= 8; zhiRel = "相剋";
        notes.push("日支が相剋。ペースや価値観のズレが出やすい。");
        reasons.push("日支が相剋(-)");
      } else {
        zhiRel = "中立";
        reasons.push("日支は中立(±)");
      }
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    // ラベル（前向き語のまま。"悪い/NG"は使わない）。30台〜100の分布に合わせて閾値調整。
    let label;
    if (score >= 78) label = "深い共鳴";
    else if (score >= 62) label = "息が合う";
    else if (score >= 48) label = "補い合う";
    else if (score >= 38) label = "刺激し合う";
    else label = "違いが大きい";

    // 役割分担 howto（星グループから）。どのスコアでも必ず1件以上。
    const roleOf = (g) => g === "守備" ? "土台・継続・管理" : g === "伝達" ? "発信・企画・伝える" : "突破・開拓・実行";
    const howto = [];
    if (ga === gb) howto.push(`二人とも${roleOf(ga)}が得意。逆方向(${ga === "守備" ? "開拓/発信" : ga === "伝達" ? "土台/実行" : "管理/守り"})を外部や仕組みで補うと盤石。`);
    else howto.push(`Aは${roleOf(ga)}、Bは${roleOf(gb)}を担うと噛み合う。`);
    if (kanRel === "干合") howto.push("公私が混ざりやすい縁。役割と境界を言語化しておくと長続きする。");
    if (zhiRel === "冲") howto.push("ぶつかるのは相性が悪いからではなく刺激が強いから。結論を急がず『論点を出し切る』議論にすると活きる。");
    if (zhiRel === "相剋") howto.push("ペースが違う前提で、締切や役割を先に決めておくとすれ違いが減る。");
    if (kanRel.includes("剋")) howto.push("律する側が言い過ぎないこと。指摘は『提案+理由』のセットで伝えると関係が安定する。");
    // 低スコアほど "こう組めば活きる" 対処を厚めに
    if (score < 48) howto.push("似せようとせず、得意な持ち場をはっきり分けると、違いがそのまま戦力になる。");
    if (howto.length < 2) howto.push("定期的に方向性をすり合わせる場を持つと、強みが噛み合い続ける。");

    const positive = (kanRel === "干合" || GEN[elemA] === elemB || GEN[elemB] === elemA || zhiRel === "支合" || zhiRel === "三合");
    const summary = `${label}の関係（${score}点）。日干は${kanRel}、日支は${zhiRel}、中心星は${starA}×${starB}。${positive ? "自然に手を取り合える相性。" : "違いを役割に変えると伸びる相性。"} 根拠: ${reasons.join("・")}`;

    const dirText = (from, to, fe, te) => {
      if (GEN[fe] === te) return `${from}は${to}を育て支える(生)。`;
      if (CTRL[fe] === te) return `${from}は${to}を引き締め律する(剋)。`;
      if (fe === te) return `${from}は${to}と同調し共鳴する(比和)。`;
      return `${from}は${to}に刺激と気づきを与える。`;
    };

    return {
      score,
      label,
      summary,
      reasons,         // ★追加: スコア根拠の断片配列（UI表示用。例 ["日干が干合(+)","日支が冲(--)"]）
      howto,
      aToB: dirText("A", "B", elemA, elemB),
      bToA: dirText("B", "A", elemB, elemA),
      detail: {
        dayStemA: meA, dayStemB: meB, kanRel, zhiRel,
        centerStarA: starA, centerStarB: starB,
        elemA, elemB, branchA, branchB, notes, reasons,
      },
    };
  } catch { return null; }
}

/* ── 4) 家族・チーム全体の今日の運気 ───────────────────────────
   各メンバーの今日の日運(relationFor)を出し、全体調和と動き方を返す。 */
export function familyFortune(members, dateISO) {
  const date = dateISO || new Date().toISOString().slice(0, 10);
  const list = [];
  for (const mb of members || []) {
    try {
      const c = computeChart(mb.birth);
      const me = FIVE[c.dayMaster] || "水";
      const r = relationFor(me, date);
      const dt = (sanmeiDetail(mb.birth)?.dayType) || null;
      list.push({
        name: mb.name,
        score: r.score,
        stance: r.stance,
        focus: r.focus,
        relation: r.relation,
        dayType: dt ? dt.label : "",
        _elem: me,
      });
    } catch {
      list.push({ name: mb.name, score: 3, stance: "整える", focus: "情報不足のため平常運転で。", relation: "", dayType: "" });
    }
  }

  const valid = list.filter((m) => typeof m.score === "number");
  const avg = valid.length ? valid.reduce((s, m) => s + m.score, 0) / valid.length : 3;
  const teamScore = Math.max(1, Math.min(5, Math.round(avg)));

  // 最も勢い=最高スコア（同点なら攻めスタンス優先）、支え役=最低スコア。
  const stancePri = { 攻め: 0, 整える: 1, 労い: 2, 守り: 3 };
  const sorted = [...valid].sort((a, b) => b.score - a.score || stancePri[a.stance] - stancePri[b.stance]);

  // ── 旗振り/支え役を言及してよいか判定 ──
  // 矛盾を避けるため、次のいずれかなら言及しない（bestMover/supporter は null）:
  //   (a) teamScore < 3（全体に守りの日 → 「旗振り」と矛盾する）
  //   (b) 全員が同じスタンス（役割を分ける前提が成立しない）
  //   (c) スコア最大と最小の差が僅差（< 2）で序列が意味を持たない
  //   (d) 有効メンバーが2人未満
  const scores = valid.map((m) => m.score);
  const spread = scores.length ? Math.max(...scores) - Math.min(...scores) : 0;
  const allSameStance = valid.length > 0 && valid.every((m) => m.stance === valid[0].stance);
  const top = sorted.length ? sorted[0] : null;
  const bottom = sorted.length ? sorted[sorted.length - 1] : null;
  const mentionRoles =
    valid.length >= 2 &&
    teamScore >= 3 &&
    !allSameStance &&
    spread >= 2 &&
    !!top && !!bottom && top.name !== bottom.name;

  // ★UI担当向け: bestMover/supporter は上記条件を満たさない場合 null になる
  //   （全員守り/同スタンス/僅差/人数不足）。null のときは UI で旗振り・支え役を出さない想定。
  const bestMover = mentionRoles ? top.name : null;
  const supporter = mentionRoles ? bottom.name : null;

  // 名前に既に敬称が付いていれば「さん」を重ねない（例「ゆうたさん」→そのまま）
  const withSan = (n) => (/(?:さん|様|ちゃん|くん|君)$/.test(String(n || "")) ? n : `${n}さん`);

  // 仕事チームにも家族にも合う中立・前向きなトーン（「攻めの一手」等の業務語を避ける）
  let advice;
  if (teamScore >= 4) advice = "全体に追い風の日。調子のいい人が中心になって、みんなで前向きに動けると良い日。";
  else if (teamScore >= 3) advice = "ペースが分かれる日。動ける人と休む人で、自然に役割を分け合うとうまく回ります。";
  else advice = "全体にゆったりの日。無理に動かず、休息や対話・関係づくりに時間を使うと吉。";
  // advice 本文と矛盾しないときだけ、中心役・支え役をやわらかく追記。
  if (mentionRoles && bestMover && supporter && bestMover !== supporter) {
    advice += `今日は${withSan(bestMover)}が中心に、${withSan(supporter)}が支えに回るとバランスが取れます。`;
  }

  return {
    date,
    members: list.map(({ _elem, ...m }) => m),
    teamScore,
    advice,
    bestMover,
    supporter,
  };
}


/* ──────────────────────────────────────────────────────────────
   算命学・運氣の流れ（日運／月運／年運）：その時点の干支と本人の日干から
   「今動いている十大主星」を出す。人体星図と同じ星言語で“流れ・動き”を表す。
   AI不使用・完全決定論。
   ────────────────────────────────────────────────────────────── */
// 各主星の「動き方」エッセンス（期間を問わず使える中立表現。UI側で今日/今月/今年を前置）
const STAR_MOVE = {
  貫索星: "自分の軸を貫く流れ。定番・看板を地道に太く。人に合わせすぎないのが吉。",
  石門星: "人と組むと伸びる流れ。輪を広げ、協力・ネットワークを動かす。",
  鳳閣星: "楽しんで表現する流れ。発信・会話・遊び心が良い運を呼ぶ。",
  調舒星: "感性が冴える流れ。こだわりの制作・繊細な表現に集中すると◎。",
  禄存星: "尽くすと返る流れ。気配り・サービス・人への投資が運を開く。",
  司禄星: "コツコツ積む流れ。記録・整理・蓄えが地力になる。",
  車騎星: "動いて勝つ流れ。即行動・営業・前進。スピードが武器。",
  牽牛星: "誇りと信用の流れ。きちんと装い、責任ある立ち回りで評価が上がる。",
  龍高星: "挑戦と学びの流れ。新しい世界・未知へ。型を破る一手が吉。",
  玉堂星: "学び直す流れ。情報収集・知識の整理・じっくり思考が活きる。",
};

// 本人の日干 × その日の年柱/月柱/日柱 から、今動く主星を返す。出生情報が無ければ null。
export function sanmeiUn(birth, dateISO) {
  try {
    if (!birth || !birth.date) return null;
    const me = computeChart(birth).dayMaster;
    const iso = dateISO || new Date().toISOString().slice(0, 10);
    const tc = computeChart({ date: iso, time: "12:00" }); // その日の年・月・日柱
    const mk = (pillar) => {
      const stem = String(pillar).slice(0, 1);
      const god = tenGod(me, stem);
      const star = TEN_GOD_TO_STAR[god] || "貫索星";
      const d = STAR_DESC[star] || {};
      return { ganzhi: pillar, stem, god, star, emoji: d.emoji, title: d.title, move: STAR_MOVE[star] };
    };
    const rel = relationFor(FIVE[me], iso); // 五行ベースのスタンス/スコア（既存の波と整合）
    return {
      day: { ...mk(tc.dayPillar), stance: rel.stance, score: rel.score },
      month: mk(tc.monthPillar),
      year: mk(tc.yearPillar),
    };
  } catch { return null; }
}
