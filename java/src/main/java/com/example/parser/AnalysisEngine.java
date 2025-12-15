package com.example.parser;

import com.example.parser.analyzer.Analyzer;
import com.example.parser.analyzer.ClassTypeAnalyzer;
import com.example.parser.analyzer.ExtendsAnalyzer;
import com.example.parser.analyzer.FilePathAnalyzer;
import com.example.parser.analyzer.ImplementsAnalyzer;
import com.example.parser.analyzer.LinesOfCodeAnalyzer;
import com.example.parser.analyzer.MethodCallAnalyzer;
import com.example.parser.analyzer.ObjectCreationAnalyzer;
import com.example.parser.analyzer.TypeUseAnalyzer;
import com.example.parser.object.CodeGraph;
import com.github.javaparser.ParserConfiguration;
import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.symbolsolver.JavaSymbolSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.CombinedTypeSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.JavaParserTypeSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.ReflectionTypeSolver;
import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * 解析エンジン - 既存のアナライザロジックをラップ
 */
public class AnalysisEngine {
  private static final Logger logger = Logger.getLogger(AnalysisEngine.class.getName());

  private final CombinedTypeSolver typeSolver;
  private final List<Analyzer> analyzers;

  public AnalysisEngine(String workspaceRoot) {
    // TypeSolverの初期化
    this.typeSolver = new CombinedTypeSolver();
    this.typeSolver.add(new ReflectionTypeSolver());

    // ソースルートを探索
    Path sourceRoot = findSourceRoot(Paths.get(workspaceRoot));
    if (sourceRoot != null) {
      logger.log(Level.INFO, "Found source root: {0}", sourceRoot);
      this.typeSolver.add(new JavaParserTypeSolver(sourceRoot.toFile()));
    } else {
      logger.log(Level.WARNING, "Source root not found, using workspace root: {0}", workspaceRoot);
      this.typeSolver.add(new JavaParserTypeSolver(new File(workspaceRoot)));
    }

    // アナライザのパイプライン構築（TypeSolverは各Analyzerで内部設定）
    this.analyzers = new ArrayList<>();
    this.analyzers.add(new TypeUseAnalyzer());
    this.analyzers.add(new MethodCallAnalyzer());
    this.analyzers.add(new ObjectCreationAnalyzer());
    this.analyzers.add(new ExtendsAnalyzer());
    this.analyzers.add(new ImplementsAnalyzer());
    this.analyzers.add(new ClassTypeAnalyzer());
    this.analyzers.add(new LinesOfCodeAnalyzer());
    this.analyzers.add(new FilePathAnalyzer());

    logger.log(Level.INFO, "Analysis engine initialized with {0} analyzers", analyzers.size());
  }

  /**
   * 単一ファイルを解析
   */
  public CodeGraph analyzeFile(String filePath) throws Exception {
    logger.log(Level.INFO, "Analyzing file: {0}", filePath);

    CodeGraph codeGraph = new CodeGraph();
    Path path = Paths.get(filePath);

    try {
      CompilationUnit cu = createCompilationUnit(filePath, typeSolver);

      // 各アナライザを実行してマージ
      for (Analyzer analyzer : analyzers) {
        CodeGraph analyzerResult = analyzer.process(cu);
        codeGraph.merge(analyzerResult);
      }

      logger.log(
          Level.INFO,
          "Analysis completed: {0} nodes, {1} edges",
          new Object[] {codeGraph.getGraphNodes().size(), codeGraph.getGraphEdges().size()});

    } catch (Exception e) {
      logger.log(Level.WARNING, e, () -> "Failed to parse file: " + path);
      throw e;
    }

    return codeGraph;
  }

  /**
   * CompilationUnitを作成（既存のMain.javaから移植）
   */
  private static CompilationUnit createCompilationUnit(
      String filePath, CombinedTypeSolver typeSolver) throws Exception {
    ParserConfiguration parserConfiguration = new ParserConfiguration();
    JavaSymbolSolver symbolSolver = new JavaSymbolSolver(typeSolver);
    parserConfiguration.setSymbolResolver(symbolSolver);
    StaticJavaParser.setConfiguration(parserConfiguration);
    return StaticJavaParser.parse(Paths.get(filePath));
  }

  /**
   * ソースルートを探索（既存のMain.javaから移植）
   */
  private static Path findSourceRoot(Path startPath) {
    Path current = startPath;
    while (current != null) {
      Path candidate = current.resolve("src/main/java");
      if (candidate.toFile().exists() && candidate.toFile().isDirectory()) {
        return candidate;
      }
      current = current.getParent();
    }
    return null;
  }
}
