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

async function updateCallStack(graphViewProvider, callStackProvider) {
    try {
        const sessions = await getAllSessions();

        if (callStackProvider) {
            callStackProvider.setSessions(sessions);
        }

        if (sessions.length === 0) {
            console.log('No active debug sessions found');
            graphViewProvider.update({ type: 'callStack', paths: [] });
            if (callStackProvider) {
                callStackProvider.clear();
            }
            return;
        }

        const session = sessions[0];

        if (!session.captured) {
            console.log(`Debug session ${session.sessionName} has no captured frames (${session.stoppedThreads} stopped threads)`);
            graphViewProvider.update({ type: 'callStack', paths: [] });
            if (callStackProvider) {
                callStackProvider.clear();
            }
            return;
        }

        const paths = session.frames
            .filter(f => f && f.source)
            .map(f => f.source?.path)
            .filter(p => p && p.trim());

        const uniquePaths = [...new Set(paths)];

        console.log(`Updating stack trace visualization: ${paths.length} frames from ${uniquePaths.length} unique files`);

        graphViewProvider.update({ type: 'callStack', paths: uniquePaths });
    } catch (e) {
        console.error('Failed to update stack trace:', e.message, e.stack);
        graphViewProvider.update({ type: 'callStack', paths: [] });
        if (callStackProvider) {
            callStackProvider.clear();
        }
    }
}

module.exports = { getAllSessions, updateCallStack };
