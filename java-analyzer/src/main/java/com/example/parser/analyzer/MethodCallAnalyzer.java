package com.example.parser.analyzer;

import java.util.List;

import com.example.parser.Analyzer;
import com.example.parser.CodeGraph;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.expr.MethodCallExpr;

public class MethodCallAnalyzer extends Analyzer {
  @Override
  public CodeGraph process(CompilationUnit cu) {
    CodeGraph codeGraph = new CodeGraph();
    List<MethodCallExpr> calls = cu.findAll(MethodCallExpr.class);
    for (MethodCallExpr call : calls) {
      try {
        var resolved = call.resolve();
        String target = resolved.getPackageName() + "." + resolved.getClassName();
        String source = getSourceClassName(call);
        codeGraph.addReferNode(source, target, "MethodCall");
      } catch (Exception e) {
        // 型解決失敗時はスキップ
      }
    }
    return codeGraph;
  }
}
