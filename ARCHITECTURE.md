# DependViz システムアーキテクチャ

## Extension Host
- 役割: VS Code APIでビュー/コマンド/設定/解析/デバッグ連携を統括し、WebViewへグラフ更新を通知する
- エントリ: `src/extension.js`
- コマンド: `src/commands.js`

## ConfigurationManager
- 対象: `src/ConfigurationManager.js`
- 役割: ワークスペース設定ファイルの読み書きを一元化する
- 読み取り: `loadControls()` が `forceGraphViewer.*` と `.vscode/dependviz/analyzer.json` を統合
- 書き込み: `updateControl()` / `updateControls()` が VS Code設定 or `analyzer.json` を書き分け
- 変更通知: `.vscode/dependviz/analyzer.json` の監視は `src/extension.js` が行い、`handleAnalyzerConfigExternalChange()` 経由で更新を伝播

## AnalyzerManager
- 対象: `src/AnalyzerManager.js`
- 役割: Analyzerのインスタンス生成と保持、選択/参照の窓口
- 参照API: `getActiveAnalyzer()` / `getAnalyzerName()` / `isFileSupported()`
- 登録/既定: `getAnalyzerClassById()` / `getAnalyzerOptions()` / `getDefaultAnalyzerId()` を提供

## Analyzers
- BaseAnalyzer
  - 解析機能のインタフェース
- JavaAnalyzer (`src/analyzers/JavaAnalyzer.js`)
  - ExtensionHostに対し解析機能を提供する
  - JARを起動し、LSPサーバ `DependVizLanguageServer.java` を利用
  - Java側は Analyzer実装が単一ファイルに対し実行され、`CodeGraph` を返す
  - 返却されたファイルごとのデータをマージしてグラフ化
- JavaScriptAnalyzer (`src/analyzers/JavaScriptAnalyzer.js`)
  - Babel ASTで依存を抽出する（UI表記は未実装扱い）

## Providers
- BaseProvider
  - TreeView Providerの共通基盤
- GraphViewProvider
  - グラフ表示のWebViewパネル
  - WebviewBridgeを通じてWebViewとメッセージング
  - 送信: `graph:update` / `view:update` / `node:focus` / `mode:toggle` / `focus:clear`
- GraphSettingsProvider
  - 言語非依存の設定表示
- FilterProvider
  - 言語依存の設定表示
  - BaseAnalyzer由来の設定項目を生成

## WebView Process
- GraphViewModelが状態更新を担当
- 2D/3Dの差分は `GraphRenderer2D.js` / `GraphRenderer3D.js` に実装
- ExtensionHostとの通信はExtensionBridgeが統括
  - 送信: `ready`（受信準備完了）, `focusNode`（ノード選択）
