const vscode = require('vscode');

async function getAllSessions() {
    const sessions = vscode.debug.activeDebugSession ? [vscode.debug.activeDebugSession] : [];
    const sessionInfos = [];

    for (const session of sessions) {
        try {
            const threadsResponse = await session.customRequest('threads');
            const threads = threadsResponse.threads;

            let totalFrames = 0;
            let allFrames = [];
            let stoppedThreads = 0;

            // 全スレッドからスタックトレースを取得（停止中のスレッドのみ成功する）
            for (const thread of threads) {
                try {
                    // より深いスタックトレースを取得（デフォルト50から200に拡張）
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
                    // 実行中のスレッドはエラーになるので無視
                    // console.warn(`Failed to get stack trace for thread ${thread.id} (${thread.name || 'unnamed'}):`, threadError.message);
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

async function updateStackTrace(graphViewProvider) {
    try {
        const sessions = await getAllSessions();

        if (sessions.length === 0) {
            console.log('No active debug sessions found');
            graphViewProvider.update({ type: 'stackTrace', paths: [] });
            return;
        }

        const session = sessions[0];

        if (!session.captured) {
            console.log(`Debug session ${session.sessionName} has no captured frames (${session.stoppedThreads} stopped threads)`);
            graphViewProvider.update({ type: 'stackTrace', paths: [] });
            return;
        }

        const paths = session.frames
            .map(f => f.source?.path)
            .filter(p => p);

        const uniquePaths = [...new Set(paths)];

        console.log(`Updating stack trace visualization: ${paths.length} frames from ${uniquePaths.length} unique files`);

        graphViewProvider.update({ type: 'stackTrace', paths });
    } catch (e) {
        console.error('Failed to update stack trace:', e.message, e.stack);
        graphViewProvider.update({ type: 'stackTrace', paths: [] });
    }
}

module.exports = { getAllSessions, updateStackTrace };
