import * as vscode from 'vscode';

interface StackFrame {
    source?: {
        path?: string;
    };
}

interface ThreadsResponse {
    threads: DebugThread[];
}

interface DebugThread {
    id: number;
    name?: string;
    stopped?: boolean;
}

interface StackTraceResponse {
    stackFrames: StackFrame[];
}

export interface SessionInfo {
    sessionId: string;
    sessionName: string;
    sessionType: string;
    threadCount: number;
    stoppedThreads: number;
    totalFrames: number;
    captured: boolean;
    frames: StackFrame[];
}

export async function getAllSessions(): Promise<SessionInfo[]> {
    const sessions = vscode.debug.activeDebugSession ? [vscode.debug.activeDebugSession] : [];
    const sessionInfos: SessionInfo[] = [];

    for (const session of sessions) {
        try {
            const threadsResponse = await session.customRequest('threads') as ThreadsResponse;
            const threads = threadsResponse.threads;

            let totalFrames = 0;
            let allFrames: StackFrame[] = [];
            let stoppedThreads = 0;

            for (const thread of threads) {
                try {
                    const stackResponse = await session.customRequest('stackTrace', {
                        threadId: thread.id,
                        levels: 200
                    }) as StackTraceResponse;

                    if (stackResponse.stackFrames && stackResponse.stackFrames.length > 0) {
                        stoppedThreads++;
                        totalFrames += stackResponse.stackFrames.length;
                        allFrames.push(...stackResponse.stackFrames);
                        console.log(`Captured ${stackResponse.stackFrames.length} frames from thread ${thread.id} (${thread.name || 'unnamed'}) [stopped=${thread.stopped}]`);
                    }
                } catch {
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
            const error = sessionError as Error;
            console.warn(`Failed to process debug session ${session.id}:`, error.message);
        }
    }

    return sessionInfos;
}

export async function updateCallStack(
    graphViewProvider: { update(data: { type: string; paths: string[] }): void },
    callStackProvider?: { setSessions(sessions: SessionInfo[]): void; clear(): void }
): Promise<void> {
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
            .filter((p): p is string => p !== undefined && p !== null && p.trim() !== '');

        const uniquePaths = [...new Set(paths)];

        console.log(`Updating stack trace visualization: ${paths.length} frames from ${uniquePaths.length} unique files`);

        graphViewProvider.update({ type: 'callStack', paths: uniquePaths });
    } catch (e) {
        const error = e as Error;
        console.error('Failed to update stack trace:', error.message, error.stack);
        graphViewProvider.update({ type: 'callStack', paths: [] });
        if (callStackProvider) {
            callStackProvider.clear();
        }
    }
}
