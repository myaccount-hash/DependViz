package com.example.parser.analyzer;

import java.util.List;

import com.example.parser.Analyzer;
import com.example.parser.CodeGraph;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.AnnotationDeclaration;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.EnumDeclaration;

/** クラス，インターフェース，Enum，アノテーションの行数を収集するAnalyzer */
public class LinesOfCodeAnalyzer extends Analyzer {

  @Override
  public CodeGraph process(CompilationUnit cu) {
    CodeGraph codeGraph = new CodeGraph();

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

    return codeGraph;
  }

  /** ノードの行数を計算 開始行と終了行の差分で計算（コメントや空行も含む） */
  private int calculateLinesOfCode(ClassOrInterfaceDeclaration node) {
    return node.getRange().map(range -> range.end.line - range.begin.line + 1).orElse(0);
  }

  /** Enumの行数を計算 */
  private int calculateLinesOfCode(EnumDeclaration node) {
    return node.getRange().map(range -> range.end.line - range.begin.line + 1).orElse(0);
  }

  /** アノテーションの行数を計算 */
  private int calculateLinesOfCode(AnnotationDeclaration node) {
    return node.getRange().map(range -> range.end.line - range.begin.line + 1).orElse(0);
  }
}
