package com.example;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.stream.Stream;

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
    // モード判定: --file フラグで単一ファイル解析
    boolean singleFileMode = args.length > 0 && "--file".equals(args[0]);

    String sourcePath;
    if (singleFileMode && args.length > 1) {
      sourcePath = args[1];
    } else if (!singleFileMode && args.length > 0) {
      sourcePath = args[0];
    } else {
      String currentDir = System.getProperty("user.dir");
      Path srcMainJava = Paths.get(currentDir, "src", "main", "java");
      if (Files.exists(srcMainJava)) {
        sourcePath = srcMainJava.toString();
      } else {
        sourcePath = currentDir;
      }
    }

    // JavaParserTypeSolver用のソースルートを決定
    Path sourceDir = Paths.get(sourcePath);
    String typeSolverRoot;

    if (singleFileMode) {
      // 単一ファイルの場合、そのファイルが属するプロジェクトのソースルートを探す
      Path fileParent = sourceDir.getParent();
      Path srcMainJava = findSourceRoot(fileParent);
      typeSolverRoot = srcMainJava != null ? srcMainJava.toString() : fileParent.toString();
    } else {
      // ディレクトリ解析の場合
      Path srcMainJava = sourceDir.resolve("src/main/java");
      typeSolverRoot = Files.exists(srcMainJava) ? srcMainJava.toString() : sourcePath;
    }

    CombinedTypeSolver typeSolver = new CombinedTypeSolver(
        new ReflectionTypeSolver(), new JavaParserTypeSolver(typeSolverRoot));

    try {
      CodeGraph mainCodeGraph;
      if (singleFileMode) {
        // 単一ファイル解析
        mainCodeGraph = analyzeSingleFile(sourcePath, typeSolver);
      } else {
        // 全てのファイルを解析（指定されたパスをそのまま使用）
        mainCodeGraph = analyzeAllFiles(sourcePath, OUTPUT_PATH, typeSolver);
      }
      // 結果をJSONに出力
      JsonUtil.writeToFile(mainCodeGraph, OUTPUT_PATH);
    } catch (IOException e) {
      logger.log(Level.SEVERE, "Failed to analyze files or write output", e);
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
      logger.log(Level.SEVERE, "File not found: " + filePath);
      return codeGraph;
    }

    if (!path.toString().endsWith(".java")) {
      logger.log(Level.SEVERE, "Not a Java file: " + filePath);
      return codeGraph;
    }

    analyzePath(path, typeSolver, analyzers).forEach(codeGraph::merge);
    return codeGraph;
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
    logger.info(() -> "Analyzing: " + path);
    try {
      CompilationUnit cu = createCompilationUnit(path.toString(), typeSolver);
      return analyzers.stream().map(analyzer -> analyzer.process(cu));
    } catch (IOException e) {
      logger.log(Level.WARNING, e, () -> "Failed to read file: " + path);
      return Stream.empty();
    } catch (Exception e) {
      logger.log(Level.WARNING, e, () -> "Failed to parse file: " + path);
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
