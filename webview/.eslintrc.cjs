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
  plugins: ['@typescript-eslint'],
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'error'
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  }
};
