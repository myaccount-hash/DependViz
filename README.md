# DependViz

![DependViz](images/DependViz.png)

DependVizはVS Code拡張機能です．
Javaプロジェクトの依存関係を3d-force-graphで可視化します．

## 機能

- Javaプロジェクトのコード依存関係を3Dグラフで可視化
- クラス，インターフェース，メソッド呼び出しなどの関係を視覚化
- インタラクティブなグラフ操作（ズーム，回転，フィルタリング）

## 必要な環境

- Node.js
- Java 21以上
- Maven 3.6以上

## セットアップ
依存関係をインストール
```bash
# brewの場合
brew install node
brew install java
```
[Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=myaccount-hash.vscode-force-graph-viewer)から拡張機能をインストール


## 使い方

- Javaプロジェクトを開く
- コマンドパレット(Cmd+Shift+P / Ctrl+Shift+P)を開く
- 「DependViz: Analyze Java Project」を実行
	- デフォルトではワークスペースのルートからJavaソースファイルを探索し解析を実行します．
	- 「DependViz: Select Java Source Directory」により解析するディレクトリを指定できます．
	- 解析結果はワークスペースのルートに`graph.json`として保存されます．
- 「DependViz: Focus on グラフビュー View」を実行
- グラフビューが空の場合は右上のRefreshをクリック

## スタックトレース機能の利用

VS Codeのデバッグセッションがアクティブな状態で，スタックトレースモードを有効にすると，現在のスタックトレースに基づいてグラフ上にノード間のリンクが表示されます．デバッグ中の実行パスを可視化できます．

## スライシング機能

ノードをフォーカスした際に，そのノードに関連する依存関係のみを表示する機能です．順方向スライスは選択ノードから出ていく依存関係，逆方向スライスは選択ノードに入ってくる依存関係を表示します．設定で有効化すると，ノードフォーカス時に自動的にスライスが計算されます．

## 設定項目

### 検索・フィルタ

- `forceGraphViewer.search`: 検索キーワード
- `forceGraphViewer.hideIsolatedNodes`: 孤立ノードを非表示

### 表示モード

- `forceGraphViewer.darkMode`: ダークモード
- `forceGraphViewer.showNames`: 名前を表示
- `forceGraphViewer.shortNames`: 短縮名を表示
- `forceGraphViewer.showStackTrace`: スタックトレース表示
- `forceGraphViewer.autoRotate`: 自動回転
- `forceGraphViewer.rotateSpeed`: 回転速度（範囲: 0.01-5.0）

### ノード表示

- `forceGraphViewer.nodeSize`: ノードサイズ（範囲: 0.1-5.0）
- `forceGraphViewer.nodeSizeByLoc`: ノードサイズをLOCで決定
- `forceGraphViewer.nodeOpacity`: ノード透明度（範囲: 0.1-1.0）
- `forceGraphViewer.nameFontSize`: 名前のフォントサイズ（範囲: 6-32）

### エッジ表示

- `forceGraphViewer.linkWidth`: リンク幅（範囲: 0.1-5.0）
- `forceGraphViewer.edgeOpacity`: エッジ透明度（範囲: 0.1-1.0）
- `forceGraphViewer.linkDistance`: リンク距離（範囲: 10-100）
- `forceGraphViewer.arrowSize`: 矢印サイズ（範囲: 1-20）

### ノードタイプフィルタ

- `forceGraphViewer.showClass`: クラスを表示
- `forceGraphViewer.showAbstractClass`: 抽象クラスを表示
- `forceGraphViewer.showInterface`: インターフェースを表示
- `forceGraphViewer.showUnknown`: 不明なタイプを表示

### エッジタイプフィルタ

- `forceGraphViewer.showObjectCreate`: オブジェクト作成エッジを表示
- `forceGraphViewer.showExtends`: 継承エッジを表示
- `forceGraphViewer.showImplements`: 実装エッジを表示
- `forceGraphViewer.showTypeUse`: 型使用エッジを表示
- `forceGraphViewer.showMethodCall`: メソッド呼び出しエッジを表示

### 色設定

- `forceGraphViewer.colorClass`: クラスの色
- `forceGraphViewer.colorAbstractClass`: 抽象クラスの色
- `forceGraphViewer.colorInterface`: インターフェースの色
- `forceGraphViewer.colorUnknown`: 不明なタイプの色
- `forceGraphViewer.colorObjectCreate`: オブジェクト作成エッジの色
- `forceGraphViewer.colorExtends`: 継承エッジの色
- `forceGraphViewer.colorImplements`: 実装エッジの色
- `forceGraphViewer.colorTypeUse`: 型使用エッジの色
- `forceGraphViewer.colorMethodCall`: メソッド呼び出しエッジの色

### スライス機能

- `forceGraphViewer.sliceDepth`: スライス深度（範囲: 1-10）
- `forceGraphViewer.enableForwardSlice`: 順方向スライスを有効化
- `forceGraphViewer.enableBackwardSlice`: 逆方向スライスを有効化

### その他

- `forceGraphViewer.focusDistance`: フォーカス時のカメラ距離（範囲: 20-300）
- `forceGraphViewer.javaSourceDirectory`: Java解析を開始するディレクトリ（空の場合はワークスペース全体）

## ビルド
```bash
npm install
npm run build
```

## ライセンス

MIT License
