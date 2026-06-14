import { readFileSync } from 'fs';
import { marked } from 'marked';
import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';

const FILES = [
  { src: 'deliverables/prompt-library.md',              out: 'deliverables/AI業務夥伴_Prompt庫50組.pdf' },
  { src: 'deliverables/followup-scripts.md',            out: 'deliverables/AI業務夥伴_話術模板10種.pdf' },
  { src: 'deliverables/tool-guide.md',                  out: 'deliverables/AI業務夥伴_工具操作說明書.pdf' },
  { src: 'deliverables/enterprise-report-template.md',  out: 'deliverables/AI業務夥伴_企業分析報告模板.pdf' },
];

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&display=swap');
  * { box-sizing: border-box; }
  body {
    font-family: 'Noto Sans TC', 'Microsoft JhengHei', Arial, sans-serif;
    max-width: 780px; margin: 0 auto; padding: 48px 40px;
    color: #1a1a1a; font-size: 14px; line-height: 1.8;
  }
  h1 {
    color: #1e3a8a; font-size: 22px; font-weight: 900;
    border-bottom: 3px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 24px;
  }
  h2 { color: #1e3a8a; font-size: 17px; font-weight: 700; margin-top: 36px; margin-bottom: 12px; }
  h3 { color: #374151; font-size: 15px; font-weight: 700; margin-top: 24px; margin-bottom: 8px; }
  h4 { color: #374151; font-size: 14px; font-weight: 600; margin-top: 16px; }
  p { margin: 8px 0 12px; }
  code {
    background: #f3f4f6; padding: 2px 7px; border-radius: 4px;
    font-size: 12px; font-family: Consolas, monospace; color: #1e3a8a;
  }
  pre {
    background: #f3f4f6; padding: 16px; border-radius: 8px;
    overflow-x: auto; margin: 12px 0;
  }
  pre code { background: none; padding: 0; color: #374151; font-size: 12.5px; line-height: 1.6; }
  table { border-collapse: collapse; width: 100%; margin: 14px 0; font-size: 13px; }
  th { background: #1e3a8a; color: white; padding: 9px 13px; text-align: left; font-weight: 600; }
  td { padding: 7px 13px; border: 1px solid #e5e7eb; vertical-align: top; }
  tr:nth-child(even) td { background: #f9fafb; }
  blockquote {
    border-left: 4px solid #2563eb; margin: 12px 0; padding: 10px 16px;
    background: #eff6ff; border-radius: 0 6px 6px 0;
  }
  blockquote p { margin: 4px 0; color: #1e40af; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 28px 0; }
  ul, ol { padding-left: 22px; margin: 8px 0 12px; }
  li { margin: 4px 0; }
  strong { color: #111827; font-weight: 700; }
  a { color: #2563eb; text-decoration: none; }
  .footer {
    margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb;
    font-size: 11px; color: #9ca3af; text-align: center;
  }
`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

for (const { src, out } of FILES) {
  process.stdout.write(`生成 ${out} ...`);
  const md   = readFileSync(src, 'utf8');
  const body = marked(md);
  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&display=swap" rel="stylesheet">
  <style>${CSS}</style>
</head>
<body>
  ${body}
  <div class="footer">AI 業務夥伴 · Justin · LINE: @686czwde</div>
</body>
</html>`;

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.pdf({
    path: out,
    format: 'A4',
    margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
    printBackground: true,
  });
  await page.close();
  console.log(' ✅');
}

await browser.close();
console.log('\n全部完成！PDF 在 deliverables/ 資料夾裡。');
