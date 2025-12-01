const vscode = require('vscode');

async function getAllSessions() {
    const sessions = vscode.debug.activeDebugSession ? [vscode.debug.activeDebugSession] : [];
    const sessionInfos = [];
    for (const session of sessions) {
        const threadsResponse = await session.customRequest('threads');
        const threads = threadsResponse.threads;

        let totalFrames = 0;
        let captured = false;
        let allFrames = [];

        if (vscode.debug.activeStackItem) {
            for (const thread of threads) {
                const stackResponse = await session.customRequest('stackTrace', { threadId: thread.id, levels: 50 });
                totalFrames += stackResponse.stackFrames.length;
                allFrames.push(...stackResponse.stackFrames);
            }
            captured = totalFrames > 0;
        }

        sessionInfos.push({
            sessionId: session.id,
            sessionName: session.name,
            sessionType: session.type,
            threadCount: threads.length,
            totalFrames,
            captured,
            frames: allFrames
        });
    }
    return sessionInfos;
}

async function updateStackTrace(graphViewProvider) {
    try {
        const sessions = await getAllSessions();
        if (sessions.length > 0 && sessions[0].captured) {
            const paths = sessions[0].frames.map(f => f.source?.path).filter(p => p);
            graphViewProvider.update({ type: 'stackTrace', paths });
        }
    } catch (e) {
        console.error('Failed to get stack trace:', e);
        vscode.window.showWarningMessage(`スタックトレースの取得に失敗しました: ${e.message}`);
        throw e;
    }
}

module.exports = { getAllSessions, updateStackTrace };
