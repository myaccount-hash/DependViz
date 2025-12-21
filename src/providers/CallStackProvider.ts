import * as vscode from 'vscode';
import { ConfigurationManager } from '../ConfigurationManager';

interface StackFrame {
    source?: {
        path?: string;
    };
    name?: string;
}

interface SessionInfo {
    sessionId?: string;
    sessionName: string;
    sessionType: string;
    threadCount: number;
    stoppedThreads: number;
    totalFrames: number;
    captured: boolean;
    frames: StackFrame[];
}

interface CallStackEntry {
    id: string;
    sessionName: string;
    sessionType: string;
    capturedAt: number;
    classes: string[];
    paths: string[];
}

interface GraphViewProvider {
    update(data: { type: string; paths: string[] }): Promise<void>;
}

export class CallStackProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _sessions: CallStackEntry[] = [];
    private _configManager: ConfigurationManager;
    private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private _lastSavedSignature: string | null = null;

    constructor() {
        this._configManager = ConfigurationManager.getInstance();
        this._loadCache();
    }

    async update(graphViewProvider: GraphViewProvider): Promise<void> {
        try {
            const sessions = await this._getAllSessions();

            if (sessions.length === 0) {
                graphViewProvider.update({ type: 'callStack', paths: [] });
                return;
            }

            const firstSession = sessions.find((s) => s.captured);
            if (!firstSession) {
                graphViewProvider.update({ type: 'callStack', paths: [] });
                return;
            }

            const uniquePaths = this._extractPaths(firstSession.frames);

            const classes = this._extractClasses(firstSession.frames);
            const signature = this._computeSignature(firstSession, classes);
            if (!signature || signature === this._lastSavedSignature) {
                return;
            }
            this._lastSavedSignature = signature;

            const entry = this._buildEntry(firstSession, classes, uniquePaths);
            if (!entry) {
                return;
            }

            this._sessions = [entry, ...this._sessions];
            await this._persistSessions();
            this._onDidChangeTreeData.fire();
            await this._emitCallStackPaths(graphViewProvider);
        } catch (e) {
            console.error('Failed to update stack trace:', (e as Error).message, (e as Error).stack);
            await this.clear();
            graphViewProvider.update({ type: 'callStack', paths: [] });
        }
    }

    async clear(): Promise<void> {
        if (this._sessions.length === 0) {
            return;
        }
        this._sessions = [];
        this._lastSavedSignature = null;
        this._onDidChangeTreeData.fire();
        await this._persistSessions();
    }

    restore(graphViewProvider: GraphViewProvider): void {
        this._onDidChangeTreeData.fire();
        graphViewProvider.update({ type: 'callStack', paths: [] });
    }

    async removeSession(sessionId: string | undefined, graphViewProvider?: GraphViewProvider): Promise<void> {
        if (!sessionId) {
            return;
        }
        const currentFirst = this._sessions[0];
        const nextSessions = this._sessions.filter((entry) => entry.id !== sessionId);
        if (nextSessions.length === this._sessions.length) {
            return;
        }
        this._sessions = nextSessions;
        this._lastSavedSignature = null;
        this._onDidChangeTreeData.fire();
        await this._persistSessions();
        if (graphViewProvider && currentFirst?.id === sessionId) {
            graphViewProvider.update({ type: 'callStack', paths: [] });
        }
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(): vscode.TreeItem[] {
        if (this._sessions.length === 0) {
            return [this._createInfoItem('コールスタックなし', '保存された履歴がありません')];
        }
        const selectionSet = this._getSelectedSessionIds();
        return this._sessions.map((session) => this._createSessionItem(session, selectionSet));
    }

    private _createInfoItem(label: string, description: string): vscode.TreeItem {
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        item.description = truncate(description, 120);
        item.tooltip = description;
        return item;
    }

    private _createSessionItem(session: CallStackEntry, selectionSet: Set<string>): vscode.TreeItem {
        const label = `${session.sessionName} (${session.sessionType || 'unknown'})`;
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        item.id = session.id;
        item.contextValue = 'callStackEntry';
        const checked = selectionSet?.has(session.id);
        item.iconPath = new vscode.ThemeIcon(checked ? 'check' : 'circle-outline');
        item.command = {
            command: 'forceGraphViewer.toggleCallStackEntry',
            title: checked ? 'Toggle Call Stack Entry' : 'Toggle Call Stack Entry',
            arguments: [session.id]
        };
        const descriptionParts: string[] = [];
        const count = session.classes?.length || 0;
        descriptionParts.push(`${count}クラス`);
        if (session.capturedAt) {
            descriptionParts.push(new Date(session.capturedAt).toLocaleString());
        }
        item.description = descriptionParts.join(' · ');
        item.tooltip = this._buildTooltip(session);
        return item;
    }

    private _buildTooltip(session: CallStackEntry): string {
        const lines = [`${session.sessionName} (${session.sessionType || 'unknown'})`];
        if (session.capturedAt) {
            lines.push(`キャプチャ: ${new Date(session.capturedAt).toLocaleString()}`);
        }
        if (session.classes && session.classes.length > 0) {
            lines.push('クラス:');
            lines.push(...session.classes);
        }
        return lines.join('\n');
    }

    private _buildEntry(session: SessionInfo, classes: string[], paths: string[] = []): CallStackEntry | null {
        if (!classes || classes.length === 0) {
            return null;
        }
        const timestamp = Date.now();
        const suffix = Math.random().toString(36).slice(2, 6);
        const id = session.sessionId ? `${session.sessionId}-${timestamp}` : `${timestamp}-${suffix}`;
        return {
            id,
            sessionName: session.sessionName || 'Debug Session',
            sessionType: session.sessionType || '',
            capturedAt: timestamp,
            classes,
            paths: Array.isArray(paths) ? [...paths] : []
        };
    }

    private _getSelectedSessionIds(): Set<string> {
        const controls = this._configManager.loadControls({ ignoreCache: true });
        const selection = controls.callStackSelection;
        if (!Array.isArray(selection)) {
            return new Set();
        }
        return new Set(selection.filter((id: any) => typeof id === 'string' && id.length > 0));
    }

    private _getCallStackPathsForCurrentSelection(): string[] {
        const selection = this._getSelectedSessionIds();
        const pathsSet = new Set<string>();
        if (selection.size > 0) {
            for (const session of this._sessions) {
                if (selection.has(session.id) && Array.isArray(session.paths)) {
                    session.paths.forEach(path => pathsSet.add(path));
                }
            }
        }
        if (pathsSet.size === 0 && this._sessions.length > 0) {
            const latestPaths = this._sessions[0]?.paths;
            if (Array.isArray(latestPaths)) {
                latestPaths.forEach(path => pathsSet.add(path));
            }
        }
        return Array.from(pathsSet);
    }

    private async _emitCallStackPaths(graphViewProvider: GraphViewProvider): Promise<void> {
        if (!graphViewProvider) return;
        const paths = this._getCallStackPathsForCurrentSelection();
        await graphViewProvider.update({ type: 'callStack', paths });
    }

    async notifySelectionChanged(graphViewProvider: GraphViewProvider): Promise<void> {
        this._onDidChangeTreeData.fire();
        await this._emitCallStackPaths(graphViewProvider);
    }

    private _extractPaths(frames: StackFrame[] = []): string[] {
        const paths = frames
            .filter(f => f && f.source)
            .map(f => f.source?.path)
            .filter((p): p is string => !!p && !!p.trim());
        return [...new Set(paths)];
    }

    private _extractClasses(frames: StackFrame[] = []): string[] {
        const classes = new Set<string>();
        for (const frame of frames) {
            const className = this._deriveClassName(frame);
            if (className) {
                classes.add(className);
            }
        }
        return Array.from(classes).sort();
    }

    private _deriveClassName(frame: StackFrame): string {
        if (!frame?.name) return '';
        const raw = frame.name.split('(')[0].trim();
        if (!raw) return '';
        const parts = raw.split('.');
        if (parts.length > 1) {
            parts.pop();
        }
        return parts.join('.') || raw;
    }

    private _computeSignature(session: SessionInfo, classes: string[]): string | null {
        if (!classes || classes.length === 0) {
            return null;
        }
        const parts = [
            session.sessionId || 'no-id',
            session.threadCount || 0,
            session.stoppedThreads || 0,
            classes.join('|')
        ];
        return parts.join('::');
    }

    private async _persistSessions(): Promise<void> {
        try {
            await this._configManager.updateCallStackCache(this._sessions);
        } catch (e) {
            console.warn('Failed to persist stack trace cache:', (e as Error).message);
        }
    }

    private _loadCache(): void {
        try {
            const cache = this._configManager.getCallStackCache();
            if (Array.isArray(cache) && cache.length > 0) {
                this._sessions = cache;
            }
        } catch (e) {
            console.warn('Failed to load stack trace cache:', (e as Error).message);
        }
    }

    private async _getAllSessions(): Promise<SessionInfo[]> {
        const sessions = vscode.debug.activeDebugSession ? [vscode.debug.activeDebugSession] : [];
        const sessionInfos: SessionInfo[] = [];

        for (const session of sessions) {
            try {
                const threadsResponse = await session.customRequest('threads') as { threads: any[] };
                const threads = threadsResponse.threads;

                let totalFrames = 0;
                let allFrames: StackFrame[] = [];
                let stoppedThreads = 0;

                for (const thread of threads) {
                    try {
                        const stackResponse = await session.customRequest('stackTrace', {
                            threadId: thread.id,
                            levels: 200
                        }) as { stackFrames?: StackFrame[] };

                        if (stackResponse.stackFrames && stackResponse.stackFrames.length > 0) {
                            stoppedThreads++;
                            totalFrames += stackResponse.stackFrames.length;
                            allFrames.push(...stackResponse.stackFrames);
                            console.log(`Captured ${stackResponse.stackFrames.length} frames from thread ${thread.id} (${thread.name || 'unnamed'}) [stopped=${thread.stopped}]`);
                        }
                    } catch (threadError) {
                        // Ignore errors from running threads
                    }
                }

                console.log(`Debug session ${session.name}: ${stoppedThreads}/${threads.length} threads stopped, ${totalFrames} total frames captured`);

                sessionInfos.push({
                    sessionId: session.id,
                    sessionName: session.name,
                    sessionType: session.type,
                    threadCount: threads.length,
                    stoppedThreads,
                    totalFrames,
                    captured: totalFrames > 0,
                    frames: allFrames
                });
            } catch (sessionError) {
                console.warn(`Failed to process debug session ${session.id}:`, (sessionError as Error).message);
            }
        }

        return sessionInfos;
    }
}

function truncate(text: string, maxLength: number): string {
    if (!text) {
        return '';
    }
    return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}
