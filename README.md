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

1. リポジトリをクローン
```bash
git clone <repository-url>
cd DependViz
```

2. 依存関係のインストールとビルド
```bash
npm install
npm run build
```

## ビルド

```bash
# 全体をビルド（Java + 拡張機能）
npm run build

# Javaバックエンドのみ
npm run build:java

# 拡張機能の依存関係のみ
npm run build:extension

# クリーンアップ
npm run clean
```

## 使用方法

1. VS Codeで拡張機能を開発モードで実行（F5）
2. Javaプロジェクトを開く
3. コマンドパレット（Cmd+Shift+P / Ctrl+Shift+P）から「Analyze Java Project」を実行
4. サイドバーの「Force Graph」ビューでグラフを確認

## 開発

```bash
# クリーンアップ
npm run clean

# ビルド
npm run build
```

## ライセンス

MIT License

