# 既知の問題 - DependViz

このドキュメントは現在の制限、改善が必要な領域、トラブルシューティングガイドを提供する.

## 既知の問題

改善が必要な領域:

### 1. エラーハンドリング
コードベース全体で例外処理が一貫していない
- 一部のエラーは黙って飲み込まれる
- エラーメッセージはよりユーザフレンドリーにできる
- バグ修正時は適切な箇所でエラーハンドリングを改善

**関連**: [コーディング規約 - エラーハンドリング](../guides/coding-guidelines.md#エラーハンドリング)

### 2. テスト
単体テストカバレッジが限定的
- ほとんどのテストは手動
- 新機能追加時は手動テストで許容される
- 明示的に要求されない限りテストを作成しない

**関連**: [開発ワークフロー - テスト](../guides/development-workflow.md#テスト)

## トラブルシューティング

### グラフが表示されない

**症状**: Webviewが空白または何も表示されない

**チェック項目**:
1. Webviewコンソールでエラーを確認
2. 拡張機能 → Webviewメッセージが送信されているか確認
3. グラフデータが空でないか確認
4. レンダリングコンテキストが正しく初期化されているか確認

**解決方法**:
- Webviewをリロード: Developer: Reload Webviews
- グラフを再解析: DependViz: Refresh

### Java LSPが起動しない

**症状**: Java解析が動作しない、エラーメッセージが表示される

**チェック項目**:
1. "DependViz Java Language Server"出力チャネルを確認
2. JARファイルが存在するか確認: `java/target/dependviz-lsp-1.0.0-jar-with-dependencies.jar`
3. Java 21以上がインストールされているか確認
4. `npm run build:java`でJARを再ビルド

**解決方法**:
```bash
# JARを再ビルド
npm run build:java

# 拡張機能を再起動
# VS CodeでReload Windowを実行
```

### フィルタが動作しない

**症状**: フィルタの有効/無効が反映されない

**チェック項目**:
1. `GraphModel`でフィルタリングロジックを確認
2. Webviewがフィルタ更新メッセージを受信しているか確認
3. `analyzer.json`のフィルタ設定が正しいか確認

**解決方法**:
- `.vscode/dependviz/analyzer.json`の設定を確認
- グラフを再読み込み

### 設定変更が反映されない

**症状**: VS Code設定を変更してもグラフが更新されない

**チェック項目**:
1. `ConfigurationSubject`がオブザーバに通知しているか確認
2. プロバイダが`update()`メソッドを実装しているか確認
3. Webviewが設定更新メッセージを受信しているか確認
4. Webviewをリロード(Developer: Reload Webviews)

**解決方法**:
- Webviewを手動でリロード
- 拡張機能を再起動

## デバッグ方法

### 拡張機能のデバッグ
1. `src/`ファイルにブレークポイントを設定
2. F5でExtension Development Hostを起動
3. デバッグコンソールで変数を確認

### Webviewのデバッグ
1. Developer: Open Webview Developer Toolsを実行
2. Consoleタブでログを確認
3. Networkタブでメッセージフローを確認

### Java LSPのデバッグ
1. "DependViz Java Language Server"出力チャネルを確認
2. ステージにデバッグログを追加:
   ```java
   System.err.println("Debug: " + message);
   ```
3. `logging.properties`でログレベルを調整

## 関連ドキュメント

- [開発ワークフロー - デバッグ](../guides/development-workflow.md#デバッグ)
- [一般的なタスク](common-tasks.md) - 実装パターン
- [用語集](glossary.md) - 用語の定義

---

[← 一般的なタスク](common-tasks.md) | [用語集 →](glossary.md)
