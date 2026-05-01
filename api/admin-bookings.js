const https = require('https');

function supabase(path) {
  const url = new URL(process.env.SUPABASE_URL + path);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: { 'apikey': process.env.SUPABASE_SECRET_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SECRET_KEY}`, 'Content-Type': 'application/json' }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(d); } });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const crypto = require('crypto');
  const pw = req.headers['x-admin-password'];
  const hash = crypto.createHash('sha256').update(pw || '').digest('hex');
  if (hash !== 'ab467ac41fbad139ccb753f11c19a9ae457713f631e43932686096c380a14dd5') return res.status(401).json({ error: 'Unauthorized' });

  const data = await supabase('/rest/v1/bookings?select=*,slots(date,start_time)&order=created_at.desc');
  res.status(200).json(data);
};
