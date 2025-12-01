# スタックトレース表示のデバッグガイド

スタックトレースが表示されない場合、以下の手順で原因を特定してください。

## Step 1: 設定を確認

1. VSCode設定（`Cmd+,`）を開く
2. `forceGraphViewer.showStackTrace` を検索
3. ✅ チェックが入っていることを確認

または、設定JSONを直接確認：
```json
{
  "forceGraphViewer.showStackTrace": true
}
```

## Step 2: デバッグセッションが起動しているか確認

1. デバッグビューを開く（`Cmd+Shift+D`）
2. デバッグセッションが「実行中」になっているか確認
3. ブレークポイントで停止しているか確認

**重要:** スタックトレースは、ブレークポイントで**停止中**のスレッドからのみ収集されます。

## Step 3: Developer Tools Consoleを開く

1. `Help` > `Toggle Developer Tools` を選択
2. `Console` タブを開く
3. ブレークポイントで止まった時のログを確認

### 期待されるログ

#### バックエンド側（extension.js, stackTrace.js）

```
Captured 15 frames from thread 1 (main)
Debug session Java Debug: 1/2 threads stopped, 15 total frames captured
Updating stack trace visualization: 15 frames from 8 unique files
```

#### フロントエンド側（webview script.js）

```
[StackTrace] Received paths: 15 [Array of paths...]
[StackTrace] [0] Matched: /Users/.../Main.java -> com.test.Main
[StackTrace] [1] Matched: /Users/.../Service.java -> com.test.Service
...
[StackTrace] Created 14 stack trace links from 15 matched nodes
```

## Step 4: 問題パターン別の対処法

### パターン 1: バックエンドログが全く出ない

**原因:** イベントリスナーが登録されていない、または設定が無効

**確認:**
```javascript
// Developer Tools Console で実行
vscode.debug.activeDebugSession
// => null でなければセッションはアクティブ

vscode.debug.activeStackItem
// => 何か返ってくればブレークポイントで停止中
```

**対処:**
1. 拡張機能をリロード（`Developer: Reload Window`）
2. `forceGraphViewer.showStackTrace` 設定を確認

---

### パターン 2: "No active debug sessions found"

**原因:** デバッグセッションが起動していない

**対処:**
1. デバッグを開始
2. ブレークポイントを設定
3. ブレークポイントで停止させる

---

### パターン 3: "X/Y threads stopped, 0 total frames captured"

**原因:** 停止中のスレッドがあるがスタックフレームが取得できない

**考えられる理由:**
- デバッグアダプターがスタックトレース要求をサポートしていない
- スレッドが内部的には停止していない

**対処:**
1. 別のブレークポイントで試す
2. デバッグアダプターのログを確認

---

### パターン 4: "[StackTrace] Received paths: 0"

**原因:** フレームは取得できたがパスがない

**確認すべきこと:**
- フレームに `source.path` が含まれているか
- JDK内部のフレーム（パスなし）のみになっていないか

---

### パターン 5: "[StackTrace] NOT matched: /path/to/File.java"

**原因:** パスはあるがグラフのノードとマッチしない

**最も一般的な原因:**
- グラフに該当するファイルが含まれていない
- パスの形式が異なる

**対処:**

1. グラフのノード一覧を確認：
```javascript
// Developer Tools Console で実行（webview側）
console.log(state.data.nodes.map(n => ({ id: n.id, path: n.filePath })))
```

2. パスの形式を比較：
```
スタックトレースのパス: /Users/user/project/src/main/java/com/test/Main.java
グラフのノードのパス:   /Users/user/project/src/main/java/com/test/Main.java
```

3. グラフを再生成：
   - `DependViz: Analyze Java Project` を実行
   - 正しいソースディレクトリを選択

---

### パターン 6: リンクは作成されるが表示されない

**原因:** ビジュアル表示の問題

**確認:**
```javascript
// Developer Tools Console で実行（webview側）
console.log('Stack trace links:', state.ui.stackTraceLinks.size)
console.log('All links:', state.data.links.filter(l => l.isStackTraceLink))
```

**対処:**
1. グラフをリフレッシュ（`DependViz: Refresh`）
2. カラー設定を確認（スタックトレースは赤色 `#ff0000`）

---

## Step 5: マニュアルテスト

手動でスタックトレース更新をトリガー：

1. コマンドパレット（`Cmd+Shift+P`）を開く
2. `DependViz: Update Stack Trace` を実行
3. ログを確認

## Step 6: デバッグ情報の収集

問題が解決しない場合、以下の情報を収集：

1. **VSCode バージョン**
   ```
   Help > About
   ```

2. **拡張機能のログ**
   ```
   Developer Tools Console の全ログをコピー
   ```

3. **設定**
   ```json
   {
     "forceGraphViewer.showStackTrace": ...,
     "forceGraphViewer.javaSourceDirectory": ...
   }
   ```

4. **デバッグセッション情報**
   - デバッグアダプターの種類（Java, Node.js など）
   - launch.json の設定

5. **グラフの状態**
   ```javascript
   // Developer Tools Console で実行
   console.log('Nodes:', state.data.nodes.length)
   console.log('Links:', state.data.links.length)
   console.log('Sample node:', state.data.nodes[0])
   ```

## よくある解決策

### 最も多い原因TOP3

1. ✅ **設定が無効** → `showStackTrace` を有効化
2. ✅ **ブレークポイントで停止していない** → 停止させる
3. ✅ **パスマッチングの失敗** → グラフを再生成

### クイックフィックス

```bash
# 拡張機能をリロード
Cmd+Shift+P > "Developer: Reload Window"

# グラフを再生成
Cmd+Shift+P > "DependViz: Analyze Java Project"

# デバッグを再起動
F5（または再起動ボタン）
```

## 成功時の動作

正常に動作している場合：

1. ブレークポイントで停止
2. 数秒以内に赤色のリンクがグラフに表示される
3. リンクは太く、パーティクルアニメーション付き
4. コンソールに詳細なログが出力される

---

それでも解決しない場合は、このドキュメントの情報を添えてissueを報告してください。
