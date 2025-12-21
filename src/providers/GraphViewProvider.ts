import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { BaseProvider, Controls } from './BaseProvider';
import { validateGraphData, getNodeFilePath, mergeGraphData, GraphData, GraphNode } from '../utils/utils';
import { ConfigurationManager, COLORS, AUTO_ROTATE_DELAY } from '../ConfigurationManager';

interface UpdateData {
    type: string;
    paths?: string[];
    filePath?: string;
}

interface SyncOptions {
    viewOnly?: boolean;
}

interface WebviewMessage {
    jsonrpc: string;
    method: string;
    params?: any;
}

type MessageCreator = (payload?: any) => any;

/**
 * Graph Viewを提供するTreeDataProvider実装
 * 主にWebviewとの通信を管理する
 */
export class GraphViewProvider extends BaseProvider implements vscode.WebviewViewProvider {
    private _extensionUri: vscode.Uri;
    private _view: vscode.WebviewView | null = null;
    private _currentData: GraphData = { nodes: [], links: [] };
    private _dataVersion = 0;
    private _updateInProgress = false;
    private _pendingUpdate: UpdateData | null = null;
    private _callStackPaths: string[] = [];
    private _webviewBridge: WebviewBridge;

    constructor(extensionUri: vscode.Uri) {
        super();
        this._extensionUri = extensionUri;
        this._webviewBridge = new WebviewBridge();
    }

    private _getHtmlForWebview(): string {
        const htmlPath = path.join(__dirname, '../../webview/dist/index.html');
        if (!fs.existsSync(htmlPath)) {
            throw new Error('Webview HTML not found. Run "npm run build:webview" before packaging the extension.');
        }
        return fs.readFileSync(htmlPath, 'utf8');
    }

    async resolveWebviewView(webviewView: vscode.WebviewView): Promise<void> {
        this._view = webviewView;
        this._webviewBridge.attach(webviewView.webview, {
            ready: () => {
                this.syncToWebview();
            },
            focusNode: async (params: any) => {
                if (params.node?.filePath) {
                    await vscode.window.showTextDocument(vscode.Uri.file(params.node.filePath));
                }
            }
        });
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [this._extensionUri] };
        webviewView.webview.html = this._getHtmlForWebview();
        this.syncToWebview();
    }

    async refresh(): Promise<void> {
        this.syncToWebview();
    }

    mergeGraphData(newData: GraphData): void {
        mergeGraphData(this._currentData, newData);
        this._dataVersion += 1;
        this.syncToWebview();
    }

    setGraphData(data: GraphData): void {
        validateGraphData(data);
        this._currentData = {
            nodes: data.nodes ?? [],
            links: data.links ?? []
        };
        this._dataVersion += 1;
        this.syncToWebview();
    }

    async update(data: UpdateData): Promise<void> {
        if (this._updateInProgress) {
            this._pendingUpdate = data;
            return;
        }

        this._updateInProgress = true;

        try {
            await this._performUpdate(data);
            while (this._pendingUpdate) {
                const pending = this._pendingUpdate;
                this._pendingUpdate = null;
                await this._performUpdate(pending);
            }
        } finally {
            this._updateInProgress = false;
        }
    }

    private async _performUpdate(data: UpdateData): Promise<void> {
        if (!data || data.type === 'controls') {
            this.syncToWebview({ viewOnly: true });
        } else if (data.type === 'callStack' && Array.isArray(data.paths)) {
            this._callStackPaths = [...data.paths];
            this.syncToWebview({ viewOnly: true });
        } else if (data.type === 'focusNode' && data.filePath) {
            await this.focusNode(data.filePath);
        }
    }

    private _findNodeByFilePath(filePath: string): GraphNode | undefined {
        if (!filePath) return undefined;
        return this._currentData.nodes.find(n => {
            const nodePath = getNodeFilePath(n);
            if (!nodePath) return false;
            const nodeBasename = nodePath.split('/').pop();
            const fileBasename = filePath.split('/').pop();
            return nodePath === filePath ||
                nodeBasename === fileBasename ||
                filePath.endsWith(nodePath) ||
                nodePath.endsWith(filePath);
        });
    }

    syncToWebview(options: SyncOptions = {}): void {
        if (!this._view) {
            console.warn('[GraphViewProvider] Cannot sync - view not available');
            return;
        }

        const controls = this.controls && Object.keys(this.controls).length > 0
            ? this.controls
            : ConfigurationManager.getInstance().loadControls({ ignoreCache: true });
        const themeKind = vscode.window.activeColorTheme.kind;
        const darkMode = themeKind === vscode.ColorThemeKind.Dark ||
            themeKind === vscode.ColorThemeKind.HighContrast;

        const payload: any = {
            controls: { ...controls, darkMode, COLORS, AUTO_ROTATE_DELAY },
            callStackPaths: this._callStackPaths
        };

        if (options.viewOnly) {
            this._webviewBridge.send('view:update', payload);
            return;
        }

        this._webviewBridge.send('graph:update', {
            ...payload,
            data: this._currentData,
            dataVersion: this._dataVersion
        });
    }

    async focusNode(filePath: string): Promise<void> {
        if (!this._view || !this._currentData?.nodes?.length) {
            return;
        }
        const node = this._findNodeByFilePath(filePath);
        if (node) {
            this._webviewBridge.send('node:focus', node.id);
        }
    }

    async toggle3DMode(): Promise<void> {
        if (!this._view) {
            console.warn('[GraphViewProvider] Cannot toggle 3D mode - view not available');
            return;
        }

        // 現在の設定を取得して反転
        const currentMode = (this.controls && this.controls.is3DMode !== undefined)
            ? this.controls.is3DMode
            : ConfigurationManager.getInstance().loadControls({ ignoreCache: true }).is3DMode;
        await ConfigurationManager.getInstance().updateControl('is3DMode', !currentMode);

        // Webviewに通知してグラフをリセット
        this._webviewBridge.send('mode:toggle');

        // 更新された設定を送信
        this.syncToWebview();
    }

    handleSettingsChanged(controls: Controls | null): void {
        super.handleSettingsChanged(controls);
        this.syncToWebview({ viewOnly: true });
    }

    async clearFocus(): Promise<void> {
        if (!this._view) return;
        this._webviewBridge.send('focus:clear');
    }
}

