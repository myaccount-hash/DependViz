'use strict';

const fs = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.join(__dirname, '../template.html');
const BUNDLE_PATH = path.join(__dirname, '../dist/bundle.js');
const OUTPUT_PATH = path.join(__dirname, '../dist/index.html');

function buildHtml() {
  if (!fs.existsSync(BUNDLE_PATH)) {
    throw new Error('Webview bundle not found. Run webpack before generating HTML.');
  }

  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const bundle = fs.readFileSync(BUNDLE_PATH);
  const base64Bundle = bundle.toString('base64');
  const loaderScript = `
    (function() {
      const base64 = '${base64Bundle}';
      const binary = window.atob(base64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      const script = document.createElement('script');
      script.type = 'module';
      script.src = url;
      script.onload = () => URL.revokeObjectURL(url);
      document.head.appendChild(script);
    })();
  `;

  const content = template.replace(/{{script}}/g, loaderScript);

  fs.writeFileSync(OUTPUT_PATH, content, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`Webview HTML built -> ${OUTPUT_PATH}`);
}

buildHtml();
