const https = require('https');

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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const pw = req.headers['x-admin-password'];
  if (pw !== 'taisyo1023') return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const { year, month } = req.query;
    let q = '/rest/v1/slots?order=date,start_time';
    if (year && month) {
      const y = parseInt(year), m = parseInt(month);
      const start = `${y}-${String(m).padStart(2,'0')}-01`;
      const nm = m === 12 ? 1 : m + 1;
      const ny = m === 12 ? y + 1 : y;
      const end = `${ny}-${String(nm).padStart(2,'0')}-01`;
      q += `&date=gte.${start}&date=lt.${end}`;
    }
    const r = await supabase(q);
    return res.status(200).json(r.data);
  }

  if (req.method === 'POST') {
    const { date, times, blocked } = req.body;
    if (!date || !times?.length) return res.status(400).json({ error: 'date and times required' });
    // blocked=true のときは手動ブロック枠（赤）として追加
    const slots = times.map(t => ({
      date,
      start_time: t,
      is_available: blocked ? false : true,
      is_booked: blocked ? true : false
    }));
    const r = await supabase('/rest/v1/slots', 'POST', slots);
    return res.status(200).json(r.data);
  }

  if (req.method === 'DELETE') {
    const { id, ids, force } = req.query;
    const isForce = force === 'true';

    // 一括削除（force=true なら予約済みも含む）
    if (ids) {
      const idList = ids.split(',').filter(Boolean);
      if (!idList.length) return res.status(400).json({ error: 'ids is empty' });
      const q = isForce
        ? `/rest/v1/slots?id=in.(${idList.join(',')})`
        : `/rest/v1/slots?id=in.(${idList.join(',')})&is_booked=eq.false`;
      await supabase(q, 'DELETE');
      return res.status(200).json({ success: true });
    }

    // 個別削除（force=true なら予約済みも削除可）
    if (id) {
      const q = force === 'true'
        ? `/rest/v1/slots?id=eq.${id}`
        : `/rest/v1/slots?id=eq.${id}&is_booked=eq.false`;
      await supabase(q, 'DELETE');
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'id or ids required' });
  }

  res.status(405).end();
};
