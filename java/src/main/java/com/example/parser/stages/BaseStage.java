package com.example.parser.stages;

import java.util.List;
import java.util.logging.Logger;

import com.example.parser.models.CodeGraph;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.Node;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;

public abstract class BaseStage {

  private static final Logger logger = Logger.getLogger(BaseStage.class.getName());

  // Pipeline Stage - 共通の処理フローを定義（デフォルト実装）
  public void process(CompilationUnit cu, CodeGraph codeGraph) {
    List<? extends Node> nodes = extractNodes(cu);

    for (Node node : nodes) {
      try {
        processNode(node, codeGraph);
      } catch (Exception e) {
        handleError(node, e);
      }
    }
  }

  // サブクラスで実装: 解析対象のノードを抽出（オプション）
  protected List<? extends Node> extractNodes(CompilationUnit cu) {
    return List.of();
  }

  // サブクラスで実装: ノードを処理してグラフに追加（オプション）
  protected void processNode(Node node, CodeGraph codeGraph) throws Exception {
    // デフォルトは何もしない
  }

  // エラーハンドリング（オーバーライド可能）
  protected void handleError(Node node, Exception e) {
    logger.warning(
        () -> "Failed to process node: " + node + " - " + e.getMessage());
  }

  // 先祖のクラスノードを探索するユーティリティ
  @SuppressWarnings("unchecked")
  protected static String getSourceClassName(Node node) {
    return node.findAncestor(ClassOrInterfaceDeclaration.class)
        .flatMap(ClassOrInterfaceDeclaration::getFullyQualifiedName)
        .orElse("Unknown");
  }

  // 完全名取得用のユーティリティ
  protected static String getFullyQualifiedName(ClassOrInterfaceDeclaration clazz) {
    return clazz.getFullyQualifiedName().orElse("Unknown");
  }
}
