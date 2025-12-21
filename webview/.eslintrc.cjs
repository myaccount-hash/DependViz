module.exports = {
  env: {
    browser: true,
    es2021: true
  },
  extends: ['eslint:recommended'],
  globals: {
    acquireVsCodeApi: 'readonly'
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  }
};
