# DependViz - 技術詳細

## LSP統合

### カスタムLSPリクエスト
- **リクエスト名**: `dependviz/getFileDependencyGraph`
- **パラメータ**: ファイルURI (string)
- **戻り値**: JSON文字列 (CodeGraphのシリアライズ)
- **実装**: `DependVizLanguageServer.java`

### LSP通信フロー
1. VSCode Extension (JavaAnalyzer) → LSP Request
2. Java LSP Server → AnalysisEngine.analyzeFile()
3. パイプライン実行 → CodeGraph生成
4. JSON変換 → VSCode Extension
5. GraphViewProvider.setGraphData()
6. Webview描画

## グラフデータ構造

### ノード構造 (GraphNode)
```json
{
  "id": "com.example.MyClass",
  "label": "MyClass",
  "filePath": "src/main/java/com/example/MyClass.java",
  "loc": 150,
  "type": "class"
}
```

### エッジ構造 (GraphEdge)
```json
{
  "source": "com.example.ClassA",
  "target": "com.example.ClassB",
  "type": "method_call"
}
```

### エッジタイプ
- `method_call` - メソッド呼び出し
- `object_creation` - オブジェクト生成
- `type_use` - 型使用
- `extends` - 継承
- `implements` - インターフェース実装

## Webviewのデータフロー

### 初期化フロー
1. `GraphViewProvider.resolveWebviewView()` - Webview生成
2. Webview: `index.html` 読み込み → `index.js` 実行
3. `GraphViewModel` 初期化 → `READY` メッセージ送信
4. Extension: `syncToWebview()` → `GRAPH_UPDATE` メッセージ
5. Webview: グラフ描画

### データ更新フロー
1. 解析完了 → `GraphViewProvider.setGraphData()`
2. `_dataVersion` インクリメント
3. `syncToWebview()` → `GRAPH_UPDATE` メッセージ
4. Webview: `GraphModel.update()` → バージョン比較
5. `GraphViewContext.update()` → レンダリング

### フォーカスフロー (Extension → Webview)
1. ユーザーがエディタでファイル切り替え
2. `onDidChangeActiveTextEditor` イベント
3. `GraphViewProvider.handleDataUpdate({ type: 'focusNode', filePath })`
4. キューに追加 → `_applyDataUpdate()`
5. `focusNode()` → ノード検索
6. `NODE_FOCUS` メッセージ → Webview
7. `GraphViewModel.handleNodeFocus()` → カメラ移動

### フォーカスフロー (Webview → Extension)
1. ユーザーがグラフでノードクリック
2. `GraphView2D/3D`: `onNodeClick` コールバック
3. `FOCUS_NODE` メッセージ → Extension
4. `vscode.window.showTextDocument()` → ファイルを開く
5. Extension → Webview: `NODE_FOCUS` (上記フローに戻る)

## 設定管理 (Observer Pattern)

### ConfigurationSubject
```javascript
class ConfigurationSubject {
  attach(observer) { /* observerを登録 */ }
  notifyAll() { /* 全observerに通知 */ }
  handleAnalyzerConfigExternalChange() { /* 外部変更検出 */ }
}
```

### Observerインターフェース
```javascript
class BaseProvider {
  update(controls) { /* 設定変更時の処理 */ }
  handleSettingsChanged(controls) { /* サブクラスでオーバーライド */ }
}
```

### 設定変更の流れ
1. ユーザーが設定変更 (UI or analyzer.json編集)
2. `ConfigurationSubject.notifyAll()`
3. 各Provider: `update(controls)` → `handleSettingsChanged(controls)`
4. GraphViewProvider: `syncToWebview({ viewOnly: true })`
5. Webview: ビジュアル更新のみ (データ再取得なし)

## JavaParser解析の詳細

### TypeSolver設定
```java
CombinedTypeSolver typeSolver = new CombinedTypeSolver();
typeSolver.add(new ReflectionTypeSolver());  // JDK標準ライブラリ
typeSolver.add(new JavaParserTypeSolver(sourceRoot));  // プロジェクトソース
```

### ステージごとの責務

#### TypeUseStage
- フィールド宣言、変数宣言、メソッド戻り値の型
- `type_use` エッジを生成

#### MethodCallStage
- メソッド呼び出し式を検出
- SymbolSolverで呼び出し先を解決
- `method_call` エッジを生成

