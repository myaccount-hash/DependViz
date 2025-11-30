package com.example.parser;

import java.io.IOException;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;

public class JsonUtil {
  private static class CodeGraphJson {
    public List<GraphNodeJson> nodes;
    public List<GraphEdgeJson> links;
  }

  private static class GraphNodeJson {
    public String id;
    public String name;
    public String type;
    public int linesOfCode;
    public String filePath;
  }

  private static class GraphEdgeJson {
    public String source;
    public String target;
    public String type;
  }

  // CodeGraph → CodeGraphJson 変換
  private static CodeGraphJson toJsonObject(CodeGraph codeGraph) {
    CodeGraphJson json = new CodeGraphJson();
    json.nodes = new ArrayList<>();
    json.links = new ArrayList<>();
    for (GraphNode node : codeGraph.getGraphNodes()) {
      GraphNodeJson nodeJson = new GraphNodeJson();
      nodeJson.id = node.getId();
      nodeJson.name = node.getNodeName();
      nodeJson.type = node.getType();
      nodeJson.linesOfCode = node.getLinesOfCode();
      nodeJson.filePath = node.getFilePath();
      json.nodes.add(nodeJson);
    }
    for (GraphEdge edge : codeGraph.getGraphEdges()) {
      GraphEdgeJson edgeJson = new GraphEdgeJson();
      edgeJson.source = edge.getSourceNode().getId();
      edgeJson.target = edge.getTargetNode().getId();
      edgeJson.type = edge.getType();
      json.links.add(edgeJson);
    }
    return json;
  }

  // CodeGraphをファイルに書き込む
  public static void writeToFile(CodeGraph codeGraph, String filePath) throws IOException {
    ObjectMapper mapper = new ObjectMapper();
    CodeGraphJson json = toJsonObject(codeGraph);
    mapper.writerWithDefaultPrettyPrinter().writeValue(Paths.get(filePath).toFile(), json);
  }
}
