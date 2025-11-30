package com.example.parser.analyzer;

import java.util.List;

import com.example.parser.Analyzer;
import com.example.parser.CodeGraph;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.FieldDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.body.Parameter;
import com.github.javaparser.ast.body.VariableDeclarator;
import com.github.javaparser.ast.expr.VariableDeclarationExpr;

public class TypeUseAnalyzer extends Analyzer {

  @Override
  public CodeGraph process(CompilationUnit cu) {
    CodeGraph codeGraph = new CodeGraph();

    // クラスごとに処理
    List<ClassOrInterfaceDeclaration> classes = cu.findAll(ClassOrInterfaceDeclaration.class);
    for (ClassOrInterfaceDeclaration clazz : classes) {
      String className = getFullyQualifiedName(clazz);

      // フィールドの型使用
      for (FieldDeclaration field : clazz.getFields()) {
        try {
          String target = field.getElementType().resolve().describe();
          codeGraph.addReferNode(className, target, "TypeUse");
        } catch (Exception e) {
          // 型解決失敗時はスキップ
        }
      }

      // メソッドの型使用
      for (MethodDeclaration method : clazz.getMethods()) {
        // 戻り値型
        try {
          String target = method.getType().resolve().describe();
          codeGraph.addReferNode(className, target, "TypeUse");
        } catch (Exception e) {
        }
        // パラメータ型
        for (Parameter param : method.getParameters()) {
          try {
            String target = param.getType().resolve().describe();
            codeGraph.addReferNode(className, target, "TypeUse");
          } catch (Exception e) {
          }
        }
      }
    }

    // ローカル変数の型使用
    List<VariableDeclarationExpr> vars = cu.findAll(VariableDeclarationExpr.class);
    for (VariableDeclarationExpr var : vars) {
      for (VariableDeclarator declarator : var.getVariables()) {
        try {
          String target = declarator.getType().resolve().describe();
          String source = getSourceClassName(var);
          codeGraph.addReferNode(source, target, "TypeUse");
        } catch (Exception e) {
        }
      }
    }

    return codeGraph;
  }
}
