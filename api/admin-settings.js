const https = require('https');

function supabase(path, method = 'GET', body = null, extraHeaders = {}) {
  const url = new URL('https://quacqiugfcwdqxzutqpq.supabase.co' + path);
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = {
      'apikey': 'sb_publishable_eyMShPrkyDZvtSejJDx9HA_UgMsRwJI',
      'Authorization': `Bearer sb_publishable_eyMShPrkyDZvtSejJDx9HA_UgMsRwJI`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...extraHeaders
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

const DEFAULTS = {
  daily_capacity_mins: 180
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const pw = req.headers['x-admin-password'];
  if (pw !== 'taisyo1023') return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    try {
      const r = await supabase('/rest/v1/admin_settings');
      if (!Array.isArray(r.data)) {
        return res.status(200).json({ ...DEFAULTS, _tableReady: false });
      }
      const result = { ...DEFAULTS, _tableReady: true };
      r.data.forEach(row => {
        if (row.key === 'daily_capacity_mins') result.daily_capacity_mins = parseInt(row.value) || DEFAULTS.daily_capacity_mins;
      });
      return res.status(200).json(result);
    } catch(e) {
      console.error('admin-settings GET error:', e.message);
      return res.status(200).json({ ...DEFAULTS, _tableReady: false });
    }
  }

  if (req.method === 'POST') {
    const { key, value } = req.body || {};
    if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' });
    try {
      // Try upsert via merge-duplicates
      const r = await supabase(
        '/rest/v1/admin_settings',
        'POST',
        { key, value: String(value) },
        { 'Prefer': 'resolution=merge-duplicates,return=representation' }
      );
      if (r.status >= 400) {
        console.error('admin-settings upsert failed:', r.status, JSON.stringify(r.data));
        return res.status(500).json({ error: 'テーブルが存在しない可能性があります。Supabase でテーブルを作成してください。', _tableReady: false });
      }
      return res.status(200).json({ success: true });
    } catch(e) {
      console.error('admin-settings POST error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
};
