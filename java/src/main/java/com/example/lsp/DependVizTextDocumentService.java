package com.example.lsp;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.logging.Level;
import java.util.logging.Logger;

import org.eclipse.lsp4j.DidChangeTextDocumentParams;
import org.eclipse.lsp4j.DidCloseTextDocumentParams;
import org.eclipse.lsp4j.DidOpenTextDocumentParams;
import org.eclipse.lsp4j.DidSaveTextDocumentParams;
import org.eclipse.lsp4j.services.TextDocumentService;

import com.example.parser.AnalysisEngine;
import com.example.parser.models.CodeGraph;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

public class DependVizTextDocumentService implements TextDocumentService {
  private static final Logger logger = Logger.getLogger(DependVizTextDocumentService.class.getName());

  // ファイルパスごとにCodeGraphをキャッシュ
  private final Map<String, CodeGraph> graphCache = new HashMap<>();

  // 解析エンジン
  private AnalysisEngine analysisEngine;

  public void setWorkspaceRoot(String workspaceRoot) {
    // ワークスペースルートが設定されたら解析エンジンを初期化
    try {
      String rootPath = URI.create(workspaceRoot).getPath();
      this.analysisEngine = new AnalysisEngine(rootPath);
      logger.info(() -> "Analysis engine initialized for workspace: " + rootPath);
    } catch (Exception e) {
      logger.log(Level.SEVERE, "Failed to initialize analysis engine", e);
    }
  }

  @Override
  public void didOpen(DidOpenTextDocumentParams params) {
    String uri = params.getTextDocument().getUri();
    logger.info(() -> "Document opened: " + uri);

    // Javaファイルのみ処理
    if (!uri.endsWith(".java")) {
      return;
    }

    String filePath = URI.create(uri).getPath();
    analyzeFile(filePath);
  }

  @Override
  public void didChange(DidChangeTextDocumentParams params) {
    String uri = params.getTextDocument().getUri();
    logger.info(() -> "Document changed: " + uri);

    // 変更時は再解析
    if (!uri.endsWith(".java")) {
      return;
    }

    String filePath = URI.create(uri).getPath();
    analyzeFile(filePath);
  }

  @Override
  public void didClose(DidCloseTextDocumentParams params) {
    String uri = params.getTextDocument().getUri();
    logger.info(() -> "Document closed: " + uri);

    // クローズ時はキャッシュから削除
    String filePath = URI.create(uri).getPath();
    graphCache.remove(filePath);
  }

  @Override
  public void didSave(DidSaveTextDocumentParams params) {
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
          () -> String.format(
              "Analyzed file: %s (%d nodes, %d edges)",
              filePath, graph.getGraphNodes().size(), graph.getGraphEdges().size()));
    } catch (Exception e) {
      logger.log(Level.SEVERE, e, () -> "Failed to analyze file: " + filePath);
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
          } catch (JsonProcessingException e) {
            logger.log(Level.SEVERE, e, () -> "Failed to serialize file dependency graph");
            return "{\"nodes\": [], \"links\": []}";
          }
        });
  }

  // JSON変換用データクラス
  private static class GraphDataJson {
    public java.util.List<NodeJson> nodes;
    public java.util.List<LinkJson> links;
  }

  @SuppressWarnings("all")
  private static class NodeJson {
    public String id;
    public String name;
    public String type;
    public int linesOfCode;
    public String filePath;
  }

  @SuppressWarnings("all")
  private static class LinkJson {
    public String source;
    public String target;
    public String type;
  }

  private GraphDataJson toJsonObject(CodeGraph codeGraph) {
    GraphDataJson json = new GraphDataJson();
    json.nodes = new java.util.ArrayList<>();
    json.links = new java.util.ArrayList<>();

    for (com.example.parser.models.GraphNode node : codeGraph.getGraphNodes()) {
      NodeJson nodeJson = new NodeJson();
      nodeJson.id = node.getId();
      nodeJson.name = node.getNodeName();
      nodeJson.type = node.getType();
      nodeJson.linesOfCode = node.getLinesOfCode();
      nodeJson.filePath = node.getFilePath();
      json.nodes.add(nodeJson);
    }

    for (com.example.parser.models.GraphEdge edge : codeGraph.getGraphEdges()) {
      LinkJson linkJson = new LinkJson();
      linkJson.source = edge.getSourceNode().getId();
      linkJson.target = edge.getTargetNode().getId();
      linkJson.type = edge.getType();
      json.links.add(linkJson);
    }

    return json;
  }
}
