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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { name, q1, q2, q3 } = req.body;
    if (!name || !q1 || !q2 || !q3) return res.status(400).json({ error: '必須項目が不足しています' });

    const result = await supabase('/rest/v1/survey_responses', 'POST', { name, q1, q2, q3 });
    if (result.status !== 201) throw new Error('保存に失敗しました: ' + JSON.stringify(result.data));

    res.status(200).json({ success: true });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};
