package com.example.parser.stage;

import com.example.parser.object.CodeGraph;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.AnnotationDeclaration;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.EnumDeclaration;

public class FilePathStage extends BaseStage {

  @Override
  public void process(CompilationUnit cu, CodeGraph graph) {
    cu.getStorage().ifPresent(storage -> {
      String filePath = storage.getPath().toString();
      
      cu.findAll(ClassOrInterfaceDeclaration.class).forEach(decl -> {
        String className = getFullyQualifiedName(decl);
        graph.setNodeFilePath(className, filePath);
      });
      
      cu.findAll(EnumDeclaration.class).forEach(decl -> {
        String enumName = decl.getFullyQualifiedName().orElse("Unknown");
        graph.setNodeFilePath(enumName, filePath);
      });
      
      cu.findAll(AnnotationDeclaration.class).forEach(decl -> {
        String annotationName = decl.getFullyQualifiedName().orElse("Unknown");
        graph.setNodeFilePath(annotationName, filePath);
      });
    });
    
  }
}
