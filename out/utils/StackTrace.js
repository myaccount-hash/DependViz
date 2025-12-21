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
exports.getAllSessions = getAllSessions;
exports.updateCallStack = updateCallStack;
const vscode = __importStar(require("vscode"));
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
                }
                catch (threadError) {
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
        }
        catch (sessionError) {
            const error = sessionError;
            console.warn(`Failed to process debug session ${session.id}:`, error.message);
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
            .filter((p) => p !== undefined && p !== null && p.trim() !== '');
        const uniquePaths = [...new Set(paths)];
        console.log(`Updating stack trace visualization: ${paths.length} frames from ${uniquePaths.length} unique files`);
        graphViewProvider.update({ type: 'callStack', paths: uniquePaths });
    }
    catch (e) {
        const error = e;
        console.error('Failed to update stack trace:', error.message, error.stack);
        graphViewProvider.update({ type: 'callStack', paths: [] });
        if (callStackProvider) {
            callStackProvider.clear();
        }
    }
}
//# sourceMappingURL=StackTrace.js.map