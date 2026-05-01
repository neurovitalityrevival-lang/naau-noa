const https = require('https');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// ── メニューごとの所要時間（分）──
const MENU_DURATIONS = {
  '《新規限定》オンライン無料個別相談': 60,
  '《新規10:00~17:00限定》AET自律神経整体付き個別相談（60分）4980円': 60,
  '《10:00~17:00限定》AETエネルギー整体（90分）33,000円': 90,
  '《2回目以降》オンラインリリースワーク（90分）33,000円': 90
};

// ── Supabase ──
function hashData(d) {
  return d ? crypto.createHash('sha256').update(d.trim().toLowerCase()).digest('hex') : null;
}

function supabase(path, method = 'GET', body = null) {
  const url = new URL('https://quacqiugfcwdqxzutqpq.supabase.co' + path);
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = {
      'apikey': 'sb_publishable_eyMShPrkyDZvtSejJDx9HA_UgMsRwJI',
      'Authorization': `Bearer sb_publishable_eyMShPrkyDZvtSejJDx9HA_UgMsRwJI`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request({ hostname: url.hostname, path: url.pathname + url.search, method, headers }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(d) }); } catch(e) { resolve({ status: res.statusCode, data: d }); } });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ── Meta CAPI ──
async function sendCAPI({ name, email, phone, sourceUrl }) {
  const PID = process.env.META_PIXEL_ID, AT = process.env.META_ACCESS_TOKEN;
  if (!PID || !AT) return;
  const ud = {};
  if (email) ud.em = [hashData(email)];
  if (phone) ud.ph = [hashData(phone.replace(/\D/g,''))];
  if (name) { const p = name.trim().split(/\s+/); ud.fn = [hashData(p[0])]; if (p.length > 1) ud.ln = [hashData(p[p.length-1])]; }
  const pd = JSON.stringify({ data: [{ event_name: 'Schedule', event_time: Math.floor(Date.now()/1000), event_id: `sch_${Date.now()}`, action_source: 'website', event_source_url: sourceUrl || 'https://naau-noa.vercel.app/booking.html', user_data: ud, custom_data: { content_name: '予約' } }] });
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'graph.facebook.com', path: `/v19.0/${PID}/events?access_token=${AT}`, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(pd) } }, (res) => { let d=''; res.on('data', c=>d+=c); res.on('end', ()=>resolve(d)); });
    req.on('error', reject);
    req.write(pd);
    req.end();
  });
}

// ── メール送信 ──
async function sendEmails({ name, email, phone, menu, date, startTime, endTime }) {
  const user = process.env.GMAIL_USER || 'neuro.vitality.revival@gmail.com';
  const pass = process.env.GMAIL_APP_PASSWORD || 'hpjhneugdbybxplq';

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });

  // 日付フォーマット
  const [y, m, d] = date.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const DOW = ['日','月','火','水','木','金','土'];
  const dateLabel = `${y}年${m}月${d}日（${DOW[dateObj.getDay()]}）`;

  // ── 管理者への通知メール ──
  const adminHtml = `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><style>
body { font-family: 'Noto Serif JP', Georgia, serif; background:#f0ebe3; margin:0; padding:20px; }
.wrap { max-width:560px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 20px rgba(0,0,0,0.08); }
.header { background:#1a3a3a; padding:24px 32px; text-align:center; }
.header h1 { color:#b8976a; font-size:1.1rem; letter-spacing:0.1em; margin:0; }
.body { padding:28px 32px; }
.alert { background:#fff8e8; border-left:4px solid #b8976a; padding:12px 16px; border-radius:4px; margin-bottom:24px; font-size:0.95rem; color:#7a5c2a; }
table { width:100%; border-collapse:collapse; }
td { padding:10px 12px; border-bottom:1px solid #f0ebe3; font-size:0.92rem; vertical-align:top; }
td:first-child { width:110px; color:#888; white-space:nowrap; }
td:last-child { color:#2c2c2c; font-weight:600; }
.footer { background:#f0ebe3; padding:16px 32px; text-align:center; font-size:0.78rem; color:#aaa; }
</style></head>
<body><div class="wrap">
  <div class="header"><h1>Na'au Noa 管理画面</h1></div>
  <div class="body">
    <div class="alert">📅 新しいご予約が入りました</div>
    <table>
      <tr><td>日時</td><td>${dateLabel} ${startTime}〜${endTime}</td></tr>
      <tr><td>メニュー</td><td>${menu}</td></tr>
      <tr><td>お名前</td><td>${name} 様</td></tr>
      <tr><td>メール</td><td>${email}</td></tr>
      <tr><td>電話番号</td><td>${phone}</td></tr>
    </table>
  </div>
  <div class="footer">Na'au Noa 自動通知メール</div>
</div></body></html>`;

  // ── お客様への確認メール ──
  const customerHtml = `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><style>
body { font-family: 'Noto Serif JP', Georgia, serif; background:#f0ebe3; margin:0; padding:20px; }
.wrap { max-width:560px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 20px rgba(0,0,0,0.08); }
.header { background:#1a3a3a; padding:28px 32px; text-align:center; }
.header .logo { color:#b8976a; font-size:1.1rem; letter-spacing:0.1em; margin-bottom:6px; }
.header p { color:#c8b89a; font-size:0.85rem; margin:0; }
.body { padding:28px 32px; }
.greeting { font-size:1rem; color:#1a3a3a; margin-bottom:20px; line-height:1.8; }
.booking-box { background:#f0ebe3; border-radius:10px; padding:20px 24px; margin-bottom:24px; }
.booking-box h3 { font-size:0.85rem; color:#b8976a; letter-spacing:0.05em; margin-bottom:14px; }
table { width:100%; border-collapse:collapse; }
td { padding:8px 0; border-bottom:1px solid #e0d8cc; font-size:0.9rem; vertical-align:top; }
td:first-child { width:90px; color:#888; }
td:last-child { color:#1a3a3a; font-weight:600; }
tr:last-child td { border-bottom:none; }
.note { font-size:0.82rem; color:#999; line-height:1.8; margin-bottom:20px; }
.footer { background:#1a3a3a; padding:20px 32px; text-align:center; }
.footer p { color:#c8b89a; font-size:0.78rem; margin:0; }
</style></head>
<body><div class="wrap">
  <div class="header">
    <div class="logo">Na'au Noa</div>
    <p>〜 心と体のエネルギー整体 〜</p>
  </div>
  <div class="body">
    <p class="greeting">${name} 様<br><br>この度はNa'au Noaにご予約いただき、ありがとうございます。<br>以下の内容でご予約を承りました。</p>
    <div class="booking-box">
      <h3>▷ ご予約内容</h3>
      <table>
        <tr><td>日時</td><td>${dateLabel}<br>${startTime}〜${endTime}</td></tr>
        <tr><td>メニュー</td><td>${menu}</td></tr>
        <tr><td>お名前</td><td>${name} 様</td></tr>
      </table>
    </div>
    <p class="note">
      ご不明な点やご変更がございましたら、お気軽にご連絡ください。<br>
      当日のセッションを心よりお待ちしております。<br><br>
      ※ このメールは自動送信です。返信いただいても確認できない場合がございます。
    </p>
  </div>
  <div class="footer"><p>Na'au Noa | naau-noa.vercel.app</p></div>
</div></body></html>`;

  await Promise.allSettled([
    // 管理者通知
    transporter.sendMail({
      from: `"Na'au Noa 予約" <${user}>`,
      to: user,
      subject: `【予約通知】${name}様 ${dateLabel} ${startTime}〜`,
      html: adminHtml
    }),
    // お客様確認
    transporter.sendMail({
      from: `"Na'au Noa" <${user}>`,
      to: email,
      subject: `【Na'au Noa】ご予約を承りました（${dateLabel} ${startTime}〜）`,
      html: customerHtml
    })
  ]);
}

