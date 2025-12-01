#!/bin/bash

# テストプロジェクトのディレクトリ
TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_ROOT="$(cd "$TEST_DIR/.." && pwd)"
JAR_PATH="$WORKSPACE_ROOT/java-graph.jar"
DATA_DIR="$TEST_DIR/data"
OUTPUT_FILE="$DATA_DIR/sample.json"
FINAL_OUTPUT="$TEST_DIR/graph.json"

echo "=== Java Analyzer Test ==="
echo "Test directory: $TEST_DIR"
echo "JAR path: $JAR_PATH"
echo ""

# dataディレクトリを作成
mkdir -p "$DATA_DIR"

# 既存の出力ファイルを削除
rm -f "$OUTPUT_FILE" "$FINAL_OUTPUT"

# Java Analyzerを実行
echo "Running Java Analyzer..."
java -jar "$JAR_PATH" "$TEST_DIR/src/main/java"

# 結果を確認
if [ -f "$OUTPUT_FILE" ]; then
    echo "✓ Analysis completed successfully"
    echo ""

    # ファイルを移動
    mv "$OUTPUT_FILE" "$FINAL_OUTPUT"

    echo "=== Generated graph.json ==="
    echo "File size: $(wc -c < "$FINAL_OUTPUT") bytes"
    echo ""

    # ノード数とエッジ数を確認
    echo "=== Statistics ==="
    node_count=$(jq '.nodes | length' "$FINAL_OUTPUT" 2>/dev/null || echo "N/A")
    edge_count=$(jq '.links | length' "$FINAL_OUTPUT" 2>/dev/null || echo "N/A")
    echo "Nodes: $node_count"
    echo "Edges: $edge_count"
    echo ""

    # 静的メソッド呼び出しのエッジを検索
    echo "=== Static Method Calls (MethodCall edges) ==="
    jq '.links[] | select(.type == "MethodCall") | {source: .source, target: .target}' "$FINAL_OUTPUT" 2>/dev/null || echo "No MethodCall edges found or jq not available"
    echo ""

    # ノードの一覧を表示
    echo "=== Nodes ==="
    jq '.nodes[] | .id' "$FINAL_OUTPUT" 2>/dev/null || echo "Cannot display nodes or jq not available"
    echo ""

    echo "Full output saved to: $FINAL_OUTPUT"
else
    echo "✗ Analysis failed - output file not generated"
    exit 1
fi
