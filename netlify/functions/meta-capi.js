const https = require('https');
const crypto = require('crypto');

function hashData(data) {
  if (!data) return null;
  return crypto.createHash('sha256').update(data.trim().toLowerCase()).digest('hex');
}

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const PIXEL_ID = process.env.META_PIXEL_ID;
  const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

  if (!PIXEL_ID || !ACCESS_TOKEN) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing environment variables' }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { name, email, phone, message, sourceUrl } = body;

    const userData = {};
    if (email) userData.em = [hashData(email)];
    if (phone) userData.ph = [hashData(phone.replace(/\D/g, ''))];
    if (name) {
      const parts = name.trim().split(/\s+/);
      userData.fn = [hashData(parts[0])];
      if (parts.length > 1) userData.ln = [hashData(parts[parts.length - 1])];
    }

    const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || '';
    if (ip) userData.client_ip_address = ip.split(',')[0].trim();

    const ua = event.headers['user-agent'] || '';
    if (ua) userData.client_user_agent = ua;

    const eventData = {
      data: [{
        event_name: 'Lead',
        event_time: Math.floor(Date.now() / 1000),
        event_id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        action_source: 'website',
        event_source_url: sourceUrl || 'https://naau-noa.netlify.app',
        user_data: userData,
        custom_data: {
          content_name: '無料オンライン個別相談',
          content_category: 'wellness_consultation'
        }
      }]
    };

    const postData = JSON.stringify(eventData);

    const response = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'graph.facebook.com',
        path: `/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    console.log('Meta CAPI response:', response.body);

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    console.error('CAPI Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
