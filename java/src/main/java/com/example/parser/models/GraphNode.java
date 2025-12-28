package com.example.parser.models;

public class GraphNode {
  private final String nodeName;
  private final String id;
  private String type = "Unknown";
  private int linesOfCode = -1; // 行数フィールドを追加（初期値-1）
  private String filePath = null;

  GraphNode(String nodeName) {
    this.nodeName = nodeName;
    this.id = nodeName;
  }

  public String getNodeName() {
    return nodeName;
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
}
