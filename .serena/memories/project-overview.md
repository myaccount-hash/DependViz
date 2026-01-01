# DependViz - プロジェクト概要

## 基本情報
- **名称**: DependViz (旧名: vscode-force-graph-viewer)
- **タイプ**: VSCode拡張機能
- **バージョン**: 1.0.4
- **目的**: コード依存関係の2D/3Dフォースグラフ可視化
- **主要言語**: JavaScript, Java
- **現在のブランチ**: 3D-graph (メインブランチ: feature/2d-graph)

## アーキテクチャ概要

### 3層構造
1. **VSCode Extension Layer** (JavaScript)
   - ユーザーインターフェース
   - コマンド、設定、プロバイダー管理
   
2. **Analysis Engine Layer** (Java LSP Server)
   - コード解析エンジン
   - 依存関係グラフ生成
   
3. **Visualization Layer** (Webview - JavaScript)
   - グラフのレンダリング
   - ユーザーインタラクション

## ディレクトリ構造

```
DependViz/
├── src/                      # VSCode拡張機能本体
│   ├── extension.js         # エントリーポイント
│   ├── analyzers/           # アナライザー (Java, JavaScript)
│   ├── providers/           # VSCodeプロバイダー
│   ├── configuration/       # 設定管理 (Observer Pattern)
│   ├── bridge/              # Webview通信
│   ├── commands/            # コマンド実装
│   └── utils/               # ユーティリティ
├── webview/                 # グラフ可視化UI
│   ├── src/
│   │   ├── index.js        # エントリーポイント
│   │   ├── GraphModel.js   # データモデル
│   │   ├── GraphViewModel.js # ビューモデル (MVVM)
│   │   └── views/          # 2D/3Dビュー (Strategy Pattern)
│   └── dist/               # ビルド成果物
└── java/                    # Java解析エンジン
    └── src/main/java/com/example/
        ├── lsp/            # LSPサーバー実装
        └── parser/         # コード解析 (Pipeline Pattern)
            ├── AnalysisEngine.java
            ├── models/     # GraphNode, GraphEdge, CodeGraph
            └── stages/     # 解析ステージ (8段階)

```

## 主要コンポーネント

### 1. VSCode Extension (src/)

#### extension.js
- エントリーポイント
- プロバイダーの初期化と登録
- Observer Patternで設定変更を各プロバイダーに通知
- ファイルウォッチャー (.vscode/dependviz/analyzer.json)

#### Analyzers (src/analyzers/)
- **AnalyzerContext**: Strategy Patternでアナライザーを管理
- **JavaAnalyzer**: Java LSPサーバー経由で解析
- **JavaScriptAnalyzer**: Babel Parserで解析
- **BaseAnalyzer**: アナライザー基底クラス

#### Providers (src/providers/)
- **GraphViewProvider**: Webviewとの通信管理
  - WebviewBridge使用
  - ノードフォーカス機能
  - ダークモード対応
- **FilterProvider**: フィルター管理
- **GraphSettingsProvider**: 設定UI管理
- **BaseProvider**: プロバイダー基底クラス

#### Configuration (src/configuration/)
- **ConfigurationSubject**: Observer Pattern実装
- 設定変更を全プロバイダーに通知
- .vscode/dependviz/analyzer.json 監視

#### Bridge (src/bridge/)
- **WebviewBridge**: Extension ⟷ Webview メッセージング
- MessageTypes定義 (EXTENSION_TO_WEBVIEW, WEBVIEW_TO_EXTENSION)

### 2. Java Analysis Engine (java/)

#### LSP Server (java/src/main/java/com/example/lsp/)
- **DependVizLanguageServer**: LSP4j実装
  - カスタムリクエスト: `dependviz/getFileDependencyGraph`
  - 標準入出力でVSCode拡張機能と通信
- **DependVizTextDocumentService**: テキストドキュメント操作

#### Parser (java/src/main/java/com/example/parser/)
- **AnalysisEngine**: 解析エンジン本体
  - JavaParserとSymbolSolverを使用
  - Pipeline Patternで8ステージ実行
  - TypeSolverで型解決 (Reflection + ソースコード)
  
- **解析ステージ (Pipeline Pattern)**:
  1. TypeUseStage - 型使用解析
  2. MethodCallStage - メソッド呼び出し解析
  3. ObjectCreationStage - オブジェクト生成解析
  4. ExtendsStage - 継承関係解析
  5. ImplementsStage - インターフェース実装解析
  6. ClassTypeStage - クラス型解析
  7. LinesOfCodeStage - コード行数計測
  8. FilePathStage - ファイルパス処理

- **Models**:
  - CodeGraph - 全体のグラフデータ
  - GraphNode - ノード (id, label, filePath, loc, type)
  - GraphEdge - エッジ (source, target, type)

### 3. Webview Visualization (webview/)

#### MVVM Pattern
- **GraphModel** (Model): データ構造管理
  - ノード/リンク配列
  - バージョン管理
  - ノード間関係 (neighbors, links)
  
