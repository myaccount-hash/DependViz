package com.example.parser.stage;

import java.util.List;

import com.example.parser.object.CodeGraph;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.Node;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.type.ClassOrInterfaceType;

public class ExtendsStage extends BaseStage {

  @Override
  protected List<? extends Node> extractNodes(CompilationUnit cu) {
    return cu.findAll(ClassOrInterfaceDeclaration.class);
  }

  @Override
  protected void processNode(Node node, CodeGraph codeGraph) throws Exception {
    ClassOrInterfaceDeclaration clazz = (ClassOrInterfaceDeclaration) node;
    String sourceClassName = getFullyQualifiedName(clazz);

    for (ClassOrInterfaceType extendedType : clazz.getExtendedTypes()) {
      try {
        var resolvedType = extendedType.resolve();
        String targetClassName = resolvedType.describe();
        codeGraph.addReferNode(sourceClassName, targetClassName, "Extends");
      } catch (Exception e) {
        // 型解決できない場合はスキップ
      }
    }
  }
}