// ── 時間計算ヘルパー ──
function getRequiredTimes(startTimeStr, durationMins) {
  const slotsNeeded = Math.ceil(durationMins / 15);
  let [h, m] = startTimeStr.substring(0, 5).split(':').map(Number);
  const times = [];
  for (let i = 0; i < slotsNeeded; i++) {
    times.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
    m += 15;
    if (m >= 60) { m -= 60; h++; }
  }
  return times;
}

function calcEndTime(startTime, durationMins) {
  const [h, m] = startTime.substring(0, 5).split(':').map(Number);
  const total = h * 60 + m + durationMins;
  return `${String(Math.floor(total / 60)).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`;
}

// ── メインハンドラ ──
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { slotId, name, email, phone, menu, message, sourceUrl } = req.body;
    if (!slotId || !name || !email || !phone || !menu) return res.status(400).json({ error: '必須項目が不足しています' });

    // 対象スロットを確認
    const check = await supabase(`/rest/v1/slots?id=eq.${slotId}&is_available=eq.true&is_booked=eq.false`);
    if (!check.data || check.data.length === 0) return res.status(409).json({ error: 'この枠はすでに予約済みです' });

    const primarySlot = check.data[0];
    const { date, start_time } = primarySlot;

    // 連続枠チェック
    const duration = MENU_DURATIONS[menu] || 60;
    const requiredTimes = getRequiredTimes(start_time, duration);
    const dateSlots = await supabase(`/rest/v1/slots?date=eq.${date}&is_available=eq.true&is_booked=eq.false&order=start_time`);
    if (!dateSlots.data) throw new Error('スロット取得に失敗しました');

    const availableTimeSet = new Set(dateSlots.data.map(s => s.start_time.substring(0, 5)));
    for (const t of requiredTimes) {
      if (!availableTimeSet.has(t)) {
        return res.status(409).json({ error: `${t}の枠が確保できないため予約できません。別の時間をお選びください。` });
      }
    }

    // 予約を作成
    const booking = await supabase('/rest/v1/bookings', 'POST', { slot_id: slotId, name, email, phone, menu, message });
    if (booking.status !== 201) throw new Error('予約の保存に失敗しました');

    // 連続スロットを全て予約済みに
    const slotsToBook = dateSlots.data.filter(s => requiredTimes.includes(s.start_time.substring(0, 5)));
    const slotIds = slotsToBook.map(s => s.id);
    if (slotIds.length > 0) {
      await supabase(`/rest/v1/slots?id=in.(${slotIds.join(',')})`, 'PATCH', { is_booked: true });
    }

    // メール送信（失敗しても予約は成功扱い）
    const startTime = start_time.substring(0, 5);
    const endTime = calcEndTime(startTime, duration);
    try {
      await sendEmails({ name, email, phone, menu, date, startTime, endTime });
    } catch(e) {
      console.error('メール送信エラー:', e);
    }

    // Meta CAPI
    try { await sendCAPI({ name, email, phone, sourceUrl }); } catch(e) { console.error('CAPI:', e); }

    res.status(200).json({ success: true });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};
