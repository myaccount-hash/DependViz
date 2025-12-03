package com.example.lsp;

import com.example.parser.AnalysisEngine;
import com.example.parser.CodeGraph;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.eclipse.lsp4j.DidChangeTextDocumentParams;
import org.eclipse.lsp4j.DidCloseTextDocumentParams;
import org.eclipse.lsp4j.DidOpenTextDocumentParams;
import org.eclipse.lsp4j.DidSaveTextDocumentParams;
import org.eclipse.lsp4j.services.LanguageClient;
import org.eclipse.lsp4j.services.LanguageClientAware;
import org.eclipse.lsp4j.services.TextDocumentService;

public class DependVizTextDocumentService
    implements TextDocumentService, LanguageClientAware {
  private static final Logger logger =
      Logger.getLogger(DependVizTextDocumentService.class.getName());

  private final DependVizLanguageServer server;
  private LanguageClient client;
  private String workspaceRoot;

  // ファイルパスごとにCodeGraphをキャッシュ
  private final Map<String, CodeGraph> graphCache = new HashMap<>();

  // 解析エンジン
  private AnalysisEngine analysisEngine;

  public DependVizTextDocumentService(DependVizLanguageServer server) {
    this.server = server;
  }

  @Override
  public void connect(LanguageClient client) {
    this.client = client;
  }

  public void setWorkspaceRoot(String workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    // ワークスペースルートが設定されたら解析エンジンを初期化
    try {
      String rootPath = URI.create(workspaceRoot).getPath();
      this.analysisEngine = new AnalysisEngine(rootPath);
      logger.info("Analysis engine initialized for workspace: " + rootPath);
    } catch (Exception e) {
      logger.log(Level.SEVERE, "Failed to initialize analysis engine", e);
    }
  }

  @Override
  public void didOpen(DidOpenTextDocumentParams params) {
    String uri = params.getTextDocument().getUri();
    logger.info("Document opened: " + uri);

    // Javaファイルのみ処理
    if (!uri.endsWith(".java")) {
      return;
    }

    try {
      String filePath = URI.create(uri).getPath();
      analyzeFile(filePath);
    } catch (Exception e) {
      logger.log(Level.SEVERE, "Failed to analyze opened file: " + uri, e);
    }
  }

  @Override
  public void didChange(DidChangeTextDocumentParams params) {
    String uri = params.getTextDocument().getUri();
    logger.info("Document changed: " + uri);

    // 変更時は再解析
    if (!uri.endsWith(".java")) {
      return;
    }

    try {
      String filePath = URI.create(uri).getPath();
      analyzeFile(filePath);
    } catch (Exception e) {
      logger.log(Level.SEVERE, "Failed to analyze changed file: " + uri, e);
    }
  }

  @Override
  public void didClose(DidCloseTextDocumentParams params) {
    String uri = params.getTextDocument().getUri();
    logger.info("Document closed: " + uri);

    // クローズ時はキャッシュから削除
    try {
      String filePath = URI.create(uri).getPath();
      graphCache.remove(filePath);
    } catch (Exception e) {
      logger.log(Level.WARNING, "Failed to handle closed file: " + uri, e);
    }
  }

  @Override
  public void didSave(DidSaveTextDocumentParams params) {
    String uri = params.getTextDocument().getUri();
    logger.info("Document saved: " + uri);
  }

  /**
   * 単一ファイルを解析してキャッシュに保存
   */
  private void analyzeFile(String filePath) {
    try {
      if (analysisEngine == null) {
        logger.warning("Analysis engine not initialized");
        return;
      }

      CodeGraph graph = analysisEngine.analyzeFile(filePath);
      graphCache.put(filePath, graph);

      logger.info(
          String.format(
              "Analyzed file: %s (%d nodes, %d edges)",
              filePath, graph.getGraphNodes().size(), graph.getGraphEdges().size()));
    } catch (Exception e) {
      logger.log(Level.SEVERE, "Failed to analyze file: " + filePath, e);
    }
  }

  /**
   * カスタムリクエスト: 単一ファイルのグラフデータを取得
   */
  public CompletableFuture<String> getFileDependencyGraph(String uri) {
    return CompletableFuture.supplyAsync(
        () -> {
          try {
            String filePath = URI.create(uri).getPath();
            CodeGraph graph = graphCache.get(filePath);

            if (graph == null) {
              // キャッシュにない場合は解析
              analyzeFile(filePath);
              graph = graphCache.get(filePath);
            }

            if (graph == null) {
              return "{\"nodes\": [], \"links\": []}";
            }

            ObjectMapper mapper = new ObjectMapper();
            GraphDataJson json = toJsonObject(graph);
            return mapper.writeValueAsString(json);
          } catch (Exception e) {
            logger.log(Level.SEVERE, "Failed to serialize file dependency graph", e);
            return "{\"nodes\": [], \"links\": []}";
          }
        });
  }

  // JSON変換用データクラス
  private static class GraphDataJson {
    public java.util.List<NodeJson> nodes;
    public java.util.List<LinkJson> links;
  }

  private static class NodeJson {
    public String id;
    public String name;
    public String type;
    public int linesOfCode;
    public String filePath;
  }

  private static class LinkJson {
    public String source;
    public String target;
    public String type;
  }

  private GraphDataJson toJsonObject(CodeGraph codeGraph) {
    GraphDataJson json = new GraphDataJson();
    json.nodes = new java.util.ArrayList<>();
    json.links = new java.util.ArrayList<>();

    for (com.example.parser.GraphNode node : codeGraph.getGraphNodes()) {
      NodeJson nodeJson = new NodeJson();
      nodeJson.id = node.getId();
      nodeJson.name = node.getNodeName();
      nodeJson.type = node.getType();
      nodeJson.linesOfCode = node.getLinesOfCode();
      nodeJson.filePath = node.getFilePath();
      json.nodes.add(nodeJson);
    }

    for (com.example.parser.GraphEdge edge : codeGraph.getGraphEdges()) {
      LinkJson linkJson = new LinkJson();
      linkJson.source = edge.getSourceNode().getId();
      linkJson.target = edge.getTargetNode().getId();
      linkJson.type = edge.getType();
      json.links.add(linkJson);
    }

    return json;
  }
}
