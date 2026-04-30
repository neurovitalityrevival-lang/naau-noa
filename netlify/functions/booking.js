const https = require('https');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

function hashData(data) {
  if (!data) return null;
  return crypto.createHash('sha256').update(data.trim().toLowerCase()).digest('hex');
}

async function sendEmail(bookingData) {
  const { name, email, phone, date, time, menu, message } = bookingData;
  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
  const dateStr = date ? new Date(date + 'T00:00:00').toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }) : date;
  await transporter.sendMail({
    from: `Na'au Noa予約システム <${process.env.GMAIL_USER}>`,
    to: process.env.NOTIFY_EMAIL || process.env.GMAIL_USER,
    subject: `【Na'au Noa】新規予約 - ${name}様（${dateStr} ${time}〜）`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;"><div style="background:#1a3a3a;padding:24px;text-align:center;"><h1 style="color:#b8976a;font-size:1.2rem;margin:0;">Na'au Noa 新規予約通知</h1></div><div style="padding:32px 24px;background:#fff;"><table style="width:100%;border-collapse:collapse;"><tr style="border-bottom:1px solid #eee;"><td style="padding:12px 8px;color:#888;width:35%;">お名前</td><td style="padding:12px 8px;font-weight:bold;">${name}</td></tr><tr style="border-bottom:1px solid #eee;"><td style="padding:12px 8px;color:#888;">メール</td><td style="padding:12px 8px;">${email}</td></tr><tr style="border-bottom:1px solid #eee;"><td style="padding:12px 8px;color:#888;">電話番号</td><td style="padding:12px 8px;">${phone}</td></tr><tr style="border-bottom:1px solid #eee;"><td style="padding:12px 8px;color:#888;">希望日</td><td style="padding:12px 8px;font-weight:bold;">${dateStr}</td></tr><tr style="border-bottom:1px solid #eee;"><td style="padding:12px 8px;color:#888;">希望時間</td><td style="padding:12px 8px;font-weight:bold;">${time}〜</td></tr><tr style="border-bottom:1px solid #eee;"><td style="padding:12px 8px;color:#888;">メニュー</td><td style="padding:12px 8px;">${menu}</td></tr><tr><td style="padding:12px 8px;color:#888;vertical-align:top;">お悩み</td><td style="padding:12px 8px;line-height:1.8;">${message||'（記載なし）'}</td></tr></table></div><div style="background:#f0ebe3;padding:16px 24px;text-align:center;"><p style="color:#888;font-size:0.85rem;">24時間以内にお客様へご連絡ください</p></div></div>`
  });
}

async function sendCAPI(bookingData) {
  const PIXEL_ID = process.env.META_PIXEL_ID;
  const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
  if (!PIXEL_ID || !ACCESS_TOKEN) return;
  const { name, email, phone, sourceUrl } = bookingData;
  const userData = {};
  if (email) userData.em = [hashData(email)];
  if (phone) userData.ph = [hashData(phone.replace(/\D/g, ''))];
  if (name) { const p = name.trim().split(/\s+/); userData.fn = [hashData(p[0])]; if (p.length > 1) userData.ln = [hashData(p[p.length-1])]; }
  const postData = JSON.stringify({ data: [{ event_name: 'Schedule', event_time: Math.floor(Date.now()/1000), event_id: `schedule_${Date.now()}_${Math.random().toString(36).substr(2,9)}`, action_source: 'website', event_source_url: sourceUrl || 'https://naau-noa.netlify.app/booking.html', user_data: userData, custom_data: { content_name: '無料オンライン個別相談予約', content_category: 'wellness_booking' } }] });
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'graph.facebook.com', path: `/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) } }, (res) => { let d=''; res.on('data', c => d+=c); res.on('end', () => { console.log('CAPI:', d); resolve(d); }); });
    req.on('error', reject); req.write(postData); req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const body = JSON.parse(event.body);
    await sendEmail(body);
    try { await sendCAPI(body); } catch(e) { console.error('CAPI error:', e); }
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error('Booking error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
