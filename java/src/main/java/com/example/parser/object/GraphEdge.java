package com.example.parser.object;

public class GraphEdge {
  private final GraphNode sourceNode;
  final private GraphNode targetNode;
  final private String id;
  private String type;

  public GraphEdge(GraphNode sourceNode, GraphNode targetNode, String type) {
    this.sourceNode = sourceNode;
    this.targetNode = targetNode;
    this.type = type;
    this.id = sourceNode.getNodeName() + " -> " + targetNode.getNodeName();
  }

  public GraphNode getSourceNode() {
    return sourceNode;
  }

  public GraphNode getTargetNode() {
    return targetNode;
  }

  public String getId() {
    return id;
  }

  public String getType() {
    return type;
  }

  public void setType(String type) {
    this.type = type;
  }
}
