package com.example.parser.stages;

import java.util.List;
import java.util.function.Function;

import com.example.parser.models.CodeGraph;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.AnnotationDeclaration;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.EnumDeclaration;

public class FilePathStage extends BaseStage {

  @Override
  public void process(CompilationUnit cu, CodeGraph codeGraph) {
    cu.getStorage().ifPresent(storage -> {
      String filePath = storage.getPath().toString();

      setFilePath(
          cu.findAll(ClassOrInterfaceDeclaration.class),
          codeGraph,
          filePath,
          BaseStage::getFullyQualifiedName);
      setFilePath(
          cu.findAll(EnumDeclaration.class),
          codeGraph,
          filePath,
          decl -> decl.getFullyQualifiedName().orElse("Unknown"));
      setFilePath(
          cu.findAll(AnnotationDeclaration.class),
          codeGraph,
          filePath,
          decl -> decl.getFullyQualifiedName().orElse("Unknown"));
    });
  }

  private static <T> void setFilePath(
      List<T> decls,
      CodeGraph graph,
      String filePath,
      Function<T, String> nameResolver) {
    for (T decl : decls) {
      graph.setNodeFilePath(nameResolver.apply(decl), filePath);
    }
  }
}
