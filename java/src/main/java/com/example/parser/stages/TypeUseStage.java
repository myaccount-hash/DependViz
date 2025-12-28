package com.example.parser.stages;

import java.util.List;

import com.example.parser.models.CodeGraph;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.FieldDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.body.Parameter;
import com.github.javaparser.ast.body.VariableDeclarator;
import com.github.javaparser.ast.expr.VariableDeclarationExpr;

public class TypeUseStage extends BaseStage {

  @Override
  public void process(CompilationUnit cu, CodeGraph codeGraph) {
    // クラスごとに処理
    List<ClassOrInterfaceDeclaration> classes = cu.findAll(ClassOrInterfaceDeclaration.class);
    for (ClassOrInterfaceDeclaration decl : classes) {
      String className = getFullyQualifiedName(decl);

      // フィールドの型使用
      for (FieldDeclaration field : decl.getFields()) {
        try {
          String target = field.getElementType().resolve().describe();
          codeGraph.addReferNode(className, target, "TypeUse");
        } catch (Exception e) {
          // 型解決失敗時はスキップ
        }
      }

      // メソッドの型使用
      for (MethodDeclaration method : decl.getMethods()) {
        // 戻り値型
        String target = method.getType().resolve().describe();
        codeGraph.addReferNode(className, target, "TypeUse");
        // パラメータ型
        for (Parameter param : method.getParameters()) {
          String paramTarget = param.getType().resolve().describe();
          codeGraph.addReferNode(className, paramTarget, "TypeUse");
        }
      }
    }

    // ローカル変数の型使用
    List<VariableDeclarationExpr> vars = cu.findAll(VariableDeclarationExpr.class);
    for (VariableDeclarationExpr var : vars) {
      for (VariableDeclarator declarator : var.getVariables()) {
        String target = declarator.getType().resolve().describe();
        String source = getSourceClassName(var);
        codeGraph.addReferNode(source, target, "TypeUse");
      }
    }

  }
}
