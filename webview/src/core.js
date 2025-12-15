let vscode = null;
if (typeof acquireVsCodeApi === 'function') {
    vscode = acquireVsCodeApi();
}
