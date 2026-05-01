const https = require('https');
const crypto = require('crypto');

// メニューごとの所要時間（分）
const MENU_DURATIONS = {
  '《新規限定》オンライン無料個別相談': 60,
  '《新規10:00~17:00限定》AET自律神経整体付き個別相談（60分）4980円': 60,
  '《10:00~17:00限定》AETエネルギー整体（90分）33,000円': 90,
  '《2回目以降》オンラインリリースワーク（90分）33,000円': 90
};

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

// 時間文字列から分を計算
function timeToMins(t) {
  const [h, m] = t.substring(0, 5).split(':').map(Number);
  return h * 60 + m;
}

// 開始時間から必要な連続時間スロット一覧を生成
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

    // メニューの所要時間を取得
    const duration = MENU_DURATIONS[menu] || 60;
    const requiredTimes = getRequiredTimes(start_time, duration);

    // この日の空き枠を全取得して連続確保チェック
    const dateSlots = await supabase(`/rest/v1/slots?date=eq.${date}&is_available=eq.true&is_booked=eq.false&order=start_time`);
    if (!dateSlots.data) throw new Error('スロット取得に失敗しました');

    const availableTimeSet = new Set(dateSlots.data.map(s => s.start_time.substring(0, 5)));
    for (const t of requiredTimes) {
      if (!availableTimeSet.has(t)) {
        return res.status(409).json({ error: `${t}の枠が確保できないため予約できません。お手数ですが別の時間をお選びください。` });
      }
    }

    // 予約を作成
    const booking = await supabase('/rest/v1/bookings', 'POST', { slot_id: slotId, name, email, phone, menu, message });
    if (booking.status !== 201) throw new Error('予約の保存に失敗しました');

    // 連続する全スロットをまとめて予約済みにする
    const slotsToBook = dateSlots.data.filter(s => requiredTimes.includes(s.start_time.substring(0, 5)));
    const slotIds = slotsToBook.map(s => s.id);
    if (slotIds.length > 0) {
      await supabase(`/rest/v1/slots?id=in.(${slotIds.join(',')})`, 'PATCH', { is_booked: true });
    }

    try { await sendCAPI({ name, email, phone, sourceUrl }); } catch(e) { console.error('CAPI:', e); }
    res.status(200).json({ success: true });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};
