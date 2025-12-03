package com.example.lsp;

import org.eclipse.lsp4j.DidChangeConfigurationParams;
import org.eclipse.lsp4j.DidChangeWatchedFilesParams;
import org.eclipse.lsp4j.services.WorkspaceService;

public class DependVizWorkspaceService implements WorkspaceService {

  @Override
  public void didChangeConfiguration(DidChangeConfigurationParams params) {
    // 設定変更時の処理（必要に応じて実装）
  }

  @Override
  public void didChangeWatchedFiles(DidChangeWatchedFilesParams params) {
    // ファイル監視変更時の処理（必要に応じて実装）
  }
}
