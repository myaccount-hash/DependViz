package com.example.parser.analyzer;

import java.util.List;

import com.example.parser.Analyzer;
import com.example.parser.CodeGraph;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.Node;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.type.ClassOrInterfaceType;

public class ExtendsAnalyzer extends Analyzer {

  @Override
  protected List<? extends Node> extractNodes(CompilationUnit cu) {
    return cu.findAll(ClassOrInterfaceDeclaration.class);
  }

  @Override
  protected void processNode(Node node, CodeGraph codeGraph) throws Exception {
    ClassOrInterfaceDeclaration clazz = (ClassOrInterfaceDeclaration) node;
    String sourceClassName = getFullyQualifiedName(clazz);

    for (ClassOrInterfaceType extendedType : clazz.getExtendedTypes()) {
      var resolvedType = extendedType.resolve();
      String targetClassName = resolvedType.describe();
      codeGraph.addReferNode(sourceClassName, targetClassName, "Extends");
    }
  }
}
