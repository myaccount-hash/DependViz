package com.example;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

import com.example.parser.Analyzer;
import com.example.parser.CodeGraph;
import com.example.parser.JsonUtil;
import com.example.parser.analyzer.ClassTypeAnalyzer;
import com.example.parser.analyzer.ExtendsAnalyzer;
import com.example.parser.analyzer.FilePathAnalyzer;
import com.example.parser.analyzer.ImplementsAnalyzer;
import com.example.parser.analyzer.LinesOfCodeAnalyzer;
import com.example.parser.analyzer.MethodCallAnalyzer;
import com.example.parser.analyzer.ObjectCreationAnalyzer;
import com.example.parser.analyzer.TypeUseAnalyzer;
import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.symbolsolver.JavaSymbolSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.CombinedTypeSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.JavaParserTypeSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.ReflectionTypeSolver;

public class Main {
  private static final Logger logger = Logger.getLogger(Main.class.getName());
  static final String OUTPUT_PATH = "data/sample.json";

  public static void main(String[] args) {
    // 単一ファイル解析のみをサポート
    // --file フラグは必須
    if (args.length < 2 || !"--file".equals(args[0])) {
      logger.log(Level.SEVERE, "Usage: java -jar java-graph.jar --file <file-path>");
      System.err.println("Error: --file flag and file path are required");
      System.exit(1);
      return;
    }

    String filePath = args[1];

    // ファイルが属するプロジェクトのソースルートを探す
    Path sourceFile = Paths.get(filePath);
    Path fileParent = sourceFile.getParent();
    Path srcMainJava = findSourceRoot(fileParent);
    String typeSolverRoot = srcMainJava != null ? srcMainJava.toString() : fileParent.toString();

    CombinedTypeSolver typeSolver = new CombinedTypeSolver(
        new ReflectionTypeSolver(), new JavaParserTypeSolver(typeSolverRoot));

    try {
      // 単一ファイル解析
      CodeGraph codeGraph = analyzeSingleFile(filePath, typeSolver);
      // 結果をJSONに出力
      JsonUtil.writeToFile(codeGraph, OUTPUT_PATH);
    } catch (IOException e) {
      logger.log(Level.SEVERE, "Failed to analyze file or write output", e);
      System.exit(1);
    }
  }

  // ファイルの親ディレクトリを遡ってsrc/main/javaを探す
  private static Path findSourceRoot(Path startPath) {
    Path current = startPath;
    while (current != null) {
      Path srcMainJava = current.resolve("src/main/java");
      if (Files.exists(srcMainJava)) {
        return srcMainJava;
      }
      current = current.getParent();
    }
    return null;
  }

  // 単一ファイルを解析するメソッド
  static CodeGraph analyzeSingleFile(String filePath, CombinedTypeSolver typeSolver) throws IOException {
    List<Analyzer> analyzers = List.of(
        new TypeUseAnalyzer(),
        new MethodCallAnalyzer(),
        new ObjectCreationAnalyzer(),
        new ExtendsAnalyzer(),
        new ImplementsAnalyzer(),
        new ClassTypeAnalyzer(),
        new LinesOfCodeAnalyzer(),
        new FilePathAnalyzer());

    CodeGraph codeGraph = new CodeGraph();
    Path path = Paths.get(filePath);

    if (!Files.exists(path)) {
      logger.log(Level.SEVERE, "File not found: {0}", filePath);
      return codeGraph;
    }

    if (!path.toString().endsWith(".java")) {
      logger.log(Level.SEVERE, "Not a Java file: {0}", filePath);
      return codeGraph;
    }

    // ファイルを解析
    logger.info(() -> "Analyzing: " + path);
    try {
      CompilationUnit cu = createCompilationUnit(filePath, typeSolver);
      analyzers.stream()
          .map(analyzer -> analyzer.process(cu))
          .forEach(codeGraph::merge);
    } catch (Exception e) {
      logger.log(Level.WARNING, e, () -> "Failed to parse file: " + path);
    }

    return codeGraph;
  }

  private static CompilationUnit createCompilationUnit(
      String filePath, CombinedTypeSolver typeSolver) throws Exception {
    JavaSymbolSolver symbolSolver = new JavaSymbolSolver(typeSolver);
    StaticJavaParser.getParserConfiguration().setSymbolResolver(symbolSolver);
    return StaticJavaParser.parse(new File(filePath));
  }
}
