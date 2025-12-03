package com.example.parser.analyzer;

import com.example.parser.Analyzer;
import com.example.parser.CodeGraph;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.AnnotationDeclaration;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.EnumDeclaration;

public class FilePathAnalyzer extends Analyzer {

  @Override
  public CodeGraph process(CompilationUnit cu) {
    CodeGraph graph = new CodeGraph();
    
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
    
    return graph;
  }
}

