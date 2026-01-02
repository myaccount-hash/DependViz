# CLAUDE.md - DependViz

本文書はAIアシスタント(Claude Codeなど)がDependVizプロジェクトの構造を理解し,コードベースを効果的に扱うための情報を提供する.

## 📚 ドキュメント構成

### [📖 開発ガイド](guides/README.md)
初めて読む人・開発者向けのガイド
- **[はじめに](guides/getting-started.md)** - 基本原則とプロジェクト概要
- **[コーディング規約](guides/coding-guidelines.md)** - 命名規則、コード構成、ベストプラクティス
- **[開発規約](guides/conventions.md)** - コメント、テスト、レビュー規約
- **[タスクワークフロー](guides/workflows.md)** - 頻出タスクのチェックリスト
- **[開発ワークフロー](guides/development-workflow.md)** - セットアップ、ビルド、テスト、デバッグ

### [📚 リファレンス](reference/README.md)
詳細なリファレンス情報
- **[アーキテクチャ](reference/architecture.md)** - システム設計、コンポーネント、パターン
- **[設定リファレンス](reference/configuration.md)** - 拡張機能設定、ビルドスクリプト

### [🔧 トラブルシューティング](troubleshooting/README.md)
問題解決とタスク実装
- **[一般的なタスク](troubleshooting/common-tasks.md)** - 頻出する実装パターン
- **[既知の問題](troubleshooting/known-issues.md)** - 制限事項とトラブルシューティング
- **[用語集](troubleshooting/glossary.md)** - プロジェクト用語の定義

### [📝 ドキュメント管理](documentation-guide.md)
このドキュメント構造の保守方法

## クイックスタート

新しいタスクを開始する際の推奨手順:

1. **基本理解**: [はじめに](guides/getting-started.md)でプロジェクト概要と基本原則を把握
2. **システム設計**: [アーキテクチャ](reference/architecture.md)でコンポーネント構造を理解
3. **コーディング**: [コーディング規約](guides/coding-guidelines.md)に従ってコードを作成
4. **タスク実装**: [一般的なタスク](troubleshooting/common-tasks.md)で類似パターンを参照
5. **問題解決**: [既知の問題](troubleshooting/known-issues.md)でトラブルシューティング

## プロジェクト概要

**DependViz**はコード依存関係をインタラクティブな2D/3D力学的グラフで可視化するVS Code拡張機能である.

### 主要機能
- 2D/3D力学的グラフ可視化
- Java(LSP経由)とJavaScript(Babelパーサ)のサポート
- ノード/エッジタイプによるインタラクティブなフィルタリング
- 依存スライス(前方/後方探索)

### 技術スタック
- **拡張機能**: Node.js, VS Code Extension API, LSP
- **Webview**: force-graph, 3d-force-graph, Three.js
- **Java解析器**: Java 21, JavaParser, LSP4J, Maven

## AIアシスタント向けガイドライン

### ✅ 実行すべきこと
1. **簡潔に保つ** - 単純明快なコードを優先
2. **既存パターンに従う** - 基底クラスを活用
3. **段階的にテスト** - 小さな変更で動作確認
4. **保守的にバグ修正** - 最小限の変更で問題解決

### ❌ 実行してはいけないこと
1. **過度な抽象化** - 3行の類似コードは許容される
2. **動作中のコードをリファクタリング** - 実際の問題がない限り修正しない
3. **過度なコメント** - 複雑なロジック以外はコメント不要
4. **自動的にテストを追加** - ユーザが要求しない限り不要

詳細は[はじめに](guides/getting-started.md#aiアシスタント向けガイドライン)を参照.

---

**最終更新**: 2026-01-02
**プロジェクトバージョン**: 1.0.4
