const fs = require('fs');
const path = require('path');

const BLOG_DIR = __dirname;
const DRAFTS_DIR = path.join(BLOG_DIR, '_drafts');

// 今日の日付（JST）
const now = new Date();
const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
const today = jst.toISOString().split('T')[0];
console.log(`今日の日付(JST): ${today}`);

function parseJapaneseDate(str) {
  const m = str.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
}

function extractFromHtml(content) {
  const titleMatch = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const dateMatch  = content.match(/class="meta"[^>]*>([\s\S]*?)<\/p>/);
  const leadMatch  = content.match(/class="lead"[^>]*>([\s\S]*?)<\/p>/);
  return {
    title:   titleMatch ? titleMatch[1].trim() : '',
    dateStr: dateMatch  ? dateMatch[1].trim()  : '',
    lead:    leadMatch  ? leadMatch[1].trim()   : ''
  };
}

const allPosts = [];
const seen = new Set();

// 公開済み記事を読み込む
const publishedFiles = fs.readdirSync(BLOG_DIR)
  .filter(f => /^post\d+\.html$/.test(f))
  .sort();

for (const file of publishedFiles) {
  const content = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8');
  const { title, dateStr, lead } = extractFromHtml(content);
  const date = parseJapaneseDate(dateStr);
  if (date && !seen.has(file)) {
    allPosts.push({ file, date, dateStr, title, lead });
    seen.add(file);
  }
}

// ドラフトから今日以前の記事を公開
const draftFiles = fs.readdirSync(DRAFTS_DIR)
  .filter(f => /^post\d+\.html$/.test(f))
  .sort();

for (const file of draftFiles) {
  const content = fs.readFileSync(path.join(DRAFTS_DIR, file), 'utf8');
  const { title, dateStr, lead } = extractFromHtml(content);
  const date = parseJapaneseDate(dateStr);
  if (!date) continue;

  if (date <= today && !seen.has(file)) {
    fs.copyFileSync(path.join(DRAFTS_DIR, file), path.join(BLOG_DIR, file));
    console.log(`公開: ${file} (${dateStr})`);
    allPosts.push({ file, date, dateStr, title, lead });
    seen.add(file);
  }
}

// 新しい順にソート
allPosts.sort((a, b) => b.date.localeCompare(a.date));

// index.html を生成
const cards = allPosts.map(({ file, dateStr, title, lead }) => {
  const shortLead = lead.length > 90 ? lead.substring(0, 90) + '…' : lead;
  return `
  <a href="${file}" class="blog-card">
    <div class="date">${dateStr}</div>
    <h2>${title}</h2>
    <p>${shortLead}</p>
  </a>`;
}).join('\n');

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ブログ | Na'au Noa</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;600&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Noto Serif JP', serif; background: #faf8f5; color: #2c2c2c; }
header { text-align: center; padding: 80px 24px 40px; border-bottom: 1px solid #e0d8cc; }
header h1 { font-size: 2rem; color: #1a3a3a; font-style: italic; }
header p { color: #888; margin-top: 8px; font-style: italic; }
.blog-list { max-width: 760px; margin: 60px auto; padding: 0 24px; }
.blog-card { display: block; text-decoration: none; color: inherit; border-bottom: 1px solid #e0d8cc; padding: 32px 0; transition: opacity 0.2s; }
.blog-card:hover { opacity: 0.7; }
.blog-card .date { font-size: 0.85rem; color: #b8976a; font-style: italic; margin-bottom: 8px; }
.blog-card h2 { font-size: 1.2rem; color: #1a3a3a; line-height: 1.6; margin-bottom: 12px; }
.blog-card p { font-size: 0.95rem; color: #666; line-height: 1.8; font-style: italic; }
.back-link { display: inline-block; margin: 40px 24px; color: #b8976a; text-decoration: none; font-style: italic; }
</style>
</head>
<body>
<a href="../index.html" class="back-link">← トップページへ</a>
<header>
  <h1>*Blog*</h1>
  <p>心と身体と、本当の自分へ。</p>
</header>
<div class="blog-list">
${cards}
</div>
</body>
</html>`;

fs.writeFileSync(path.join(BLOG_DIR, 'index.html'), html);
console.log(`index.html 更新完了 (${allPosts.length}件)`);
