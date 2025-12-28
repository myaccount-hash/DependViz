package com.example.parser;

import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

import com.example.parser.models.CodeGraph;
import com.example.parser.stages.BaseStage;
import com.example.parser.stages.ClassTypeStage;
import com.example.parser.stages.ExtendsStage;
import com.example.parser.stages.FilePathStage;
import com.example.parser.stages.ImplementsStage;
import com.example.parser.stages.LinesOfCodeStage;
import com.example.parser.stages.MethodCallStage;
import com.example.parser.stages.ObjectCreationStage;
import com.example.parser.stages.TypeUseStage;
import com.github.javaparser.ParserConfiguration;
import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.symbolsolver.JavaSymbolSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.CombinedTypeSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.JavaParserTypeSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.ReflectionTypeSolver;

/**
 * 解析エンジン - 既存のステージロジックをラップ
 */
public class AnalysisEngine {
  private static final Logger logger = Logger.getLogger(AnalysisEngine.class.getName());

  private final CombinedTypeSolver typeSolver;
  private final List<BaseStage> stages;

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

    // ステージのパイプライン構築（TypeSolverは各Stageで内部設定）
    this.stages = new ArrayList<>();
    this.stages.add(new TypeUseStage());
    this.stages.add(new MethodCallStage());
    this.stages.add(new ObjectCreationStage());
    this.stages.add(new ExtendsStage());
    this.stages.add(new ImplementsStage());
    this.stages.add(new ClassTypeStage());
    this.stages.add(new LinesOfCodeStage());
    this.stages.add(new FilePathStage());

    logger.log(Level.INFO, "Analysis engine initialized with {0} stages", stages.size());
  }

  /**
   * 単一ファイルを解析
   */
  public CodeGraph analyzeFile(String filePath) throws Exception {
    logger.log(Level.INFO, "Analyzing file: {0}", filePath);

    CodeGraph codeGraph = new CodeGraph();
    try {
      CompilationUnit cu = createCompilationUnit(filePath, typeSolver);

      // パイプラインとして順に実行
      for (BaseStage stage : stages) {
        stage.process(cu, codeGraph);
      }

      logger.log(
          Level.INFO,
          "Analysis completed: {0} nodes, {1} edges",
          new Object[] {codeGraph.getGraphNodes().size(), codeGraph.getGraphEdges().size()});

    } catch (Exception e) {
      logger.log(Level.WARNING, e, () -> "Failed to parse file: " + filePath);
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
    // TODO: 言語レベルの対応
    parserConfiguration.setLanguageLevel(ParserConfiguration.LanguageLevel.JAVA_21);
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
