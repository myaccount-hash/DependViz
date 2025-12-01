const { expect } = require('chai');

// エッジケースとバグ発見のためのテスト
// 実際のコードの問題を見つけるためのテスト

describe('Edge Cases and Potential Bugs', () => {
    describe('Path matching edge cases', () => {
        function matchNode(nodes, targetPath) {
            if (!targetPath) return undefined;
            return nodes.find(n => {
                const nodePath = n.filePath || n.file;
                if (!nodePath) return false;
                const nodeBasename = nodePath.split('/').pop();
                const frameBasename = targetPath.split('/').pop();
                return nodePath === targetPath ||
                    nodeBasename === frameBasename ||
                    targetPath.endsWith(nodePath) ||
                    nodePath.endsWith(targetPath);
            });
        }

        it('should NOT match when basename is empty string', () => {
            const nodes = [
                { id: 'test', filePath: '/path/to/' }  // 末尾がスラッシュ
            ];
            const path = '/another/path/';

            const matched = matchNode(nodes, path);
            // 両方とも basename が空文字列になるので誤マッチする可能性
            expect(matched).to.be.undefined;  // これは失敗する可能性がある
        });

        it('should handle path with multiple dots in filename', () => {
            const nodes = [
                { id: 'test', filePath: '/path/to/File.test.java' }
            ];
            const path = '/other/File.test.java';

            const matched = matchNode(nodes, path);
            expect(matched).to.not.be.undefined;
            expect(matched.id).to.equal('test');
        });

        it('should NOT match partial filenames', () => {
            const nodes = [
                { id: 'UserService', filePath: '/path/UserService.java' },
                { id: 'UserServiceImpl', filePath: '/path/UserServiceImpl.java' }
            ];
            const path = '/other/UserService.java';

            const matched = matchNode(nodes, path);
            // UserService と UserServiceImpl の両方がマッチする可能性
            // find() は最初のものを返すので UserService になるが、
            // 本当にそれが正しいか？
            expect(matched.id).to.equal('UserService');
        });

        it('should handle Windows-style paths', () => {
            const nodes = [
                { id: 'test', filePath: 'C:\\Users\\project\\src\\Main.java' }
            ];
            const path = '/Users/project/src/Main.java';  // Unix style

            const matched = matchNode(nodes, path);
            // パスのスタイルが異なるとマッチしない
            // これは実際の問題になる可能性がある
            expect(matched).to.not.be.undefined;  // 失敗する可能性
        });

        it('should NOT match when endsWith is too greedy', () => {
            const nodes = [
                { id: 'test', filePath: 'Main.java' }  // 短いパス
            ];
            const path = '/very/long/path/to/project/src/main/java/com/example/Main.java';

            const matched = matchNode(nodes, path);
            // path.endsWith('Main.java') は true だが、これは正しいマッチング？
            expect(matched).to.not.be.undefined;
            // これは意図的な動作かもしれないが、バグの可能性もある
        });

        it('should handle special characters in path', () => {
            const nodes = [
                { id: 'test', filePath: '/path/with spaces/Main.java' }
            ];
            const path = '/other/with spaces/Main.java';

            const matched = matchNode(nodes, path);
            expect(matched).to.not.be.undefined;
        });

        it('should NOT match when path contains parent directory references', () => {
            const nodes = [
                { id: 'test', filePath: '/project/src/Main.java' }
            ];
            const path = '/project/src/../src/Main.java';  // 正規化されていない

            const matched = matchNode(nodes, path);
            // 正規化されていないパスは完全一致しない
            expect(matched).to.be.undefined;  // basename でマッチするので失敗する
        });
    });

    describe('Stack trace collection edge cases', () => {
        async function processDebugSession(session) {
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
                        }
                    } catch (threadError) {
                        // エラーは無視
                    }
                }

                return {
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
                id: config.id || 'test',
                name: config.name || 'Test',
                customRequest: async (command, args) => {
                    if (command === 'threads') {
                        return { threads: config.threads || [] };
                    }
                    if (command === 'stackTrace') {
                        const thread = config.threads.find(t => t.id === args.threadId);
                        if (thread && thread.shouldThrow) {
                            throw new Error('Thread error');
                        }
                        if (!thread || !thread.stackFrames) {
                            return { stackFrames: [] };
                        }
                        // levels を超えるフレームは切り捨てられる
                        return {
                            stackFrames: thread.stackFrames.slice(0, args.levels)
                        };
                    }
                }
            };
        }

        it('should handle exactly 200 frames (boundary case)', async () => {
            const frames = Array(200).fill(null).map((_, i) => ({
                source: { path: `/path/Frame${i}.java` }
            }));

            const session = createMockSession({
                threads: [{
                    id: 1,
                    stopped: true,
                    stackFrames: frames
                }]
            });

            const result = await processDebugSession(session);
            expect(result.totalFrames).to.equal(200);
        });

        it('should truncate frames beyond 200 levels', async () => {
            const frames = Array(300).fill(null).map((_, i) => ({
                source: { path: `/path/Frame${i}.java` }
            }));

            const session = createMockSession({
                threads: [{
                    id: 1,
                    stopped: true,
                    stackFrames: frames
                }]
            });

            const result = await processDebugSession(session);
            // 300フレームあるが200までしか取得できない
            expect(result.totalFrames).to.equal(200);
            // これは失敗する可能性がある（実装による）
        });

        it('should handle thread that throws error after returning some frames', async () => {
            // この動作は未定義
            const session = createMockSession({
                threads: [
                    {
                        id: 1,
                        stackFrames: [{ source: { path: '/A.java' } }]
                    },
                    {
                        id: 2,
                        shouldThrow: true  // エラーを投げる
                    }
                ]
            });

            const result = await processDebugSession(session);
            // エラーは無視されるので、thread 1 のフレームは取得できる
            expect(result.totalFrames).to.equal(1);
            expect(result.stoppedThreads).to.equal(1);
        });

        it('should handle circular references in stack frames', async () => {
            const frame1 = { source: { path: '/A.java' } };
            const frame2 = { source: { path: '/B.java' }, parent: frame1 };
            frame1.child = frame2;  // 循環参照

            const session = createMockSession({
                threads: [{
                    id: 1,
                    stackFrames: [frame1, frame2]
                }]
            });

            // これが無限ループやメモリリークを引き起こさないか
            const result = await processDebugSession(session);
            expect(result.totalFrames).to.equal(2);
        });

        it('should handle very deep call stacks', async () => {
            // 再帰呼び出しなどで非常に深いスタック
            const frames = Array(10000).fill(null).map((_, i) => ({
                source: { path: `/path/RecursiveCall${i % 10}.java` }
            }));

            const session = createMockSession({
                threads: [{
                    id: 1,
                    stackFrames: frames
                }]
            });

            const result = await processDebugSession(session);
            // 200までしか取得できない
            expect(result.totalFrames).to.be.at.most(200);
        });
    });

    describe('Update timing race conditions', () => {
        class MockGraphViewProvider {
            constructor() {
                this.updates = [];
                this.updateCount = 0;
            }

            update(data) {
                this.updateCount++;
                this.updates.push({
                    ...data,
                    updateId: this.updateCount
                });
            }
        }

        async function updateStackTrace(provider, paths, delay = 0) {
            if (delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            provider.update({ type: 'stackTrace', paths });
        }

        it('should handle rapid successive updates', async () => {
            const provider = new MockGraphViewProvider();

            // 連続して更新
            await Promise.all([
                updateStackTrace(provider, ['/A.java']),
                updateStackTrace(provider, ['/B.java']),
                updateStackTrace(provider, ['/C.java'])
            ]);

            // どの順序で更新が適用されるかは不定
            expect(provider.updates).to.have.lengthOf(3);
            // 最後の更新が期待通りか？
            // レースコンディションで順序が保証されない可能性
        });

        it('should NOT guarantee order when updates overlap', async () => {
            const provider = new MockGraphViewProvider();

            // 異なる遅延で更新
            const promises = [
                updateStackTrace(provider, ['/A.java'], 20),
                updateStackTrace(provider, ['/B.java'], 10),  // これが先に完了
                updateStackTrace(provider, ['/C.java'], 5)    // これが一番先
            ];

            await Promise.all(promises);

            // 期待: C, B, A の順
            // しかし実装によっては順序が変わる可能性
            expect(provider.updates[0].paths[0]).to.equal('/C.java');  // 失敗する可能性
        });
    });

    describe('Memory and performance edge cases', () => {
        it('should handle extremely large node count', () => {
            const nodes = Array(100000).fill(null).map((_, i) => ({
                id: `node${i}`,
                filePath: `/path/to/File${i}.java`
            }));

            function searchNodes(nodes, query) {
                return nodes.filter(n =>
                    n.id.toLowerCase().includes(query.toLowerCase())
                );
            }

            const start = Date.now();
            const results = searchNodes(nodes, 'node99999');
            const duration = Date.now() - start;

            expect(results).to.have.lengthOf(1);
            // これは遅すぎないか？
            // 線形検索なので O(n) だが、許容範囲内か？
            expect(duration).to.be.below(1000);  // 1秒以内？失敗する可能性
        });

        it('should handle duplicate paths without memory leak', () => {
            const paths = Array(10000).fill('/same/path/File.java');

            const uniquePaths = [...new Set(paths)];

            expect(uniquePaths).to.have.lengthOf(1);
            // メモリ使用量は適切か？（この test では検証できないが）
        });
    });

    describe('Null and undefined handling', () => {
        function extractPaths(frames) {
            return frames
                .map(f => f.source?.path)
                .filter(p => p);
        }

        it('should handle frames with undefined source', () => {
            const frames = [
                { source: { path: '/A.java' } },
                { source: undefined },  // source が undefined
                { source: { path: '/B.java' } }
            ];

            const paths = extractPaths(frames);
            expect(paths).to.have.lengthOf(2);
        });

        it('should handle frames that are null', () => {
            const frames = [
                { source: { path: '/A.java' } },
                null,  // frame 自体が null
                { source: { path: '/B.java' } }
            ];

            // これはエラーを投げる可能性がある
            expect(() => extractPaths(frames)).to.throw();  // 失敗する可能性
        });

        it('should handle empty source object', () => {
            const frames = [
                { source: { path: '/A.java' } },
                { source: {} },  // path プロパティがない
                { source: { path: '/B.java' } }
            ];

            const paths = extractPaths(frames);
            expect(paths).to.have.lengthOf(2);
        });

        it('should handle source.path being empty string', () => {
            const frames = [
                { source: { path: '/A.java' } },
                { source: { path: '' } },  // 空文字列
                { source: { path: '/B.java' } }
            ];

            const paths = extractPaths(frames);
            // filter(p => p) は空文字列を除外する
            expect(paths).to.have.lengthOf(2);
        });
    });
});
