/**
 * assets/attrs/*.png から WebP を再生成する。
 * 要: cwebp（libwebp）が PATH にあること。
 * 使い方: npm run build:attr-webp
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ATTR_DIR = path.join(__dirname, '..', 'assets', 'attrs');
const QUALITY = '82';

function main() {
  if (!fs.existsSync(ATTR_DIR)) {
    console.error('missing dir:', ATTR_DIR);
    process.exit(1);
  }
  const pngs = fs.readdirSync(ATTR_DIR).filter((f) => /\.png$/i.test(f));
  if (!pngs.length) {
    console.error('no PNG files in', ATTR_DIR);
    process.exit(1);
  }
  const probe = spawnSync('cwebp', ['-version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    console.error('cwebp が見つかりません。libwebp を入れたうえで再実行してください。');
    process.exit(1);
  }
  for (const name of pngs) {
    const src = path.join(ATTR_DIR, name);
    const dest = path.join(ATTR_DIR, name.replace(/\.png$/i, '.webp'));
    const r = spawnSync('cwebp', ['-q', QUALITY, '-m', '6', src, '-o', dest], {
      encoding: 'utf8'
    });
    if (r.status !== 0) {
      console.error('failed:', name, r.stderr || r.stdout);
      process.exit(1);
    }
    const from = fs.statSync(src).size;
    const to = fs.statSync(dest).size;
    console.log(`${name}  ${from} -> ${path.basename(dest)} ${to} bytes`);
  }
}

main();
