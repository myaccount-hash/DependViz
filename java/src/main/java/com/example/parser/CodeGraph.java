package com.example.parser;

import java.util.ArrayList;
import java.util.List;

public class CodeGraph {
  private List<GraphNode> graphNodes;
  private List<GraphEdge> graphEdges;

  public CodeGraph() {
    this.graphNodes = new ArrayList<>();
    this.graphEdges = new ArrayList<>();
  }

  public List<GraphNode> getGraphNodes() {
    return graphNodes;
  }

  public List<GraphEdge> getGraphEdges() {
    return graphEdges;
  }

  public void printGraphNodes() {
    for (GraphNode graphNode : graphNodes) {
      System.out.println(graphNode.getNodeName());
      for (GraphNode referNode : graphNode.getReferNodes()) {
        System.out.println("  " + referNode.getNodeName());
      }
    }
  }

  public void addReferNode(String className, String referClassName, String edgeType) {
    GraphNode graphNode = getOrCreate(className);
    GraphNode referGraphNode = getOrCreate(referClassName);
    graphNode.addReferNode(referGraphNode);
    getOrCreateEdge(graphNode, referGraphNode, edgeType);
  }

  public void setNodeType(String className, String type) {
    GraphNode graphNode = getOrCreate(className);
    graphNode.setType(type);
  }

  public void setNodeLinesOfCode(String className, int linesOfCode) {
    GraphNode graphNode = getOrCreate(className);
    graphNode.setLinesOfCode(linesOfCode);
  }

  public void setNodeFilePath(String className, String filePath) {
    GraphNode graphNode = getOrCreate(className);
    graphNode.setFilePath(filePath);
  }

  private GraphNode getOrCreate(String className) {
    GraphNode graphNode = findGraphNode(className);
    if (graphNode == null) {
      graphNode = new GraphNode(className);
      graphNodes.add(graphNode);
    }
    return graphNode;
  }

  private GraphNode findGraphNode(String className) {
    for (GraphNode node : graphNodes) {
      if (node.getNodeName().equals(className)) {
        return node;
      }
    }
    return null;
  }

  private GraphEdge getOrCreateEdge(GraphNode source, GraphNode target, String edgeType) {
    GraphEdge existingEdge = findEdge(source, target, edgeType);
    if (existingEdge == null) {
      existingEdge = new GraphEdge(source, target, edgeType);
      graphEdges.add(existingEdge);
    }
    return existingEdge;
  }

  private GraphEdge findEdge(GraphNode source, GraphNode target, String edgeType) {
    for (GraphEdge edge : graphEdges) {
      if (edge.getSourceNode().equals(source)
          && edge.getTargetNode().equals(target)
          && edge.getType().equals(edgeType)) {
        return edge;
      }
    }
    return null;
  }

  public void merge(CodeGraph other) {
    // 他のCodeGraphのノードを追加
    for (GraphNode otherNode : other.graphNodes) {
      GraphNode existingNode = findGraphNode(otherNode.getNodeName());
      if (existingNode == null) {
        graphNodes.add(otherNode);
      } else {
        // 既存ノードの参照ノードをマージ
        for (GraphNode referNode : otherNode.getReferNodes()) {
          existingNode.addReferNode(referNode);
        }
        // タイプがUnknownの場合は上書き
        if ("Unknown".equals(existingNode.getType()) && !"Unknown".equals(otherNode.getType())) {
          existingNode.setType(otherNode.getType());
        }
        // 行数が-1の場合のみ上書き
        if (existingNode.getLinesOfCode() == -1 && otherNode.getLinesOfCode() != -1) {
          existingNode.setLinesOfCode(otherNode.getLinesOfCode());
        }
        // ファイルパスがnullの場合のみ上書き
        if (existingNode.getFilePath() == null && otherNode.getFilePath() != null) {
          existingNode.setFilePath(otherNode.getFilePath());
        }
      }
    }

    // 他のCodeGraphのエッジを追加
    for (GraphEdge otherEdge : other.graphEdges) {
      // エッジのソースとターゲットノードを現在のグラフで取得または作成
      GraphNode sourceNode = getOrCreate(otherEdge.getSourceNode().getNodeName());
      GraphNode targetNode = getOrCreate(otherEdge.getTargetNode().getNodeName());

      // エッジの重複チェックを行って追加
      getOrCreateEdge(sourceNode, targetNode, otherEdge.getType());
    }
  }
}
