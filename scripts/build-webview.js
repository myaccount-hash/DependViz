'use strict';

const fs = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.join(__dirname, '../webview/template.html');
const OUTPUT_PATH = path.join(__dirname, '../webview/dist/webview.html');
const SRC_DIR = path.join(__dirname, '../webview/src');

const SCRIPT_FILES = [
  'core.js',
  'graphState.js',
  'filters.js',
  'GraphRenderer.js',
  'GraphRenderer2D.js',
  'GraphRenderer3D.js',
  'init.js'
];

function buildWebview() {
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const script = SCRIPT_FILES
    .map(file => fs.readFileSync(path.join(SRC_DIR, file), 'utf8'))
    .join('\n\n');

  const wrappedScript = `(function(DEFAULT_CONTROLS, COLORS, DEBUG) {\n${script}\n})(DEFAULT_CONTROLS, COLORS, DEBUG);`;
  const result = template.replace(/{{script}}/g, wrappedScript);

  const outputDir = path.dirname(OUTPUT_PATH);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, result, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`Webview template built -> ${OUTPUT_PATH}`);
}

buildWebview();
