const https = require('https');

function supabase(path) {
  const url = new URL('https://quacqiugfcwdqxzutqpq.supabase.co' + path);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'apikey': 'sb_publishable_eyMShPrkyDZvtSejJDx9HA_UgMsRwJI',
        'Authorization': `Bearer sb_publishable_eyMShPrkyDZvtSejJDx9HA_UgMsRwJI`,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { resolve(d); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { year, month } = req.query;
  if (!year || !month) return res.status(400).json({ error: 'year and month required' });

  const y = parseInt(year), m = parseInt(month);
  const start = `${y}-${String(m).padStart(2,'0')}-01`;
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  const end = `${ny}-${String(nm).padStart(2,'0')}-01`;

  // 利用可能枠を取得
  const [availableData, bookedData, settingData] = await Promise.all([
    supabase(`/rest/v1/slots?date=gte.${start}&date=lt.${end}&is_available=eq.true&is_booked=eq.false&order=date,start_time`),
    supabase(`/rest/v1/slots?date=gte.${start}&date=lt.${end}&is_booked=eq.true`),
    supabase(`/rest/v1/admin_settings?key=eq.daily_capacity_mins`).catch(() => null)
  ]);

  // 1日あたりの上限（分）を取得（デフォルト180分）
  let dailyCapacityMins = 180;
  if (Array.isArray(settingData) && settingData.length > 0) {
    dailyCapacityMins = parseInt(settingData[0].value) || 180;
  }

  // 22:00以降を除外
  const available = Array.isArray(availableData)
    ? availableData.filter(s => s.start_time.substring(0, 5) < '22:00')
    : [];

  // 日ごとの予約済み分数を計算
  const bookedMinsPerDay = {};
  if (Array.isArray(bookedData)) {
    bookedData.forEach(s => {
      bookedMinsPerDay[s.date] = (bookedMinsPerDay[s.date] || 0) + 15;
    });
  }

  // 満枠（上限以上）の日の枠を非表示にする
  const filtered = available.filter(s => {
    const bookedMins = bookedMinsPerDay[s.date] || 0;
    return bookedMins < dailyCapacityMins;
  });

  res.status(200).json(filtered);
};
