package com.example.parser.stages;

import java.util.List;

import com.example.parser.models.CodeGraph;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.Node;
import com.github.javaparser.ast.body.AnnotationDeclaration;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.EnumDeclaration;

/** クラス，インターフェース，Enum，アノテーションの行数を収集するStage */
public class LinesOfCodeStage extends BaseStage {

  @Override
  public void process(CompilationUnit cu, CodeGraph codeGraph) {
    // クラス/インターフェースの行数収集
    List<ClassOrInterfaceDeclaration> classOrInterfaces = cu.findAll(ClassOrInterfaceDeclaration.class);

    for (ClassOrInterfaceDeclaration decl : classOrInterfaces) {
      String className = getFullyQualifiedName(decl);
      int linesOfCode = calculateLinesOfCode(decl);
      codeGraph.setNodeLinesOfCode(className, linesOfCode);
    }

    // Enumの行数収集
    List<EnumDeclaration> enums = cu.findAll(EnumDeclaration.class);
    for (EnumDeclaration enumDecl : enums) {
      String enumName = enumDecl.getFullyQualifiedName().orElse("Unknown");
      int linesOfCode = calculateLinesOfCode(enumDecl);
      codeGraph.setNodeLinesOfCode(enumName, linesOfCode);
    }

    // アノテーションの行数収集
    List<AnnotationDeclaration> annotations = cu.findAll(AnnotationDeclaration.class);
    for (AnnotationDeclaration annotationDecl : annotations) {
      String annotationName = annotationDecl.getFullyQualifiedName().orElse("Unknown");
      int linesOfCode = calculateLinesOfCode(annotationDecl);
      codeGraph.setNodeLinesOfCode(annotationName, linesOfCode);
    }

  }

  /** ノードの行数を計算 開始行と終了行の差分で計算（コメントや空行も含む） */
  private int calculateLinesOfCode(Node node) {
    return node.getRange().map(range -> range.end.line - range.begin.line + 1).orElse(0);
  }
}
