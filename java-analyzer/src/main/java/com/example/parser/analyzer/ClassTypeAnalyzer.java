package com.example.parser.analyzer;

import java.util.List;

import com.example.parser.Analyzer;
import com.example.parser.CodeGraph;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.AnnotationDeclaration;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.EnumDeclaration;

public class ClassTypeAnalyzer extends Analyzer {

  @Override
  public CodeGraph process(CompilationUnit cu) {
    CodeGraph codeGraph = new CodeGraph();

    List<ClassOrInterfaceDeclaration> classOrInterfaces =
        cu.findAll(ClassOrInterfaceDeclaration.class);

    // Classの収集
    for (ClassOrInterfaceDeclaration decl : classOrInterfaces) {
      String className = getFullyQualifiedName(decl);
      String type = determineClassType(decl); // Interface, AbstractClass, Classを判定
      codeGraph.setNodeType(className, type);
    }

    // Enumの収集
    List<EnumDeclaration> enums = cu.findAll(EnumDeclaration.class);
    for (EnumDeclaration enumDecl : enums) {
      String enumName = enumDecl.getFullyQualifiedName().orElse("Unknown");
      codeGraph.setNodeType(enumName, "Enum");
    }

    // アノテーションの収集
    List<AnnotationDeclaration> annotations = cu.findAll(AnnotationDeclaration.class);
    for (AnnotationDeclaration annotationDecl : annotations) {
      String annotationName = annotationDecl.getFullyQualifiedName().orElse("Unknown");
      codeGraph.setNodeType(annotationName, "Annotation");
    }

    return codeGraph;
  }

  private String determineClassType(ClassOrInterfaceDeclaration decl) {
    if (decl.isInterface()) {
      return "Interface";
    } else if (decl.isAbstract()) {
      return "AbstractClass";
    } else {
      return "Class";
    }
  }
}
