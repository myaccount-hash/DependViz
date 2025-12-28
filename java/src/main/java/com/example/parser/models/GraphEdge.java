package com.example.parser.models;

public class GraphEdge {
  private final GraphNode sourceNode;
  private final GraphNode targetNode;
  private final String type;

  public GraphEdge(GraphNode sourceNode, GraphNode targetNode, String type) {
    this.sourceNode = sourceNode;
    this.targetNode = targetNode;
    this.type = type;
  }

  public GraphNode getSourceNode() {
    return sourceNode;
  }

  public GraphNode getTargetNode() {
    return targetNode;
  }

  public String getType() {
    return type;
  }
}
