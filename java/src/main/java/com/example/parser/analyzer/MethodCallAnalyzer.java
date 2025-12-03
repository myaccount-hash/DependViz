package com.example.parser.analyzer;

import java.util.List;

import com.example.parser.Analyzer;
import com.example.parser.CodeGraph;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.Node;
import com.github.javaparser.ast.expr.MethodCallExpr;

public class MethodCallAnalyzer extends Analyzer {

  @Override
  protected List<? extends Node> extractNodes(CompilationUnit cu) {
    return cu.findAll(MethodCallExpr.class);
  }

  @Override
  protected void processNode(Node node, CodeGraph codeGraph) throws Exception {
    MethodCallExpr call = (MethodCallExpr) node;

    var resolved = call.resolve();
    String target = resolved.getPackageName() + "." + resolved.getClassName();
    String source = getSourceClassName(call);
    codeGraph.addReferNode(source, target, "MethodCall");
  }
}
