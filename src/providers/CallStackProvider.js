const vscode = require('vscode');
const { ConfigurationManager } = require('../utils/ConfigurationManager');

class CallStackProvider {
    constructor() {
        this._sessions = [];
        this._configManager = ConfigurationManager.getInstance();
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this._lastSavedSignature = null;
        this._loadCache();
    }

    async update(graphViewProvider) {
        try {
            const sessions = await this._getAllSessions();

            if (sessions.length === 0) {
                graphViewProvider.update({ type: 'stackTrace', paths: [] });
                return;
            }

            const firstSession = sessions.find((s) => s.captured);
            if (!firstSession) {
                graphViewProvider.update({ type: 'stackTrace', paths: [] });
                return;
            }

            const uniquePaths = this._extractPaths(firstSession.frames);
            graphViewProvider.update({ type: 'stackTrace', paths: uniquePaths });

            if (uniquePaths.length === 0) {
                return;
            }

            const classes = this._extractClasses(firstSession.frames);
            const signature = this._computeSignature(firstSession, classes);
            if (!signature || signature === this._lastSavedSignature) {
                return;
            }
            this._lastSavedSignature = signature;

            const entry = this._buildEntry(firstSession, classes);
            if (!entry) {
                return;
            }

            this._sessions = [entry, ...this._sessions];
            await this._persistSessions();
            this._onDidChangeTreeData.fire();
        } catch (e) {
            console.error('Failed to update stack trace:', e.message, e.stack);
            await this.clear();
            graphViewProvider.update({ type: 'stackTrace', paths: [] });
        }
    }

    async clear() {
        if (this._sessions.length === 0) {
            return;
        }
        this._sessions = [];
        this._lastSavedSignature = null;
        this._onDidChangeTreeData.fire();
        await this._persistSessions();
    }

    restore(graphViewProvider) {
        this._onDidChangeTreeData.fire();
        graphViewProvider.update({ type: 'stackTrace', paths: [] });
    }

    async removeSession(sessionId, graphViewProvider) {
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
            graphViewProvider.update({ type: 'stackTrace', paths: [] });
        }
    }

    getTreeItem(element) {
        return element;
    }

    getChildren() {
        if (this._sessions.length === 0) {
            return [this._createInfoItem('スタックトレースなし', '保存された履歴がありません')];
        }
        return this._sessions.map((session) => this._createSessionItem(session));
    }

    _createInfoItem(label, description) {
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        item.description = truncate(description, 120);
        item.tooltip = description;
        return item;
    }

    _createSessionItem(session) {
        const label = `${session.sessionName} (${session.sessionType || 'unknown'})`;
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        item.id = session.id;
        item.contextValue = 'stackTraceEntry';
        const descriptionParts = [];
        const count = session.classes?.length || 0;
        descriptionParts.push(`${count}クラス`);
        if (session.capturedAt) {
            descriptionParts.push(new Date(session.capturedAt).toLocaleString());
        }
        item.description = descriptionParts.join(' · ');
        item.tooltip = this._buildTooltip(session);
        return item;
    }

    _buildTooltip(session) {
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

    _buildEntry(session, classes) {
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
            classes
        };
    }

    _extractPaths(frames = []) {
        const paths = frames
            .filter(f => f && f.source)
            .map(f => f.source?.path)
            .filter(p => p && p.trim());
        return [...new Set(paths)];
    }

    _extractClasses(frames = []) {
        const classes = new Set();
        for (const frame of frames) {
            const className = this._deriveClassName(frame);
            if (className) {
                classes.add(className);
            }
        }
        return Array.from(classes).sort();
    }

    _deriveClassName(frame) {
        if (!frame?.name) return '';
        const raw = frame.name.split('(')[0].trim();
        if (!raw) return '';
        const parts = raw.split('.');
        if (parts.length > 1) {
            parts.pop();
        }
        return parts.join('.') || raw;
    }

    _computeSignature(session, classes) {
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

    async _persistSessions() {
        try {
            await this._configManager.updateCallStackCache(this._sessions);
        } catch (e) {
            console.warn('Failed to persist stack trace cache:', e.message);
        }
    }

    _loadCache() {
        try {
            const cache = this._configManager.getCallStackCache();
            if (Array.isArray(cache) && cache.length > 0) {
                this._sessions = cache;
            }
        } catch (e) {
            console.warn('Failed to load stack trace cache:', e.message);
        }
    }

    async _getAllSessions() {
        const sessions = vscode.debug.activeDebugSession ? [vscode.debug.activeDebugSession] : [];
        const sessionInfos = [];

        for (const session of sessions) {
            try {
                const threadsResponse = await session.customRequest('threads');
                const threads = threadsResponse.threads;

                let totalFrames = 0;
                let allFrames = [];
                let stoppedThreads = 0;

                for (const thread of threads) {
                    try {
                        const stackResponse = await session.customRequest('stackTrace', {
                            threadId: thread.id,
                            levels: 200
                        });

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
                console.warn(`Failed to process debug session ${session.id}:`, sessionError.message);
            }
        }

        return sessionInfos;
    }
}

function truncate(text, maxLength) {
    if (!text) {
        return '';
    }
    return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

module.exports = CallStackProvider;
