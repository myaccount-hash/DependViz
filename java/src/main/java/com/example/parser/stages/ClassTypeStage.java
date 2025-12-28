package com.example.parser.stages;

import java.util.List;
import java.util.function.Function;

import com.example.parser.models.CodeGraph;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.AnnotationDeclaration;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.EnumDeclaration;

public class ClassTypeStage extends BaseStage {

  @Override
  public void process(CompilationUnit cu, CodeGraph codeGraph) {
    List<ClassOrInterfaceDeclaration> classOrInterfaces =
        cu.findAll(ClassOrInterfaceDeclaration.class);

    // Classの収集
    for (ClassOrInterfaceDeclaration decl : classOrInterfaces) {
      String className = getFullyQualifiedName(decl);
      String type = determineClassType(decl); // Interface, AbstractClass, Classを判定
      codeGraph.setNodeType(className, type);
    }

    setNodeType(
        cu.findAll(EnumDeclaration.class),
        codeGraph,
        "Enum",
        decl -> decl.getFullyQualifiedName().orElse("Unknown"));
    setNodeType(
        cu.findAll(AnnotationDeclaration.class),
        codeGraph,
        "Annotation",
        decl -> decl.getFullyQualifiedName().orElse("Unknown"));

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

  private static <T> void setNodeType(
      List<T> decls,
      CodeGraph codeGraph,
      String type,
      Function<T, String> nameResolver) {
    for (T decl : decls) {
      codeGraph.setNodeType(nameResolver.apply(decl), type);
    }
  }
}
