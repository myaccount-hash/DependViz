package com.example;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.stream.Stream;

import com.example.parser.Analyzer;
import com.example.parser.CodeGraph;
import com.example.parser.JsonUtil;
import com.example.parser.analyzer.*;
import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.symbolsolver.JavaSymbolSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.*;

public class Main {
  static final String OUTPUT_PATH = "data/sample.json";

  public static void main(String[] args) {
    String rootPackagePath;
    if (args.length > 0) {
      rootPackagePath = args[0];
    } else {
      String currentDir = System.getProperty("user.dir");
      Path srcMainJava = Paths.get(currentDir, "src", "main", "java");
      if (Files.exists(srcMainJava)) {
        rootPackagePath = srcMainJava.toString();
      } else {
        rootPackagePath = currentDir;
      }
    }

    CombinedTypeSolver typeSolver = new CombinedTypeSolver(
        new ReflectionTypeSolver(), new JavaParserTypeSolver(rootPackagePath));

    try {
      // 全てのファイルを解析
      CodeGraph mainCodeGraph = analyzeAllFiles(rootPackagePath, OUTPUT_PATH, typeSolver);
      // 結果をJSONに出力
      JsonUtil.writeToFile(mainCodeGraph, OUTPUT_PATH);
    } catch (Exception e) {
      e.printStackTrace();
      System.exit(1);
    }
  }

  // 全てのファイルを解析するメソッド
  static CodeGraph analyzeAllFiles(
      String rootPath, String outputPath, CombinedTypeSolver typeSolver) throws IOException {
    List<Analyzer> analyzers = List.of(
        new TypeUseAnalyzer(),
        new MethodCallAnalyzer(),
        new ObjectCreationAnalyzer(),
        new ExtendsAnalyzer(),
        new ImplementsAnalyzer(),
        new ClassTypeAnalyzer(),
        new LinesOfCodeAnalyzer(),
        new FilePathAnalyzer());

    CodeGraph mainCodeGraph = new CodeGraph();
    Path sourceDir = Paths.get(rootPath);
    Files.walk(sourceDir) // ディレクトリを探索
        .filter(path -> path.toString().endsWith(".java")) // .javaファイルのみをフィルタ
        .flatMap(path -> analyzePath(path, typeSolver, analyzers)) // CodeGraphに変換
        .forEach(mainCodeGraph::merge); // 全てのCodeGraphをマージ
    return mainCodeGraph;
  }

  private static Stream<CodeGraph> analyzePath(Path path, CombinedTypeSolver typeSolver, List<Analyzer> analyzers) {
    System.out.println("Analyzing: " + path);
    try {
      CompilationUnit cu = createCompilationUnit(path.toString(), typeSolver);
      return analyzers.stream().map(analyzer -> analyzer.process(cu));
    } catch (Exception e) {
      System.err.println("Error: " + path + ": " + e.getMessage());
      return Stream.empty();
    }
  }

  private static CompilationUnit createCompilationUnit(
      String filePath, CombinedTypeSolver typeSolver) throws Exception {
    JavaSymbolSolver symbolSolver = new JavaSymbolSolver(typeSolver);
    StaticJavaParser.getParserConfiguration().setSymbolResolver(symbolSolver);
    return StaticJavaParser.parse(new File(filePath));
  }
}
