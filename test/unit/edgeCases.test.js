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

        it('BUG: matches when both basenames are empty string', () => {
            const nodes = [
                { id: 'test', filePath: '/path/to/' }  // 末尾がスラッシュ
            ];
            const path = '/another/path/';

            const matched = matchNode(nodes, path);
            // 両方とも basename が空文字列 '' になる
            // '' === '' で true になり、誤マッチする
            expect(matched).to.be.undefined;
        });

        it('BUG: basename matching causes ambiguous matches', () => {
            const nodes = [
                { id: 'UserService', filePath: '/path/UserService.java' },
                { id: 'UserServiceImpl', filePath: '/path/UserServiceImpl.java' }
            ];
            const path = '/other/UserServiceImpl.java';

            const matched = matchNode(nodes, path);
            // basename だけで判定すると UserServiceImpl が欲しいのに
            // find() が順序依存なので UserService を返す可能性がある
            // これは basename === basename のマッチングの問題
            expect(matched.id).to.equal('UserServiceImpl');
        });

        it('BUG: Windows-style paths do not match Unix-style paths', () => {
            const nodes = [
                { id: 'test', filePath: 'C:\\Users\\project\\src\\Main.java' }
            ];
            const path = '/Users/project/src/Main.java';  // Unix style

            const matched = matchNode(nodes, path);
            // Windows の \ と Unix の / が混在すると完全一致しない
            // basename は 'Main.java' で同じだがマッチするか？
            // split('/') は Windows パスを正しく分割できない
            expect(matched).to.not.be.undefined;
        });

        it('BUG: endsWith matching is too greedy', () => {
            const nodes = [
                { id: 'common', filePath: 'util/Common.java' },
                { id: 'specific', filePath: '/project/src/main/java/com/example/util/Common.java' }
            ];
            const path = '/project/src/main/java/com/example/util/Common.java';

            const matched = matchNode(nodes, path);
            // path.endsWith('util/Common.java') は両方 true
            // find() で最初にマッチするのは 'common' だが、本当は 'specific' が欲しい
            expect(matched.id).to.equal('specific');
        });

        it('BUG: normalized vs non-normalized paths', () => {
            const nodes = [
                { id: 'test', filePath: '/project/src/Main.java' }
            ];
            const path = '/project/src/../src/Main.java';  // 正規化されていない

            const matched = matchNode(nodes, path);
            // 正規化されていないパスは完全一致しないが、
            // basename は同じなのでマッチしてしまう
            expect(matched).to.be.undefined;
        });
    });

    describe('Stack trace collection edge cases', () => {
        async function processDebugSession(session) {
            const threadsResponse = await session.customRequest('threads');
            const threads = threadsResponse.threads;

            let totalFrames = 0;
            let allFrames = [];

            for (const thread of threads) {
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
                    // エラーは無視
                }
            }

            return { totalFrames, frames: allFrames };
        }

        function createMockSession(config) {
            return {
                customRequest: async (command, args) => {
                    if (command === 'threads') {
                        return { threads: config.threads || [] };
                    }
                    if (command === 'stackTrace') {
                        const thread = config.threads.find(t => t.id === args.threadId);
                        if (!thread || !thread.stackFrames) {
                            return { stackFrames: [] };
                        }
                        return { stackFrames: thread.stackFrames.slice(0, args.levels) };
                    }
                }
            };
        }

        it('BUG: does not handle frames beyond 200 levels limit', async () => {
            const frames = Array(300).fill(null).map((_, i) => ({
                source: { path: `/path/Frame${i}.java` }
            }));

            const session = createMockSession({
                threads: [{ id: 1, stackFrames: frames }]
            });

            const result = await processDebugSession(session);
            // 300フレームあるが200しか取得できない
            // 深い再帰などで情報が失われる
            expect(result.totalFrames).to.equal(300);
        });
    });

    describe('Update timing race conditions', () => {
        class MockGraphViewProvider {
            constructor() {
                this.updates = [];
            }

            update(data) {
                this.updates.push({ ...data });
            }
        }

        async function updateStackTrace(provider, paths, delay = 0) {
            if (delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            provider.update({ type: 'stackTrace', paths });
        }

        it('BUG: update order not guaranteed with async delays', async () => {
            const provider = new MockGraphViewProvider();

            // 異なる遅延で更新（短い遅延が先に完了する）
            const promises = [
                updateStackTrace(provider, ['/A.java'], 30),
                updateStackTrace(provider, ['/B.java'], 20),
                updateStackTrace(provider, ['/C.java'], 10)
            ];

            await Promise.all(promises);

            // 期待: C, B, A の順序で完了するはず
            // しかし、呼び出し順序（A, B, C）で適用される可能性がある
            expect(provider.updates[0].paths[0]).to.equal('/C.java');
            expect(provider.updates[1].paths[0]).to.equal('/B.java');
            expect(provider.updates[2].paths[0]).to.equal('/A.java');
        });
    });

    describe('Performance edge cases', () => {
        it('BUG: linear search is slow for large node counts', () => {
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
            // O(n) の線形検索は遅すぎる
            // 100,000ノードで許容できる速度か？
            expect(duration).to.be.below(100);  // 100ms以内を期待
        });
    });

    describe('Null and undefined handling', () => {
        function extractPaths(frames) {
            return frames
                .map(f => f.source?.path)
                .filter(p => p);
        }

        it('BUG: crashes on null frames in array', () => {
            const frames = [
                { source: { path: '/A.java' } },
                null,  // frame 自体が null
                { source: { path: '/B.java' } }
            ];

            // map で null.source にアクセスするとエラー
            // オプショナルチェーン ?. は使っているが、null は通過する
            expect(() => extractPaths(frames)).to.not.throw();
        });

        it('BUG: empty string paths are filtered but might cause issues', () => {
            const frames = [
                { source: { path: '' } },  // 空文字列
                { source: { path: '   ' } },  // スペースのみ
            ];

            const paths = extractPaths(frames);
            // filter(p => p) は空文字列は除外するが、
            // スペースのみの文字列は truthy なので残る
            expect(paths).to.have.lengthOf(0);
        });
    });
});

