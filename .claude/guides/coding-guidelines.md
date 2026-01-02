# コーディング規約 - DependViz

このドキュメントはDependVizプロジェクトのコーディング規約とベストプラクティスを定義する.

## 命名規約

### クラス/ファイル
- クラスはPascalCase: `GraphViewModel`, `BaseAnalyzer`
- ファイル名とクラス名を一致: `GraphViewModel.js`が`GraphViewModel`をエクスポート

### メソッド/変数
- メソッドと変数はcamelCase: `handleNodeClick`, `focusedNode`
- プライベートメソッド/フィールドは`_`接頭辞: `_handleMessage`, `_observers`

### 定数
- 定数はUPPER_SNAKE_CASE: `EXTENSION_TO_WEBVIEW`, `WEBVIEW_TO_EXTENSION`

### VS Code固有
- 設定キー: `forceGraphViewer.nodeSize`
- コマンドID: `forceGraphViewer.refresh`
- ビューID: `forceGraphViewer.sidebar`

## コード構成原則

### 解析器パターン
- 基底クラスが未実装メソッドでエラーを投げることでインターフェースを定義
- サブクラスがオーバーライド: `analyze()`, `analyzeFile()`, `static get analyzerId()`
- `BaseAnalyzer.js`と`JavaAnalyzer.js`を参照

### 設定更新
- `ConfigurationSubject.getInstance()`が設定を管理
- プロバイダは`update(controls)`メソッド経由で通知を受ける
- 複雑にしすぎない - これは単純なpub-sub

### Webview状態
- `GraphModel`: データ(ノード,リンク)
- `GraphViewModel`: UI状態(フォーカス,スライス)
- `GraphView2D`/`GraphView3D`: レンダリング
- これらを分離するが完璧な分離に固執しない

## ファイル構成

### 拡張機能構造
```
src/
├── analyzers/          # コード解析器 (Java, JavaScript)
├── providers/          # VS Code UIプロバイダ
├── configuration/      # 設定管理 (Observerパターン)
├── bridge/            # 拡張機能 ↔ webview通信
├── commands/          # コマンドハンドラ
├── utils/             # ユーティリティ関数
├── commands.js        # コマンド登録
└── extension.js       # エントリポイント
```

### Webview構造
```
webview/src/
├── views/             # レンダリング戦略 (2D/3D)
├── GraphViewModel.js  # MVVM ViewModel
├── GraphModel.js      # MVVM Model
├── MessageTypes.js    # メッセージプロトコル
└── index.js           # エントリポイント
```

### Java構造
```
java/src/main/java/com/example/
├── lsp/               # LSPサーバ実装
├── parser/
│   ├── stages/       # 解析パイプラインステージ
│   ├── models/       # データモデル
│   └── AnalysisEngine.java
```

## コードドキュメント

### コメントを追加するタイミング
- コードベースにはいくつかのJSDocコメントがあるが,追加の義務はない
- ロジックが本当に複雑または自明でない場合のみコメントを追加
- 既存のコメントは保持してよいが,必要でない限り追加しない

### JSDocフォーマット (追加する場合)
- 簡潔に保つ
- 複雑なメソッドではパラメータと戻り値の型を文書化
- `setValue()`に対する「値を設定する」のような自明なコメントは避ける

## エラーハンドリング

### 拡張機能
- 非同期操作にはtry-catchを使用
- `vscode.window.showErrorMessage()`経由でユーザフレンドリーなメッセージを表示
- 詳細なエラーをコンソールと出力チャネルにログ

**例**:
```javascript
try {
    await this.analyze();
} catch (error) {
    vscode.window.showErrorMessage(`解析失敗: ${error.message}`);
    console.error('Detailed error:', error);
}
```

### Webview
- 処理前にメッセージを検証
- null/undefinedに対する防御的チェックを使用
- 未知のメッセージタイプに対して警告をログ

### Java
- 回復不可能なエラーには例外を投げる
- ユーザ向けエラーにはLSPエラー報告を使用
- `window/logMessage`経由で出力チャネルにログ

## 状態管理

### 設定
- `ConfigurationSubject.getInstance()`が設定を一元化
- 変更はVS Codeワークスペース設定に保存
- プロバイダは自動的に通知される

### グラフ状態
- 拡張機能がグラフデータを維持
- WebviewがUI状態(フォーカス,スライス)を維持
- 拡張機能 ↔ webviewメッセージ経由で同期

### メッセージプロトコル
- メッセージタイプには`MessageTypes`定数を使用
- メッセージ作成には`createMessage()`ヘルパーを使用
- 受信メッセージの検証には`isValidMessage()`を使用

## ベストプラクティス

### 簡潔性優先
- 過度な抽象化を避ける
- 3行の類似コードは許容される
- パターン遵守より簡潔性を優先

### 段階的開発
- 小さな変更を行い動作を確認
- 動作中のコードをリファクタリングしない
- 保守的にバグ修正

### 実用主義
- 完璧な分離に固執しない
- 1回だけの使用のためのヘルパー作成を避ける
- ユーザが要求しない限りテストを追加しない

---

[← はじめに](getting-started.md) | [開発ワークフロー →](development-workflow.md)
