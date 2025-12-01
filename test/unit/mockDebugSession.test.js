const { expect } = require('chai');

// stackTrace.js の processDebugSession ロジックを抽出してテスト
// VSCode APIに依存しないテスト可能な関数

describe('Mock Debug Session Tests', () => {
    // stackTrace.js の内部ロジックを再現
    async function processDebugSession(session) {
        try {
            const threadsResponse = await session.customRequest('threads');
            const threads = threadsResponse.threads;

            let totalFrames = 0;
            let allFrames = [];
            let stoppedThreads = 0;

            for (const thread of threads) {
                if (thread.stopped !== true) {
                    continue;
                }

                stoppedThreads++;

                try {
                    const stackResponse = await session.customRequest('stackTrace', {
                        threadId: thread.id,
                        levels: 200
                    });

                    if (stackResponse.stackFrames && stackResponse.stackFrames.length > 0) {
                        totalFrames += stackResponse.stackFrames.length;
                        allFrames.push(...stackResponse.stackFrames);
                    }
                } catch (threadError) {
                    // スレッドエラーは無視して続行
                }
            }

            return {
                sessionId: session.id,
                sessionName: session.name,
                sessionType: session.type,
                threadCount: threads.length,
                stoppedThreads,
                totalFrames,
                captured: totalFrames > 0,
                frames: allFrames
            };
        } catch (sessionError) {
            throw sessionError;
        }
    }

    function createMockSession(config) {
        return {
            id: config.id || 'test-session',
            name: config.name || 'Test Debug',
            type: config.type || 'java',
            customRequest: async (command, args) => {
                if (command === 'threads') {
                    return { threads: config.threads || [] };
                }
                if (command === 'stackTrace') {
                    const thread = config.threads.find(t => t.id === args.threadId);
                    if (!thread || !thread.stackFrames) {
                        return { stackFrames: [] };
                    }
                    return { stackFrames: thread.stackFrames };
                }
                throw new Error(`Unknown command: ${command}`);
            }
        };
    }

    describe('processDebugSession', () => {
        it('should process session with stopped thread', async () => {
            const mockSession = createMockSession({
                id: 'session-1',
                name: 'Java Debug',
                type: 'java',
                threads: [
                    {
                        id: 1,
                        name: 'main',
                        stopped: true,
                        stackFrames: [
                            { source: { path: '/project/Main.java' } },
                            { source: { path: '/project/Service.java' } }
                        ]
                    }
                ]
            });

            const result = await processDebugSession(mockSession);

            expect(result.sessionId).to.equal('session-1');
            expect(result.sessionName).to.equal('Java Debug');
            expect(result.threadCount).to.equal(1);
            expect(result.stoppedThreads).to.equal(1);
            expect(result.totalFrames).to.equal(2);
            expect(result.captured).to.be.true;
            expect(result.frames).to.have.lengthOf(2);
        });

        it('should skip running threads', async () => {
            const mockSession = createMockSession({
                threads: [
                    {
                        id: 1,
                        name: 'main',
                        stopped: false,
                        stackFrames: [
                            { source: { path: '/project/Main.java' } }
                        ]
                    },
                    {
                        id: 2,
                        name: 'worker',
                        stopped: true,
                        stackFrames: [
                            { source: { path: '/project/Worker.java' } }
                        ]
                    }
                ]
            });

            const result = await processDebugSession(mockSession);

            expect(result.threadCount).to.equal(2);
            expect(result.stoppedThreads).to.equal(1);
            expect(result.totalFrames).to.equal(1);
            expect(result.frames[0].source.path).to.equal('/project/Worker.java');
        });

        it('should handle multiple stopped threads', async () => {
            const mockSession = createMockSession({
                threads: [
                    {
                        id: 1,
                        name: 'main',
                        stopped: true,
                        stackFrames: [
                            { source: { path: '/project/Main.java' } },
                            { source: { path: '/project/ServiceA.java' } }
                        ]
                    },
                    {
                        id: 2,
                        name: 'worker-1',
                        stopped: true,
                        stackFrames: [
                            { source: { path: '/project/Worker.java' } }
                        ]
                    },
                    {
                        id: 3,
                        name: 'worker-2',
                        stopped: true,
                        stackFrames: [
                            { source: { path: '/project/Task.java' } }
                        ]
                    }
                ]
            });

            const result = await processDebugSession(mockSession);

            expect(result.stoppedThreads).to.equal(3);
            expect(result.totalFrames).to.equal(4);
            expect(result.frames).to.have.lengthOf(4);
        });

        it('should handle session with no stopped threads', async () => {
            const mockSession = createMockSession({
                threads: [
                    { id: 1, name: 'main', stopped: false },
                    { id: 2, name: 'worker', stopped: false }
                ]
            });

            const result = await processDebugSession(mockSession);

            expect(result.stoppedThreads).to.equal(0);
            expect(result.totalFrames).to.equal(0);
            expect(result.captured).to.be.false;
            expect(result.frames).to.have.lengthOf(0);
        });

        it('should handle empty thread list', async () => {
            const mockSession = createMockSession({
                threads: []
            });

            const result = await processDebugSession(mockSession);

            expect(result.threadCount).to.equal(0);
            expect(result.stoppedThreads).to.equal(0);
            expect(result.captured).to.be.false;
        });

        it('should handle threads with empty stack frames', async () => {
            const mockSession = createMockSession({
                threads: [
                    {
                        id: 1,
                        name: 'main',
                        stopped: true,
                        stackFrames: []
                    }
                ]
            });

            const result = await processDebugSession(mockSession);

            expect(result.stoppedThreads).to.equal(1);
            expect(result.totalFrames).to.equal(0);
            expect(result.captured).to.be.false;
        });

        it('should handle stack frames with null paths', async () => {
            const mockSession = createMockSession({
                threads: [
                    {
                        id: 1,
                        name: 'main',
                        stopped: true,
                        stackFrames: [
                            { source: { path: '/project/Main.java' } },
                            { source: { path: null } },
                            { source: null },
                            { source: { path: '/project/Service.java' } }
                        ]
                    }
                ]
            });

            const result = await processDebugSession(mockSession);

            expect(result.totalFrames).to.equal(4);
            expect(result.frames).to.have.lengthOf(4);

            // パスのフィルタリングは updateStackTrace で行われる
            const validPaths = result.frames
                .map(f => f.source?.path)
                .filter(p => p);

            expect(validPaths).to.have.lengthOf(2);
        });
    });

    describe('Path extraction from frames', () => {
        function extractPaths(frames) {
            return frames
                .map(f => f.source?.path)
                .filter(p => p);
        }

        it('should extract valid paths from frames', () => {
            const frames = [
                { source: { path: '/path/A.java' } },
                { source: { path: '/path/B.java' } },
                { source: { path: '/path/C.java' } }
            ];

            const paths = extractPaths(frames);

            expect(paths).to.have.lengthOf(3);
            expect(paths).to.deep.equal([
                '/path/A.java',
                '/path/B.java',
                '/path/C.java'
            ]);
        });

        it('should filter out null and undefined paths', () => {
            const frames = [
                { source: { path: '/path/A.java' } },
                { source: { path: null } },
                { source: null },
                { },
                { source: { path: '/path/B.java' } }
            ];

            const paths = extractPaths(frames);

            expect(paths).to.have.lengthOf(2);
            expect(paths).to.deep.equal([
                '/path/A.java',
                '/path/B.java'
            ]);
        });

        it('should get unique paths', () => {
            const frames = [
                { source: { path: '/path/A.java' } },
                { source: { path: '/path/B.java' } },
                { source: { path: '/path/A.java' } },
                { source: { path: '/path/C.java' } },
                { source: { path: '/path/B.java' } }
            ];

            const paths = extractPaths(frames);
            const uniquePaths = [...new Set(paths)];

            expect(uniquePaths).to.have.lengthOf(3);
            expect(uniquePaths).to.deep.equal([
                '/path/A.java',
                '/path/B.java',
                '/path/C.java'
            ]);
        });
    });

    describe('Real-world scenarios', () => {
        it('should handle typical Java debug session', async () => {
            const mockSession = createMockSession({
                id: 'java-debug-1',
                name: 'SpringBoot App',
                type: 'java',
                threads: [
                    {
                        id: 1,
                        name: 'main',
                        stopped: true,
                        stackFrames: [
                            { source: { path: '/src/main/java/com/example/Main.java' } },
                            { source: { path: '/src/main/java/com/example/service/UserService.java' } },
                            { source: { path: '/src/main/java/com/example/repository/UserRepository.java' } },
                            { source: { path: null } } // JDK internal frame
                        ]
                    },
                    {
                        id: 2,
                        name: 'http-nio-8080-exec-1',
                        stopped: false
                    }
                ]
            });

            const result = await processDebugSession(mockSession);

            expect(result.sessionName).to.equal('SpringBoot App');
            expect(result.stoppedThreads).to.equal(1);
            expect(result.totalFrames).to.equal(4);

            const validPaths = result.frames
                .map(f => f.source?.path)
                .filter(p => p);

            expect(validPaths).to.have.lengthOf(3);
            expect(validPaths[0]).to.include('Main.java');
            expect(validPaths[1]).to.include('UserService.java');
            expect(validPaths[2]).to.include('UserRepository.java');
        });
    });
});