- **GraphViewModel** (ViewModel): ビジネスロジック
  - Extension⟷Webview通信
  - データ更新制御
  - フォーカス管理
  
- **GraphView** (View): レンダリング
  - Strategy Patternで2D/3D切り替え

#### Strategy Pattern (views/)
- **GraphViewContext**: コンテキストクラス
  - 2D/3D戦略を動的に切り替え
  - すべての操作を現在の戦略に委譲
  
- **GraphView2D**: 2Dレンダリング戦略
  - force-graphライブラリ使用
  
- **GraphView3D**: 3Dレンダリング戦略
  - 3d-force-graphライブラリ使用
  - Three.js依存

## デザインパターン

### Observer Pattern
- **場所**: src/configuration/ConfigurationSubject
- **目的**: 設定変更を複数のプロバイダーに通知
- **実装**: Subject (ConfigurationSubject) → Observers (各Provider)

### Strategy Pattern (Analyzer)
- **場所**: src/analyzers/AnalyzerContext
- **目的**: 言語別アナライザーの動的切り替え
- **実装**: Context (AnalyzerContext) → Strategies (JavaAnalyzer, JavaScriptAnalyzer)

### Strategy Pattern (Rendering)
- **場所**: webview/src/views/GraphViewContext
- **目的**: 2D/3Dレンダリングモードの切り替え
- **実装**: Context (GraphViewContext) → Strategies (GraphView2D, GraphView3D)

### Pipeline Pattern
- **場所**: java/src/main/java/com/example/parser/AnalysisEngine
- **目的**: 段階的なコード解析
- **実装**: 8つのステージを順次実行

### MVVM Pattern
- **場所**: webview/src/
- **目的**: データとビューの分離
- **実装**: Model (GraphModel) ⟷ ViewModel (GraphViewModel) ⟷ View (GraphViewContext)

## 主要な依存関係

### VSCode Extension
- `@babel/parser`, `@babel/traverse` - JavaScript解析
- `vscode-languageclient` - LSPクライアント

### Java Backend
- `javaparser-symbol-solver-core:3.27.0` - Javaコード解析
- `jackson-databind:2.19.1` - JSON処理
- `org.eclipse.lsp4j:0.21.2` - LSPサーバー実装

### Webview
- `force-graph:^1.44.0` - 2Dフォースグラフ
- `3d-force-graph:^1.73.6` - 3Dフォースグラフ
- `three:^0.160.0` - 3D描画ライブラリ
- `webpack` - ビルドツール

## ビルドプロセス

```bash
npm run build
├── npm run build:java       # Maven: java/target/java-graph.jar
└── npm run build:extension
    └── npm run build:webview  # Webpack: webview/dist/bundle.js + index.html
```

## 主要機能

### 解析機能
- プロジェクト全体の解析 (Analyze Project)
- 現在ファイルの解析 (Analyze Current File)
- Forward/Backward Slice - 依存関係トレース

### 可視化機能
- 2D/3Dフォースグラフ
- ノードサイズをLOCで調整
- 力学レイアウト有効/無効
- 孤立ノード非表示
- ノード/エッジの透明度、サイズ調整
- フォーカスモード (選択ノードと関連ノードのみ表示)
- ダークモード対応

### インタラクション
- ノードクリックでファイルを開く
- アクティブエディタに対応するノードをフォーカス
- 検索機能
- フィルター機能

## 設定ファイル

### .vscode/dependviz/analyzer.json
- アナライザー設定を保存
- ファイルウォッチャーで変更を監視
- 外部からの設定変更を検出

### VSCode設定 (forceGraphViewer.*)
- 全ての可視化パラメータ
- アナライザーID (java/javascript)
- 2D/3Dモード切り替え
- スライス深度

## メッセージング

### Extension → Webview
- GRAPH_UPDATE - グラフデータ更新
- VIEW_UPDATE - ビュー設定のみ更新
- NODE_FOCUS - ノードにフォーカス
- FOCUS_CLEAR - フォーカス解除

### Webview → Extension
- READY - Webview初期化完了
- FOCUS_NODE - ノードをフォーカス (ファイルを開く)

## 開発のヒント

### 新しいアナライザーの追加
1. `src/analyzers/BaseAnalyzer.js` を継承
2. `analyzerId`と`displayName`を静的プロパティで定義
3. `analyze()`と`analyzeFile()`を実装
4. `AnalyzerContext.js`の`REGISTERED_ANALYZERS`に追加

### 新しい解析ステージの追加
1. `java/.../parser/stages/BaseStage.java` を継承
2. `process(CompilationUnit, CodeGraph)` を実装
3. `AnalysisEngine.java`のステージリストに追加

### Webviewの拡張
- GraphModel: データ構造の変更
- GraphViewModel: ロジックの追加
- GraphView2D/3D: レンダリングの変更
- MessageTypes: 新しいメッセージタイプ定義

## 注意事項

- Webviewのビルドは拡張機能パッケージング前に必須
- Java LSPサーバーはJava 21必須
- TypeSolverはsrc/main/javaを自動検出
- SymbolSolverが型を解決できない場合はスキップ