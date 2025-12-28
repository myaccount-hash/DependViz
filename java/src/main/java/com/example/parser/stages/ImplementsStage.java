package com.example.parser.stages;

import java.util.List;

import com.example.parser.models.CodeGraph;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.Node;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.type.ClassOrInterfaceType;

public class ImplementsStage extends BaseStage {

  @Override
  protected List<? extends Node> extractNodes(CompilationUnit cu) {
    return cu.findAll(ClassOrInterfaceDeclaration.class);
  }

  @Override
  protected void processNode(Node node, CodeGraph codeGraph) throws Exception {
    ClassOrInterfaceDeclaration decl = (ClassOrInterfaceDeclaration) node;
    String sourceClassName = getFullyQualifiedName(decl);

    for (ClassOrInterfaceType implementedType : decl.getImplementedTypes()) {
      var resolvedType = implementedType.resolve();
      String targetClassName = resolvedType.describe();
      codeGraph.addReferNode(sourceClassName, targetClassName, "Implements");
    }
  }
}
