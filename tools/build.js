#!/usr/bin/env node
/* Production build: inlines CSS and JS into one dist/index.html and zips it for upload.
 *   node tools/build.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let html = read('index.html');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => '<style>\n' + read(href) + '</style>');
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, src) => '<script>\n' + read(src).replace(/<\/script/gi, '<\\/script') + '</script>');

if (/href="css\/|src="js\//.test(html)) throw new Error('an asset was not inlined');

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, 'index.html'), html);

const zip = path.join(DIST, 'pocket-singularity.zip');
if (fs.existsSync(zip)) fs.unlinkSync(zip);
try {
  execFileSync('zip', ['-q', '-9', zip, 'index.html'], { cwd: DIST });
} catch (e) {
  console.warn('zip not available; upload dist/index.html directly');
}

const kb = (f) => (fs.statSync(f).size / 1024).toFixed(1) + ' KB';
console.log('dist/index.html', kb(path.join(DIST, 'index.html')));
if (fs.existsSync(zip)) console.log('dist/pocket-singularity.zip', kb(zip));
