# 設定リファレンス - DependViz

このドキュメントはDependVizの拡張機能設定とビルドスクリプトの詳細を説明する.

## 拡張機能設定

ユーザ設定可能な設定(VS Code設定経由):

### 視覚設定
- `forceGraphViewer.is3DMode`: 3Dモードを有効化
- `forceGraphViewer.nodeSize`: ノードサイズ倍率 (0.1-5)
- `forceGraphViewer.linkWidth`: リンク幅倍率 (0.1-5)
- `forceGraphViewer.nodeOpacity`: ノード不透明度 (0-2)
- `forceGraphViewer.edgeOpacity`: エッジ不透明度 (0-2)
- `forceGraphViewer.dimOpacity`: 非フォーカス要素の減光不透明度 (0.05-1)

### グラフ動作
- `forceGraphViewer.enableForceLayout`: 力学的レイアウトを有効化
- `forceGraphViewer.hideIsolatedNodes`: 接続のないノードを非表示
- `forceGraphViewer.showNames`: ノードラベルを表示
- `forceGraphViewer.shortNames`: 短縮名を使用(ベース名のみ)
- `forceGraphViewer.nodeSizeByLoc`: コード行数でノードサイズを決定

### スライス設定
- `forceGraphViewer.enableForwardSlice`: 前方依存スライスを有効化
- `forceGraphViewer.enableBackwardSlice`: 後方依存スライスを有効化
- `forceGraphViewer.sliceDepth`: スライス探索深度 (1-10)

### 解析器
- `forceGraphViewer.analyzerId`: アクティブな解析器 (java/javascript)

### 解析器設定ファイル
- `.vscode/dependviz/analyzer.json`: 解析器ごとの設定(色,フィルタ)

## ビルドスクリプト

### npm scripts
- `npm run build`: すべてビルド (webview + java)
- `npm run build:webview`: Webviewのみビルド
- `npm run build:java`: Java LSPサーバのみビルド
- `npm run lint`: すべてリント
- `npm run lint:extension`: 拡張機能コードをリント
- `npm run lint:webview`: Webviewコードをリント
- `npm run lint:fix`: リント自動修正

## 設定の実装詳細

### ConfigurationRepository
VS Code設定の読み書きを処理するクラス

**場所**: `src/configuration/ConfigurationRepository.js`

### ConfigurationSubject
Singleton, Observerパターンを使用して設定変更を通知

**場所**: `src/configuration/ConfigurationSubject.js`

### 設定更新フロー
1. ユーザがVS Code設定を変更
2. `ConfigurationRepository`が変更を検知
3. `ConfigurationSubject`がオブザーバに通知
4. プロバイダ(`BaseProvider`の派生クラス)が`update()`メソッドで更新を受信
5. Webviewに新しい設定を送信

## 関連ドキュメント

- [開発ワークフロー](../guides/development-workflow.md) - 設定変更時のビルド手順
- [コーディング規約](../guides/coding-guidelines.md) - 状態管理のベストプラクティス

---

[← アーキテクチャ](architecture.md) | [リファレンス一覧 →](README.md)
