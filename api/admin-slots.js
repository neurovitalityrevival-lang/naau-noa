const https = require('https');

function supabase(path, method = 'GET', body = null) {
  const url = new URL(process.env.SUPABASE_URL + path);
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'apikey': process.env.SUPABASE_SECRET_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SECRET_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };
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
  if (pw !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });

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
    const { date, times } = req.body;
    if (!date || !times?.length) return res.status(400).json({ error: 'date and times required' });
    const slots = times.map(t => ({ date, start_time: t, is_available: true, is_booked: false }));
    const r = await supabase('/rest/v1/slots', 'POST', slots);
    return res.status(200).json(r.data);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });
    await supabase(`/rest/v1/slots?id=eq.${id}&is_booked=eq.false`, 'DELETE');
    return res.status(200).json({ success: true });
  }

  res.status(405).end();
};
