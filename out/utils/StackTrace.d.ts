interface StackFrame {
    source?: {
        path?: string;
    };
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
export declare function getAllSessions(): Promise<SessionInfo[]>;
export declare function updateCallStack(graphViewProvider: {
    update(data: {
        type: string;
        paths: string[];
    }): void;
}, callStackProvider?: {
    setSessions(sessions: SessionInfo[]): void;
    clear(): void;
}): Promise<void>;
export {};
//# sourceMappingURL=StackTrace.d.ts.map