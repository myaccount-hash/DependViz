package com.example.parser.analyzer;

import java.util.List;

import com.example.parser.Analyzer;
import com.example.parser.CodeGraph;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.type.ClassOrInterfaceType;

public class ImplementsAnalyzer extends Analyzer {

  @Override
  public CodeGraph process(CompilationUnit cu) {
    List<ClassOrInterfaceDeclaration> classes = cu.findAll(ClassOrInterfaceDeclaration.class);
    CodeGraph codeGraph = new CodeGraph();

    for (ClassOrInterfaceDeclaration clazz : classes) {
      String sourceClassName = getFullyQualifiedName(clazz);

      for (ClassOrInterfaceType implementedType : clazz.getImplementedTypes()) {
        try {
          var resolvedType = implementedType.resolve();
          String targetClassName = resolvedType.describe();
          codeGraph.addReferNode(sourceClassName, targetClassName, "Implements");
        } catch (Exception e) {
          System.out.println(
              "Failed to resolve implements: "
                  + implementedType.asString()
                  + " - "
                  + e.getMessage());
        }
      }
    }

    return codeGraph;
  }
}
