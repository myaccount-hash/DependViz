"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const GraphViewProvider_1 = require("./providers/GraphViewProvider");
const FilterProvider_1 = require("./providers/FilterProvider");
const GraphSettingsProvider_1 = require("./providers/GraphSettingsProvider");
const CallStackProvider_1 = require("./providers/CallStackProvider");
const ConfigurationManager_1 = require("./ConfigurationManager");
const commands_1 = require("./commands");
const AnalyzerManager_1 = require("./AnalyzerManager");
process.env.VSCODE_DISABLE_TELEMETRY = '1';
// グローバルなAnalyzerManagerインスタンス
let analyzerManager = null;
function activate(context) {
    const settingsProvider = new GraphSettingsProvider_1.GraphSettingsProvider();
    const filterProvider = new FilterProvider_1.FilterProvider();
    const graphViewProvider = new GraphViewProvider_1.GraphViewProvider(context.extensionUri);
    const callStackProvider = new CallStackProvider_1.CallStackProvider();
    vscode.window.createTreeView('forceGraphViewer.settings', { treeDataProvider: settingsProvider });
    vscode.window.createTreeView('forceGraphViewer.filters', { treeDataProvider: filterProvider });
    vscode.window.createTreeView('forceGraphViewer.callStack', { treeDataProvider: callStackProvider });
    vscode.window.registerWebviewViewProvider('forceGraphViewer.sidebar', graphViewProvider);
    const configManager = ConfigurationManager_1.ConfigurationManager.getInstance();
    let lastCallStackSelectionValue = [];
    const analyzerWatcher = createAnalyzerConfigWatcher(configManager);
    if (analyzerWatcher) {
        context.subscriptions.push(analyzerWatcher);
    }
    const broadcastSettings = (controlsOverride) => {
        const controls = controlsOverride || configManager.loadControls({ ignoreCache: true });
        settingsProvider.handleSettingsChanged(controls);
        filterProvider.handleSettingsChanged(controls);
        graphViewProvider.handleSettingsChanged(controls);
        return controls;
    };
    const initialControls = broadcastSettings();
    lastCallStackSelectionValue = Array.isArray(initialControls.callStackSelection) ? [...initialControls.callStackSelection] : [];
    if (initialControls.showCallStack) {
        callStackProvider.restore(graphViewProvider);
        callStackProvider.update(graphViewProvider);
    }
    analyzerManager = new AnalyzerManager_1.AnalyzerManager(context, configManager);
    const providers = {
        settingsProvider,
        filterProvider,
        graphViewProvider,
        callStackProvider,
        analyzerManager
    };
    const commands = (0, commands_1.registerCommands)(context, providers);
    const eventHandlers = [
        configManager.addObserver(async (controls) => {
            const nextControls = broadcastSettings(controls);
            const nextSelection = Array.isArray(nextControls.callStackSelection)
                ? [...nextControls.callStackSelection]
                : [];
            const selectionChanged = !areCallStackSelectionsEqual(nextSelection, lastCallStackSelectionValue);
            lastCallStackSelectionValue = nextSelection;
            if (nextControls.showCallStack && !selectionChanged) {
                await callStackProvider.update(graphViewProvider);
            }
        }),
        vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            if (editor?.document.uri.scheme === 'file') {
                await graphViewProvider.update({ type: 'focusNode', filePath: editor.document.uri.fsPath });
            }
        }),
        vscode.window.onDidChangeActiveColorTheme(() => broadcastSettings()),
        vscode.debug.onDidChangeActiveStackItem(async (stackItem) => {
            const controls = broadcastSettings();
            if (controls.showCallStack && stackItem && 'frameId' in stackItem) {
                await callStackProvider.update(graphViewProvider);
            }
        }),
        vscode.debug.onDidStartDebugSession(async () => {
            const controls = broadcastSettings();
            if (controls.showCallStack) {
                await callStackProvider.update(graphViewProvider);
            }
        }),
        vscode.debug.onDidTerminateDebugSession(() => {
            const controls = broadcastSettings();
            if (controls.showCallStack) {
                graphViewProvider.update({ type: 'callStack', paths: [] });
            }
        })
    ];
    context.subscriptions.push(...commands, ...eventHandlers);
}
async function deactivate() {
    if (analyzerManager) {
        await analyzerManager.stopAll();
    }
    // リソースクリーンアップ
    // context.subscriptions に登録された全てのリソースは
    // VSCode が自動的に dispose() を呼び出すため、
    // 明示的なクリーンアップは不要
    console.log('DependViz extension deactivated');
}
function createAnalyzerConfigWatcher(configManager) {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return null;
    }
    const pattern = new vscode.RelativePattern(vscode.workspace.workspaceFolders[0], '.vscode/dependviz/analyzer.json');
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    const handler = () => configManager.handleAnalyzerConfigExternalChange();
    watcher.onDidChange(handler);
    watcher.onDidCreate(handler);
    watcher.onDidDelete(handler);
    return watcher;
}
function areCallStackSelectionsEqual(a = [], b = []) {
    if (!Array.isArray(a) || !Array.isArray(b))
        return false;
    if (a.length !== b.length)
        return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((value, index) => value === sortedB[index]);
}
//# sourceMappingURL=extension.js.map