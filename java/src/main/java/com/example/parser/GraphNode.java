package com.example.parser;

import java.util.ArrayList;
import java.util.List;

public class GraphNode {
  final private String nodeName;
  final private List<GraphNode> referNodes;
  final private String id;
  private String type = "Unknown";
  private int linesOfCode = -1; // 行数フィールドを追加（初期値-1）
  private String filePath = null;

  GraphNode(String nodeName) {
    this.nodeName = nodeName;
    this.referNodes = new ArrayList<>();
    this.id = nodeName;
    this.type = "Unknown";
    this.linesOfCode = -1;
  }

  public String getNodeName() {
    return nodeName;
  }

  public List<GraphNode> getReferNodes() {
    return referNodes;
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

  public void setLinesOfCode(int linesOfCode) {
    this.linesOfCode = linesOfCode;
  }

  public int getLinesOfCode() {
    return linesOfCode;
  }

  public void setFilePath(String filePath) {
    this.filePath = filePath;
  }

  public String getFilePath() {
    return filePath;
  }

  public void addReferNode(GraphNode referNode) {
    this.referNodes.add(referNode);
  }
}
