const https = require('https');
const crypto = require('crypto');

function hashData(d) {
  return d ? crypto.createHash('sha256').update(d.trim().toLowerCase()).digest('hex') : null;
}

function supabase(path, method = 'GET', body = null) {
  const url = new URL(process.env.SUPABASE_URL + path);
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = {
      'apikey': process.env.SUPABASE_SECRET_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, data: d }); }
      });
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
  if (name) {
    const p = name.trim().split(/\s+/);
    ud.fn = [hashData(p[0])];
    if (p.length > 1) ud.ln = [hashData(p[p.length-1])];
  }
  const pd = JSON.stringify({ data: [{ event_name: 'Schedule', event_time: Math.floor(Date.now()/1000), event_id: `sch_${Date.now()}`, action_source: 'website', event_source_url: sourceUrl || 'https://naau-noa.netlify.app/booking.html', user_data: ud, custom_data: { content_name: '無料オンライン個別相談予約' } }] });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'graph.facebook.com',
      path: `/v19.0/${PID}/events?access_token=${AT}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(pd) }
    }, (res) => { let d=''; res.on('data', c=>d+=c); res.on('end', ()=>{ console.log('CAPI:', d); resolve(d); }); });
    req.on('error', reject);
    req.write(pd);
    req.end();
  });
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { slotId, name, email, phone, menu, message, sourceUrl } = JSON.parse(event.body);
    if (!slotId || !name || !email || !phone || !menu) {
      return { statusCode: 400, body: JSON.stringify({ error: '必須項目が不足しています' }) };
    }

    const check = await supabase(`/rest/v1/slots?id=eq.${slotId}&is_available=eq.true&is_booked=eq.false`);
    if (!check.data || check.data.length === 0) {
      return { statusCode: 409, body: JSON.stringify({ error: 'この枠はすでに予約済みです' }) };
    }

    const booking = await supabase('/rest/v1/bookings', 'POST', { slot_id: slotId, name, email, phone, menu, message });
    if (booking.status !== 201) throw new Error('予約の保存に失敗しました');

    await supabase(`/rest/v1/slots?id=eq.${slotId}`, 'PATCH', { is_booked: true });

    try { await sendCAPI({ name, email, phone, sourceUrl }); } catch(e) { console.error('CAPI:', e); }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };
  } catch(e) {
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
