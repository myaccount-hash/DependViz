package com.example.parser.models;

import java.util.ArrayList;
import java.util.List;

public class CodeGraph {
  private final List<GraphNode> graphNodes;
  private final List<GraphEdge> graphEdges;

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

  public void addReferNode(String className, String referClassName, String edgeType) {
    GraphNode graphNode = getOrCreate(className);
    GraphNode referGraphNode = getOrCreate(referClassName);
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

}
