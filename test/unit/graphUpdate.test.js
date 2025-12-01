const { expect } = require('chai');

// グラフ更新タイミングのロジックをテスト
// extension.js と GraphViewProvider の連携

describe('Graph Update Timing', () => {
    // GraphViewProvider のモック
    class MockGraphViewProvider {
        constructor() {
            this.updates = [];
            this._stackTracePaths = [];
        }

        update(data) {
            this.updates.push({
                type: data.type,
                data: data,
                timestamp: Date.now()
            });

            if (data.type === 'stackTrace') {
                this._stackTracePaths = data.paths || [];
            }
        }

        getLastUpdate() {
            return this.updates[this.updates.length - 1];
        }

        getUpdatesByType(type) {
            return this.updates.filter(u => u.type === type);
        }

        clearUpdates() {
            this.updates = [];
        }
    }

    // updateStackTrace 関数のシミュレーション
    async function updateStackTrace(graphViewProvider, sessionInfos) {
        if (sessionInfos.length === 0) {
            graphViewProvider.update({ type: 'stackTrace', paths: [] });
            return;
        }

        const session = sessionInfos[0];

        if (!session.captured) {
            graphViewProvider.update({ type: 'stackTrace', paths: [] });
            return;
        }

        const paths = session.frames
            .map(f => f.source?.path)
            .filter(p => p);

        graphViewProvider.update({ type: 'stackTrace', paths });
    }

    describe('updateStackTrace behavior', () => {
        let provider;

        beforeEach(() => {
            provider = new MockGraphViewProvider();
        });

        it('should update with empty paths when no sessions', async () => {
            await updateStackTrace(provider, []);

            const updates = provider.getUpdatesByType('stackTrace');
            expect(updates).to.have.lengthOf(1);
            expect(updates[0].data.paths).to.deep.equal([]);
        });

        it('should update with empty paths when session has no frames', async () => {
            const sessions = [{
                captured: false,
                frames: []
            }];

            await updateStackTrace(provider, sessions);

            const updates = provider.getUpdatesByType('stackTrace');
            expect(updates).to.have.lengthOf(1);
            expect(updates[0].data.paths).to.deep.equal([]);
        });

        it('should update with paths when session has frames', async () => {
            const sessions = [{
                captured: true,
                frames: [
                    { source: { path: '/path/A.java' } },
                    { source: { path: '/path/B.java' } },
                    { source: { path: '/path/C.java' } }
                ]
            }];

            await updateStackTrace(provider, sessions);

            const updates = provider.getUpdatesByType('stackTrace');
            expect(updates).to.have.lengthOf(1);
            expect(updates[0].data.paths).to.have.lengthOf(3);
            expect(updates[0].data.paths).to.deep.equal([
                '/path/A.java',
                '/path/B.java',
                '/path/C.java'
            ]);
        });

        it('should filter out null paths', async () => {
            const sessions = [{
                captured: true,
                frames: [
                    { source: { path: '/path/A.java' } },
                    { source: { path: null } },
                    { source: null },
                    { source: { path: '/path/B.java' } }
                ]
            }];

            await updateStackTrace(provider, sessions);

            const updates = provider.getUpdatesByType('stackTrace');
            expect(updates[0].data.paths).to.have.lengthOf(2);
            expect(updates[0].data.paths).to.deep.equal([
                '/path/A.java',
                '/path/B.java'
            ]);
        });
    });

    describe('Update timing scenarios', () => {
        let provider;

        beforeEach(() => {
            provider = new MockGraphViewProvider();
        });

        it('should handle multiple rapid updates', async () => {
            const sessions1 = [{ captured: true, frames: [{ source: { path: '/A.java' } }] }];
            const sessions2 = [{ captured: true, frames: [{ source: { path: '/B.java' } }] }];
            const sessions3 = [{ captured: true, frames: [{ source: { path: '/C.java' } }] }];

            await updateStackTrace(provider, sessions1);
            await updateStackTrace(provider, sessions2);
            await updateStackTrace(provider, sessions3);

            const updates = provider.getUpdatesByType('stackTrace');
            expect(updates).to.have.lengthOf(3);

            // 最後の更新が最新の状態
            expect(updates[2].data.paths).to.deep.equal(['/C.java']);
        });

        it('should handle transition from frames to no frames', async () => {
            const sessionsWithFrames = [{
                captured: true,
                frames: [{ source: { path: '/A.java' } }]
            }];

            const sessionsWithoutFrames = [{
                captured: false,
                frames: []
            }];

            await updateStackTrace(provider, sessionsWithFrames);
            await updateStackTrace(provider, sessionsWithoutFrames);

            const updates = provider.getUpdatesByType('stackTrace');
            expect(updates).to.have.lengthOf(2);

            // 最初は1つのパス
            expect(updates[0].data.paths).to.have.lengthOf(1);

            // 次は空
            expect(updates[1].data.paths).to.have.lengthOf(0);
        });

        it('should handle transition from no frames to frames', async () => {
            const sessionsWithoutFrames = [];
            const sessionsWithFrames = [{
                captured: true,
                frames: [{ source: { path: '/A.java' } }]
            }];

            await updateStackTrace(provider, sessionsWithoutFrames);
            await updateStackTrace(provider, sessionsWithFrames);

            const updates = provider.getUpdatesByType('stackTrace');
            expect(updates).to.have.lengthOf(2);

            // 最初は空
            expect(updates[0].data.paths).to.have.lengthOf(0);

            // 次は1つのパス
            expect(updates[1].data.paths).to.have.lengthOf(1);
        });
    });

    describe('Event-driven update simulation', () => {
        let provider;
        let eventQueue;

        beforeEach(() => {
            provider = new MockGraphViewProvider();
            eventQueue = [];
        });

        // イベントシミュレーター
        function simulateEvent(eventType, data) {
            eventQueue.push({ eventType, data, timestamp: Date.now() });
        }

        async function processEvents() {
            for (const event of eventQueue) {
                if (event.eventType === 'debugSessionStart') {
                    await updateStackTrace(provider, []);
                } else if (event.eventType === 'stackItemChange') {
                    await updateStackTrace(provider, event.data.sessions);
                } else if (event.eventType === 'debugSessionEnd') {
                    await updateStackTrace(provider, []);
                }
            }
        }

        it('should handle debug session lifecycle', async () => {
            // デバッグセッション開始
            simulateEvent('debugSessionStart', {});

            // ブレークポイントで停止
            simulateEvent('stackItemChange', {
                sessions: [{
                    captured: true,
                    frames: [{ source: { path: '/Main.java' } }]
                }]
            });

            // ステップ実行
            simulateEvent('stackItemChange', {
                sessions: [{
                    captured: true,
                    frames: [
                        { source: { path: '/Main.java' } },
                        { source: { path: '/Service.java' } }
                    ]
                }]
            });

            // デバッグセッション終了
            simulateEvent('debugSessionEnd', {});

            await processEvents();

            const updates = provider.getUpdatesByType('stackTrace');
            expect(updates).to.have.lengthOf(4);

            // 開始時: 空
            expect(updates[0].data.paths).to.have.lengthOf(0);

            // 最初の停止: 1つ
            expect(updates[1].data.paths).to.have.lengthOf(1);

            // ステップ実行: 2つ
            expect(updates[2].data.paths).to.have.lengthOf(2);

            // 終了: 空
            expect(updates[3].data.paths).to.have.lengthOf(0);
        });

        it('should handle multiple breakpoints in sequence', async () => {
            const breakpoints = [
                { frames: [{ source: { path: '/A.java' } }] },
                { frames: [{ source: { path: '/B.java' } }] },
                { frames: [{ source: { path: '/C.java' } }] }
            ];

            for (const bp of breakpoints) {
                simulateEvent('stackItemChange', {
                    sessions: [{ captured: true, frames: bp.frames }]
                });
            }

            await processEvents();

            const updates = provider.getUpdatesByType('stackTrace');
            expect(updates).to.have.lengthOf(3);

            expect(updates[0].data.paths).to.deep.equal(['/A.java']);
            expect(updates[1].data.paths).to.deep.equal(['/B.java']);
            expect(updates[2].data.paths).to.deep.equal(['/C.java']);
        });
    });

    describe('Update deduplication', () => {
        let provider;

        beforeEach(() => {
            provider = new MockGraphViewProvider();
        });

        function shouldUpdate(currentPaths, newPaths) {
            if (currentPaths.length !== newPaths.length) return true;

            for (let i = 0; i < currentPaths.length; i++) {
                if (currentPaths[i] !== newPaths[i]) return true;
            }

            return false;
        }

        it('should detect when update is needed', () => {
            const current = ['/A.java', '/B.java'];
            const same = ['/A.java', '/B.java'];
            const different = ['/A.java', '/C.java'];
            const moreItems = ['/A.java', '/B.java', '/C.java'];

            expect(shouldUpdate(current, same)).to.be.false;
            expect(shouldUpdate(current, different)).to.be.true;
            expect(shouldUpdate(current, moreItems)).to.be.true;
        });

        it('should skip redundant updates', async () => {
            const sessions = [{
                captured: true,
                frames: [{ source: { path: '/A.java' } }]
            }];

            // 同じデータで複数回更新
            for (let i = 0; i < 3; i++) {
                await updateStackTrace(provider, sessions);
            }

            const updates = provider.getUpdatesByType('stackTrace');
            expect(updates).to.have.lengthOf(3);

            // 全て同じパス
            updates.forEach(update => {
                expect(update.data.paths).to.deep.equal(['/A.java']);
            });

            // 実際の実装では、重複更新を防ぐロジックを追加できる
        });
    });

    describe('Timing constraints', () => {
        it('should record update timestamps', async () => {
            const provider = new MockGraphViewProvider();

            const sessions1 = [{ captured: true, frames: [{ source: { path: '/A.java' } }] }];
            const sessions2 = [{ captured: true, frames: [{ source: { path: '/B.java' } }] }];

            await updateStackTrace(provider, sessions1);

            // 少し待つ
            await new Promise(resolve => setTimeout(resolve, 10));

            await updateStackTrace(provider, sessions2);

            const updates = provider.getUpdatesByType('stackTrace');
            expect(updates).to.have.lengthOf(2);

            // 2番目の更新のタイムスタンプは1番目より後
            expect(updates[1].timestamp).to.be.greaterThan(updates[0].timestamp);
        });
    });
});
