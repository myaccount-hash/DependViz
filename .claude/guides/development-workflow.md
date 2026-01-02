# 開発ワークフロー - DependViz

このドキュメントはDependVizの開発ワークフロー、ビルド、デバッグ、テストについて説明する.

## 初期セットアップ

1. 依存関係のインストール:
   ```bash
   npm install
   ```

2. Java Language Serverのビルド:
   ```bash
   npm run build:java
   ```

3. Webviewのビルド:
   ```bash
   npm run build:webview
   ```

4. すべてビルド:
   ```bash
   npm run build
   ```

## 開発反復

### 1. 拡張機能の変更 (`src/`)
- VS CodeでF5を押してExtension Development Hostを起動
- 変更には拡張機能ホストウィンドウのリロードが必要

### 2. Webviewの変更 (`webview/src/`)
- `npm run build:webview`を実行して再ビルド
- VS Codeで"Developer: Reload Webviews"コマンドを実行
- またはExtension Development Hostをリロード

### 3. Java LSPの変更 (`java/src/`)
- `npm run build:java`を実行してJARを再ビルド
- 拡張機能を再起動(Extension Development Hostをリロード)
- "DependViz Java Language Server"出力チャネルでログを確認

## テスト

### 拡張機能のテスト
- Extension Development Hostを起動(F5)
- JavaまたはJavaScriptプロジェクトを開く
- コマンドを使用:
  - "DependViz: Analyze Project"
  - "DependViz: Refresh"

### 手動テストチェックリスト
- [ ] グラフが2Dモードで正しく表示される
- [ ] グラフが3Dモードで正しく表示される
- [ ] ノードクリックでファイルが開く
- [ ] フィルタが動作する(ノード/エッジタイプ)
- [ ] 検索がノードをハイライトする
- [ ] スライスハイライトが動作する(前方/後方)
- [ ] 設定がグラフをリアルタイムで更新する
- [ ] アクティブエディタ同期が動作する

## デバッグ

### 拡張機能
- `src/`ファイルにブレークポイントを設定
- F5で起動
- デバッグコンソールを確認

### Webview
- Webview Developer Toolsを開く:
  - コマンド実行: "Developer: Open Webview Developer Tools"
- webview DevToolsでコンソールログが表示される
- ネットワークタブで拡張機能 ↔ webviewメッセージが表示される

### Java LSP
- "DependViz Java Language Server"出力チャネルを確認
- ログは`logging.properties`経由で設定
- ステージにデバッグログを追加:
  ```java
  System.err.println("Debug: " + message);
  ```

## リント

```bash
# 拡張機能コードをリント
npm run lint:extension

# Webviewコードをリント
npm run lint:webview

# すべてリント
npm run lint

# 自動修正
npm run lint:fix
```

## ビルドスクリプト

### npm scripts
- `npm run build`: すべてビルド (webview + java)
- `npm run build:webview`: Webviewのみビルド
- `npm run build:java`: Java LSPサーバのみビルド
- `npm run lint`: すべてリント
- `npm run lint:extension`: 拡張機能コードをリント
- `npm run lint:webview`: Webviewコードをリント
- `npm run lint:fix`: リント自動修正

## 次のステップ

- [設定リファレンス](../reference/configuration.md) - 拡張機能の設定詳細
- [一般的なタスク](../troubleshooting/common-tasks.md) - 実装パターン
- [既知の問題](../troubleshooting/known-issues.md) - トラブルシューティング

---

[← コーディング規約](coding-guidelines.md) | [ガイド一覧 →](README.md)
