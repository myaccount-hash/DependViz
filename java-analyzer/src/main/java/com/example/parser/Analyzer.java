package com.example.parser;

import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.Node;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;

public abstract class Analyzer {

  // 解析の実行を行う．抽象メソッド．
  public abstract CodeGraph process(CompilationUnit cu); 

  // 先祖のクラスノードを探索するユーティリティ
  @SuppressWarnings("unchecked") //  obj.findAncestor部分の警告を無視
  protected static String getSourceClassName(Node node) {
    return node.findAncestor(ClassOrInterfaceDeclaration.class)
        .flatMap(ClassOrInterfaceDeclaration::getFullyQualifiedName)
        .orElse("Unknown");
  }

  // 完全名取得用のユーティリティ
  protected static String getFullyQualifiedName(ClassOrInterfaceDeclaration clazz) {
    return clazz.getFullyQualifiedName().orElse("Unknown");
  }
}
