const https = require('https');
const nodemailer = require('nodemailer');

const SUPABASE_URL = 'https://quacqiugfcwdqxzutqpq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_eyMShPrkyDZvtSejJDx9HA_UgMsRwJI';

function supabase(path, method = 'GET', body = null) {
  const url = new URL(SUPABASE_URL + path);
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(
      { hostname: url.hostname, path: url.pathname + url.search, method, headers },
      (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
          catch(e) { resolve({ status: res.statusCode, data: d }); }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function sendEmails({ name, email, phone, address, agreedAt }) {
  const gmailUser = process.env.GMAIL_USER || 'neuro.vitality.revival@gmail.com';
  const gmailPass = process.env.GMAIL_APP_PASSWORD || 'hpjhneugdbybxplq';
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPass },
  });

  const dateStr = new Date(agreedAt).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  // ── クライアント宛 ──
  transporter.sendMail({
    from: `"Na'au Noa BODY detox" <${gmailUser}>`,
    to: email,
    subject: '【Na\'au Noa】ライフデトックスプログラム 契約書への電子署名を受け付けました',
    html: `
      <div style="font-family:'Noto Serif JP',serif;max-width:600px;margin:0 auto;background:#faf8f5;border-radius:12px;overflow:hidden;">
        <div style="background:#1a3a3a;padding:28px 32px;text-align:center;">
          <p style="color:#b8976a;font-size:1.2rem;letter-spacing:0.1em;margin:0;">Na'au Noa BODY detox</p>
        </div>
        <div style="padding:32px;">
          <h2 style="color:#1a3a3a;font-size:1.1rem;margin-bottom:20px;">電子署名を受け付けました</h2>
          <p style="color:#555;line-height:1.9;">${name} 様</p>
          <p style="color:#555;line-height:1.9;">ライフデトックスプログラム個別コーチング契約書への電子署名が完了しました。</p>
          <div style="background:#f0ebe3;border-radius:8px;padding:18px 22px;margin:20px 0;font-size:0.9rem;color:#1a3a3a;line-height:2;">
            <strong>署名日時：</strong>${dateStr}<br>
            <strong>お名前：</strong>${name}<br>
            <strong>メール：</strong>${email}<br>
            <strong>電話番号：</strong>${phone}
          </div>
          <p style="color:#555;line-height:1.9;">本メールが契約締結の証明となります。大切に保管してください。</p>
          <p style="color:#555;line-height:1.9;">ご不明な点がございましたら、お気軽にご連絡ください。</p>
          <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e0d8cc;color:#888;font-size:0.82rem;line-height:1.8;">
            Na'au Noa BODY detox　代表 小松 大将<br>
            神奈川県茅ヶ崎市中海岸1-1-46<br>
            TEL: 070-9197-4336
          </div>
        </div>
      </div>
    `,
  }).catch(() => {});

  // ── 小松さん宛通知 ──
  transporter.sendMail({
    from: `"Na'au Noa System" <${gmailUser}>`,
    to: gmailUser,
    subject: `【契約署名通知】${name} 様が署名しました`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#1a3a3a;">新しい契約署名が届きました</h2>
        <table style="border-collapse:collapse;width:100%;font-size:0.9rem;">
          <tr><td style="padding:10px;background:#f0ebe3;font-weight:bold;width:30%;">署名日時</td><td style="padding:10px;border-bottom:1px solid #eee;">${dateStr}</td></tr>
          <tr><td style="padding:10px;background:#f0ebe3;font-weight:bold;">お名前</td><td style="padding:10px;border-bottom:1px solid #eee;">${name}</td></tr>
          <tr><td style="padding:10px;background:#f0ebe3;font-weight:bold;">メール</td><td style="padding:10px;border-bottom:1px solid #eee;"><a href="mailto:${email}">${email}</a></td></tr>
          <tr><td style="padding:10px;background:#f0ebe3;font-weight:bold;">電話番号</td><td style="padding:10px;border-bottom:1px solid #eee;">${phone}</td></tr>
          <tr><td style="padding:10px;background:#f0ebe3;font-weight:bold;">ご住所</td><td style="padding:10px;border-bottom:1px solid #eee;">${address}</td></tr>
        </table>
        <p style="margin-top:16px;color:#555;">管理画面で詳細・署名画像をご確認いただけます。</p>
      </div>
    `,
  }).catch(() => {});
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { name, address, phone, email, signatureData, agreedAt } = req.body || {};

  if (!name || !email || !signatureData) {
    return res.status(400).json({ error: '必須項目が不足しています' });
  }

  const clientIp =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';

  // Supabase に保存
  const result = await supabase('/rest/v1/contract_signatures', 'POST', {
    name,
    address: address || '',
    phone: phone || '',
    email,
    signature_data: signatureData,
    agreed_at: agreedAt || new Date().toISOString(),
    ip_address: clientIp,
    user_agent: userAgent,
  });

  if (result.status !== 201) {
    console.error('Supabase error:', result.data);
    return res.status(500).json({ error: 'データの保存に失敗しました' });
  }

  // メール送信（fire and forget）
  sendEmails({ name, email, phone, address, agreedAt }).catch(() => {});

  return res.status(200).json({ success: true });
};
