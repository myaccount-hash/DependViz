package com.example.parser.analyzer;

import java.util.List;

import com.example.parser.Analyzer;
import com.example.parser.CodeGraph;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.expr.ObjectCreationExpr;

public class ObjectCreationAnalyzer extends Analyzer {

  @Override
  public CodeGraph process(CompilationUnit cu) {
    List<ObjectCreationExpr> objectCreations = cu.findAll(ObjectCreationExpr.class);
    CodeGraph codeGraph = new CodeGraph();

    for (ObjectCreationExpr obj : objectCreations) {
      try {
        // ターゲットクラス名の取得
        var resolvedType = obj.getType().resolve();
        var referenceType = resolvedType.asReferenceType();
        String target = referenceType.getQualifiedName();

        // ソースクラス名の取得
        String source = getSourceClassName(obj);

        codeGraph.addReferNode(source, target, "ObjectCreate");

      } catch (Exception e) {
        System.out.println(
            "Failed to resolve: " + obj.getType().asString() + " - " + e.getMessage());
      }
    }
    return codeGraph;
  }
}
