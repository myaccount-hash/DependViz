package com.example.lsp;

import java.util.concurrent.CompletableFuture;
import org.eclipse.lsp4j.jsonrpc.services.JsonRequest;

/**
 * カスタムリクエストハンドラ
 */
public interface DependVizCustomService {

  /**
   * プロジェクト全体の依存関係グラフを取得
   */
  @JsonRequest("dependviz/getDependencyGraph")
  CompletableFuture<String> getDependencyGraph();

  /**
   * 特定ファイルの依存関係グラフを取得
   */
  @JsonRequest("dependviz/getFileDependencyGraph")
  CompletableFuture<String> getFileDependencyGraph(String uri);
}
