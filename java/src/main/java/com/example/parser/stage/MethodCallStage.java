package com.example.parser.stage;

import java.util.List;

import com.example.parser.object.CodeGraph;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.Node;
import com.github.javaparser.ast.expr.MethodCallExpr;

public class MethodCallStage extends BaseStage {

  @Override
  protected List<? extends Node> extractNodes(CompilationUnit cu) {
    return cu.findAll(MethodCallExpr.class);
  }

  @Override
  protected void processNode(Node node, CodeGraph codeGraph) throws Exception {
    MethodCallExpr call = (MethodCallExpr) node;

    var resolved = call.resolve();
    String targetClassName = resolved.getPackageName() + "." + resolved.getClassName();
    String sourceClassName = getSourceClassName(call);
    codeGraph.addReferNode(sourceClassName, targetClassName, "MethodCall");
  }
}
