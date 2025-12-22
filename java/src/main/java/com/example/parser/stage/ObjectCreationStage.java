package com.example.parser.stage;

import java.util.List;

import com.example.parser.object.CodeGraph;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.Node;
import com.github.javaparser.ast.expr.ObjectCreationExpr;

public class ObjectCreationStage extends BaseStage {

  @Override
  protected List<? extends Node> extractNodes(CompilationUnit cu) {
    return cu.findAll(ObjectCreationExpr.class);
  }

  @Override
  protected void processNode(Node node, CodeGraph codeGraph) throws Exception {
    ObjectCreationExpr obj = (ObjectCreationExpr) node;

    // ターゲットクラス名の取得
    var resolvedType = obj.getType().resolve();
    var referenceType = resolvedType.asReferenceType();
    String targetClassName = referenceType.getQualifiedName();

    // ソースクラス名の取得
    String sourceClassName = getSourceClassName(obj);

    codeGraph.addReferNode(sourceClassName, targetClassName, "ObjectCreate");
  }
}
