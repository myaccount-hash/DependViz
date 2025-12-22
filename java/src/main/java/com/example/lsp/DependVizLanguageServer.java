package com.example.lsp;

import java.io.InputStream;
import java.io.OutputStream;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.logging.Level;
import java.util.logging.Logger;

import org.eclipse.lsp4j.DidChangeConfigurationParams;
import org.eclipse.lsp4j.DidChangeWatchedFilesParams;
import org.eclipse.lsp4j.InitializeParams;
import org.eclipse.lsp4j.InitializeResult;
import org.eclipse.lsp4j.ServerCapabilities;
import org.eclipse.lsp4j.TextDocumentSyncKind;
import org.eclipse.lsp4j.TextDocumentSyncOptions;
import org.eclipse.lsp4j.WorkspaceFolder;
import org.eclipse.lsp4j.jsonrpc.services.JsonRequest;
import org.eclipse.lsp4j.services.LanguageClient;
import org.eclipse.lsp4j.services.LanguageServer;
import org.eclipse.lsp4j.services.TextDocumentService;
import org.eclipse.lsp4j.services.WorkspaceService;

public class DependVizLanguageServer implements LanguageServer {
  private static final Logger logger = Logger.getLogger(DependVizLanguageServer.class.getName());

  private final DependVizTextDocumentService textDocumentService;
  private final WorkspaceService workspaceService;
  private int errorCode = 1;

  public DependVizLanguageServer() {
    this.textDocumentService = new DependVizTextDocumentService();
    this.workspaceService = new NoOpWorkspaceService();
  }

  // カスタムリクエストハンドラの実装
  @JsonRequest("dependviz/getFileDependencyGraph")
  public CompletableFuture<String> getFileDependencyGraph(String uri) {
    return textDocumentService.getFileDependencyGraph(uri);
  }

  @Override
  public CompletableFuture<InitializeResult> initialize(InitializeParams params) {
    logger.info("Initializing DependViz Language Server");

    // ワークスペースルートを取得
    String workspaceRoot = resolveWorkspaceRoot(params);
    logger.log(Level.INFO, "Workspace root: {0}", workspaceRoot);

    // TextDocumentServiceにワークスペースルートを設定
    textDocumentService.setWorkspaceRoot(workspaceRoot);

    
    // サーバー機能を設定
    ServerCapabilities capabilities = new ServerCapabilities();

    // TextDocument同期設定
    TextDocumentSyncOptions syncOptions = new TextDocumentSyncOptions();
    syncOptions.setOpenClose(true); // didOpen/didCloseをサポート
    syncOptions.setChange(TextDocumentSyncKind.Full); // ファイル全体の同期
    capabilities.setTextDocumentSync(syncOptions);

    InitializeResult result = new InitializeResult(capabilities);
    return CompletableFuture.completedFuture(result);
  }

  @Override
  public CompletableFuture<Object> shutdown() {
    logger.info("Shutting down DependViz Language Server");
    errorCode = 0;
    return CompletableFuture.completedFuture(null);
  }

  @Override
  public void exit() {
    logger.info("Exiting DependViz Language Server");
    System.exit(errorCode);
  }

  @Override
  public TextDocumentService getTextDocumentService() {
    return textDocumentService;
  }

  @Override
  public WorkspaceService getWorkspaceService() {
    return workspaceService;
  }

  public static void main(String[] args) {
    logger.info("Starting DependViz Language Server");
    DependVizLanguageServer server = new DependVizLanguageServer();

    // 標準入出力でLSPプロトコル通信
    InputStream in = System.in;
    OutputStream out = System.out;

    org.eclipse.lsp4j.jsonrpc.Launcher<LanguageClient> launcher =
        org.eclipse.lsp4j.jsonrpc.Launcher.createLauncher(
            server, LanguageClient.class, in, out);

    logger.info("Language Server started, listening on stdin/stdout");
    try {
      launcher.startListening().get();
    } catch (InterruptedException | ExecutionException e) {
      logger.log(Level.SEVERE, "Language server terminated with error", e);
    }
  }

  private String resolveWorkspaceRoot(InitializeParams params) {
    List<WorkspaceFolder> folders = params.getWorkspaceFolders();
    if (folders != null && !folders.isEmpty()) {
      return folders.get(0).getUri();
    }
    return fallbackWorkspaceRoot(params);
  }

  @SuppressWarnings("deprecation")
  private String fallbackWorkspaceRoot(InitializeParams params) {
    String rootUri = params.getRootUri();
    if (rootUri != null && !rootUri.isEmpty()) {
      return rootUri;
    }
    return params.getRootPath();
  }

  private static final class NoOpWorkspaceService implements WorkspaceService {
    @Override
    public void didChangeConfiguration(DidChangeConfigurationParams params) {}

    @Override
    public void didChangeWatchedFiles(DidChangeWatchedFilesParams params) {}
  }
}