#### ObjectCreationStage
- `new` キーワードによるオブジェクト生成
- `object_creation` エッジを生成

#### ExtendsStage
- クラスの継承関係
- `extends` エッジを生成

#### ImplementsStage
- インターフェース実装
- `implements` エッジを生成

#### ClassTypeStage
- クラス/インターフェース/列挙型のノード生成
- `type` プロパティを設定

#### LinesOfCodeStage
- ノードごとのLOC (Lines of Code) を計測
- コメント、空行を除外

#### FilePathStage
- ノードに `filePath` プロパティを追加
- ワークスペース相対パスに変換

### エラーハンドリング
- SymbolSolverで型解決失敗 → ログ出力してスキップ
- パース失敗 → 例外スロー、ファイル単位でスキップ

## Webviewレンダリング詳細

### GraphView2D (force-graph)
```javascript
import ForceGraph from 'force-graph';

const graph = ForceGraph()(container)
  .graphData(data)
  .nodeId('id')
  .nodeLabel('label')
  .nodeColor(node => getColor(node))
  .linkDirectionalArrowLength(arrowSize)
  .onNodeClick(node => onNodeClick(node));
```

### GraphView3D (3d-force-graph)
```javascript
import ForceGraph3D from '3d-force-graph';

const graph = ForceGraph3D()(container)
  .graphData(data)
  .nodeId('id')
  .nodeLabel('label')
  .nodeThreeObject(node => createNodeObject(node))
  .onNodeClick(node => onNodeClick(node));
```

### フォーカス実装
- 2D: `graph.centerAt(x, y, duration)` + `graph.zoom(level, duration)`
- 3D: `graph.cameraPosition(position, lookAt, duration)`
- 関連ノード/エッジの透明度調整 (dimOpacity設定値を使用)

### パフォーマンス最適化
- `GraphModel._nodeById` Map でノード検索を高速化
- `neighbors`, `links` プロパティを事前計算
- バージョン管理でデータ更新を最小化

## JavaScript解析 (JavaScriptAnalyzer)

### Babel Parser使用
- AST (Abstract Syntax Tree) 生成
- import/export、require() を解析
- モジュール間依存関係を抽出

### 制限事項
- 動的import未対応
- 型情報なし (TypeScript未対応)
- クラス/関数レベルの解析は未実装

## ビルドシステム

### Webview Build (Webpack)
- エントリー: `webview/src/index.js`
- 出力: `webview/dist/bundle.js`
- HTML生成: `scripts/build-html.js` - template.htmlからindex.html生成

### Java Build (Maven)
- Shade Plugin: fat JAR生成 (全依存を含む)
- メインクラス: `com.example.lsp.DependVizLanguageServer`
- 出力: `java/target/java-graph.jar`

## 開発時のデバッグ

### Extension Debug
- VSCode: F5 → Extension Development Host起動
- console.log → 元のVSCodeのDebug Console

### LSP Server Debug
- `logging.properties` でログレベル設定
- 標準エラー出力 → VSCode Output Panel (DependViz Language Server)

### Webview Debug
- Webview右クリック → Open Webview Developer Tools
- console.log → Webview Developer Tools Console

## テストファイル
- `sample/` ディレクトリにサンプルJavaプロジェクト
- テスト用の依存関係パターンを含む

## 既知の制限

### Java解析
- Lambdaの型解決が不安定
- Genericsの複雑な型推論に失敗することがある
- 外部ライブラリへの依存は未解決 (TypeSolverに未追加)

### JavaScript解析
- 基本的なimport/exportのみ対応
- 動的require、条件付きimport未対応
- node_modules内は解析対象外

### Webview
- 大規模グラフ (1000+ ノード) でパフォーマンス低下
- 3Dモードはメモリ使用量が高い

## 今後の拡張性

### 新しい言語サポート
1. `src/analyzers/` に新しいアナライザー追加
2. LSPサーバー実装、またはAST解析ライブラリ使用
3. CodeGraph形式でデータ返却

### 新しいエッジタイプ
1. Java側でステージ追加 → エッジ生成
2. Webview側で色/スタイル定義

### 新しいビジュアライゼーション
1. `webview/src/views/` に新しいGraphView実装
2. GraphViewContextに戦略登録
3. UI切り替えボタン追加