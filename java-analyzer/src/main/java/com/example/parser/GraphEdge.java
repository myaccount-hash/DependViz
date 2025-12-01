package com.example.parser;

public class GraphEdge {
  private final GraphNode sourceNode;
  final private GraphNode targetNode;
  final private String id;
  private boolean visibility;
  private String type;

  public GraphEdge(GraphNode sourceNode, GraphNode targetNode, String type) {
    this.sourceNode = sourceNode;
    this.targetNode = targetNode;
    this.type = type;
    this.id = sourceNode.getNodeName() + " -> " + targetNode.getNodeName();
    this.visibility = true;
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

  public boolean getVisibility() {
    return visibility;
  }

  public void setVisibility(boolean visibility) {
    this.visibility = visibility;
  }

  public String getType() {
    return type;
  }

  public void setType(String type) {
    this.type = type;
  }
}
