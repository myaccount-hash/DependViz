# 用語集 - DependViz

このドキュメントはDependVizプロジェクトで使用される用語の定義を提供する.

## グラフ関連用語

| 用語 | 説明 |
|------|------|
| **Node** | コードエンティティ(クラス,ファイル,関数)を表すグラフ頂点 |
| **Edge/Link** | 依存関係を表すグラフ辺 |
| **Slice** | フォーカスされたノードからの前方/後方依存関係を示すグラフのサブセット |
| **Focus** | カメラズーム付きでハイライトされたノード |
| **Controls** | UI設定(チェックボックス,スライダー) |

## アーキテクチャ用語

| 用語 | 説明 |
|------|------|
| **Analyzer** | コード解析コンポーネント(Java, JavaScript) |
| **Provider** | VS Code UIツリービュープロバイダ |
| **LSP** | Language Server Protocol - 言語解析の標準プロトコル |
| **MVVM** | Model-View-ViewModel - Webviewで使用される設計パターン |
| **Pipeline** | Java解析エンジンの順次ステージ処理パターン |
| **Strategy** | 2D/3Dレンダリング切り替えに使用される設計パターン |
| **Observer** | 設定変更通知に使用される設計パターン |

## コンポーネント用語

| 用語 | 説明 |
|------|------|
| **Extension** | VS Code拡張機能のメインプロセス (src/) |
| **Webview** | グラフを表示するUI (webview/src/) |
| **Java LSP Server** | Java解析を行うLanguage Server (java/src/) |
| **GraphViewModel** | WebviewのMVVMパターンにおけるViewModel |
| **GraphModel** | WebviewのMVVMパターンにおけるModel |
| **GraphView** | WebviewのMVVMパターンにおけるView (2D/3D戦略) |

## メッセージ用語

| 用語 | 説明 |
|------|------|
| **EXTENSION_TO_WEBVIEW** | 拡張機能からWebviewへのメッセージタイプ |
| **WEBVIEW_TO_EXTENSION** | WebviewからExtensionへのメッセージタイプ |
| **postMessage** | Webviewとの通信に使用されるAPI |
| **MessageTypes** | メッセージタイプ定数を定義するモジュール |

## 依存関係用語

| 用語 | 説明 |
|------|------|
| **Extends** | クラス継承関係 |
| **Implements** | インターフェース実装関係 |
| **MethodCall** | メソッド呼び出し依存関係 |
| **ObjectCreation** | オブジェクト生成依存関係 |
| **TypeUse** | 型使用関係 |
| **Forward Slice** | あるノードが依存する先のノード群 |
| **Backward Slice** | あるノードに依存するノード群 |

## ビルド用語

| 用語 | 説明 |
|------|------|
| **Webpack** | Webviewのバンドルツール |
| **Maven** | Java LSPサーバのビルドツール |
| **JavaParser** | Javaコード解析ライブラリ |
| **Babel** | JavaScript解析ライブラリ |
| **LSP4J** | Java用LSP実装ライブラリ |

## VS Code固有用語

| 用語 | 説明 |
|------|------|
| **TreeView** | サイドバーに表示される階層UI |
| **Configuration** | ワークスペースまたはユーザー設定 |
| **Command** | コマンドパレットから実行可能な操作 |
| **Output Channel** | ログ出力用のチャネル |
| **Extension Development Host** | 拡張機能をデバッグするためのVS Code インスタンス |

## 関連ドキュメント

- [アーキテクチャ](../reference/architecture.md) - システム構造の詳細
- [一般的なタスク](common-tasks.md) - 実装パターン
- [はじめに](../guides/getting-started.md) - プロジェクト概要

---

[← 既知の問題](known-issues.md) | [トラブルシューティング一覧 →](README.md)