const messageParams: Record<string, MessageCreator> = {
    'graph:update': (params: any) => {
        if (!params || typeof params !== 'object') {
            throw new Error('graph:update: params must be an object');
        }
        const { controls, data, callStackPaths = [], dataVersion } = params;
        if (!controls || typeof controls !== 'object') {
            throw new Error('graph:update: controls must be provided');
        }
        validateGraphData(data);
        const message: any = {
            controls,
            data,
            callStackPaths: Array.isArray(callStackPaths) ? callStackPaths : []
        };
        if (typeof dataVersion === 'number') {
            message.dataVersion = dataVersion;
        }
        return message;
    },

    'view:update': (params: any) => {
        const validParams = params && typeof params === 'object' ? params : null;
        if (!validParams) {
            throw new Error('view:update: params must be an object');
        }
        const message: any = {};

        if (validParams.controls && typeof validParams.controls === 'object') {
            message.controls = validParams.controls;
        }
        if (Array.isArray(validParams.callStackPaths)) {
            message.callStackPaths = validParams.callStackPaths;
        }
        return message;
    },

    'node:focus': (nodeId: any) => {
        if (nodeId === undefined || nodeId === null) {
            throw new Error('node:focus: nodeId is required');
        }
        return { nodeId };
    },

    'mode:toggle': () => {
        return undefined;
    },

    'focus:clear': () => {
        return undefined;
    }
};

/**
 * Webviewとのメッセージングを管理するクラス
 * ExtensionBridgeと対応する
 * 通信は必ずこのクラスを介して行う
 * GraphViewProviderからのみ使用される
 */
class WebviewBridge {
    private _webview: vscode.Webview | null = null;
    private _ready = false;
    private _queue: WebviewMessage[] = [];
    private _handlers: Record<string, (params: any) => void | Promise<void>> = {};

    attach(webview: vscode.Webview, handlers: Record<string, (params: any) => void | Promise<void>> = {}): void {
        this._webview = webview;
        this._ready = false;
        this._queue = [];
        this._handlers = handlers;
        if (this._webview?.onDidReceiveMessage) {
            this._webview.onDidReceiveMessage(async (message: WebviewMessage) => {
                await this._handleReceive(message);
            });
        }
    }

    detach(): void {
        this._webview = null;
        this._ready = false;
        this._queue = [];
        this._handlers = {};
    }

    markReady(): void {
        this._ready = true;
        this._flush();
    }

    send(type: string, payload?: any): void {
        const creator = messageParams[type];
        if (!creator) {
            throw new Error(`Unknown message type: ${type}`);
        }
        const params = creator(payload);
        const message: WebviewMessage = { jsonrpc: '2.0', method: type };
        if (params !== undefined) {
            message.params = params;
        }
        this._dispatch(message);
    }

    private _dispatch(message: WebviewMessage): boolean {
        if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
            throw new Error('Invalid webview message payload');
        }
        if (!this._webview) {
            return false;
        }
        if (this._ready) {
            this._webview.postMessage(message);
            return true;
        }
        this._queue.push(message);
        return false;
    }

    private _flush(): void {
        if (!this._webview || !this._ready) return;
        while (this._queue.length > 0) {
            const message = this._queue.shift();
            if (message) {
                this._webview.postMessage(message);
            }
        }
    }

    private async _handleReceive(message: WebviewMessage): Promise<void> {
        if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
            return;
        }
        if (message.method === 'ready') {
            this.markReady();
        }
        const handler = this._handlers?.[message.method];
        if (handler) {
            await handler(message.params || {});
        }
    }
}
