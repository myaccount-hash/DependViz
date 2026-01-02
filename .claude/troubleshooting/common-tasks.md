# 一般的なタスク - DependViz

このドキュメントはDependVizで頻出するタスクの実装パターンを提供する.

## AIアシスタント向けの一般的なタスク

### 新しい解析器の追加

1. `BaseAnalyzer`を継承する`src/analyzers/YourAnalyzer.js`を作成
2. 実装:
   - `static get analyzerId()`: 一意のID
   - `static getTypeDefinitions()`: 色付きのノード/エッジタイプ
   - `analyze()`: プロジェクト全体を解析
   - `analyzeFile(filePath)`: 単一ファイルを解析
3. `AnalyzerContext.js`に登録

**参照**: [アーキテクチャ](../reference/architecture.md#1-拡張性のための基底クラス)

### 新しいグラフ機能の追加

1. **拡張機能側**:
   - `package.json` → `contributes.configuration.properties`に設定を追加
   - 必要に応じて`ConfigurationRepository`を更新
2. **Webview側**:
   - `GraphViewModel`のプレゼンテーション状態を更新
   - `GraphView2D`/`GraphView3D`のレンダリングロジックを更新
   - 新しい設定を渡すために`_createRenderingContext()`を更新

**参照**: [設定リファレンス](../reference/configuration.md)

### 新しいコマンドの追加

1. `package.json` → `contributes.commands`にコマンド定義を追加
2. `src/commands.js` → `registerCommands()`にコマンド実装を追加
3. オプションでUI統合のために`package.json` → `contributes.menus`に追加

**参照**: [主要ファイル参照](../reference/architecture.md#主要ファイル参照)

### Java解析の修正

1. `java/src/main/java/com/example/parser/stages/`に新しいステージを作成
2. `BaseStage`を継承し`analyze()`を実装
3. `AnalysisEngine.java` → `createDefaultStages()`にステージを登録
4. 再ビルド: `npm run build:java`

**参照**: [アーキテクチャ](../reference/architecture.md#3-java解析のためのpipeline)

### グラフ問題のデバッグ

1. Webviewコンソールを確認(Developer: Open Webview Developer Tools)
2. メッセージフローを検証:
   - 拡張機能 → Webview: `EXTENSION_TO_WEBVIEW.*`
   - Webview → 拡張機能: `WEBVIEW_TO_EXTENSION.*`
3. データ構造を確認:
   - データ問題は`GraphModel`
   - UI問題は`GraphViewModel._presentationState`
4. レンダリングを確認:
   - 視覚的問題は`GraphView2D`/`GraphView3D`

**参照**: [開発ワークフロー - デバッグ](../guides/development-workflow.md#デバッグ)

## クイックリファレンス

### 主要なメッセージタイプ

**拡張機能 → Webview**:
- `EXTENSION_TO_WEBVIEW.UPDATE_GRAPH`: グラフデータ更新
- `EXTENSION_TO_WEBVIEW.UPDATE_CONTROLS`: コントロール更新
- `EXTENSION_TO_WEBVIEW.FOCUS_NODE`: ノードフォーカス

**Webview → 拡張機能**:
- `WEBVIEW_TO_EXTENSION.NODE_CLICKED`: ノードクリック
- `WEBVIEW_TO_EXTENSION.READY`: Webview準備完了

### 主要なコマンド

- `forceGraphViewer.refresh`: グラフ更新
- `forceGraphViewer.analyzeProject`: プロジェクト解析
- `forceGraphViewer.toggleMode`: 2D/3D切り替え
- `forceGraphViewer.focusActiveFile`: アクティブファイルにフォーカス

---

[← トラブルシューティング一覧](README.md) | [既知の問題 →](known-issues.md)
