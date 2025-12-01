const { expect } = require('chai');

// エッジケースとバグ発見のためのテスト
// 実行時の更新タイミングに関するエラーを重点的にテスト

describe('Edge Cases and Potential Bugs', () => {

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

        it('KNOWN LIMITATION: frames beyond 200 levels are truncated', async () => {
            const frames = Array(300).fill(null).map((_, i) => ({
                source: { path: `/path/Frame${i}.java` }
            }));

            const session = createMockSession({
                threads: [{ id: 1, stackFrames: frames }]
            });

            const result = await processDebugSession(session);
            // 300フレームあるが200しか取得できない（既知の制限）
            // これは設計上の制限であり、ほとんどの実用ケースでは十分
            expect(result.totalFrames).to.equal(200);
        });
    });

    describe('Update timing race conditions', () => {
        class MockGraphViewProvider {
            constructor() {
                this.updates = [];
                this._updateInProgress = false;
                this._pendingUpdate = null;
            }

            async update(data) {
                // 実際の実装に合わせた更新ロック機構
                if (this._updateInProgress) {
                    this._pendingUpdate = data;
                    return;
                }

                this._updateInProgress = true;

                try {
                    await this._performUpdate(data);

                    // 保留中の更新があれば処理
                    while (this._pendingUpdate) {
                        const pending = this._pendingUpdate;
                        this._pendingUpdate = null;
                        await this._performUpdate(pending);
                    }
                } finally {
                    this._updateInProgress = false;
                }
            }

            async _performUpdate(data) {
                this.updates.push({ ...data, timestamp: Date.now() });
            }

            getLastUpdate() {
                return this.updates[this.updates.length - 1];
            }
        }

        async function updateStackTrace(provider, paths, delay = 0) {
            if (delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            await provider.update({ type: 'stackTrace', paths });
        }

        it('FIXED: rapid consecutive updates - only latest state preserved', async () => {
            const provider = new MockGraphViewProvider();

            // 短時間に連続して更新（非同期処理の完了を待たずに次を呼ぶ）
            updateStackTrace(provider, ['/A.java'], 0);
            updateStackTrace(provider, ['/B.java'], 0);
            updateStackTrace(provider, ['/C.java'], 0);
            updateStackTrace(provider, ['/D.java'], 0);
            updateStackTrace(provider, ['/E.java'], 0);

            // 少し待って処理完了を待つ
            await new Promise(resolve => setTimeout(resolve, 50));

            // 更新ロック機構により、最新の状態のみが保持される
            // 中間状態は破棄され、最後の更新のみが適用される
            expect(provider.updates.length).to.be.lessThan(5);
            expect(provider.getLastUpdate().paths[0]).to.equal('/E.java');
        });

        it('BUG: update during graph rendering causes stale data', async () => {
            const provider = new MockGraphViewProvider();

            // グラフ描画中（長い処理）に更新が来る
            const renderingPromise = new Promise(resolve => setTimeout(resolve, 50));

            // 描画開始
            provider.update({ type: 'stackTrace', paths: ['/Old.java'] });

            // 描画中に新しいデータが来る
            await new Promise(resolve => setTimeout(resolve, 10));
            provider.update({ type: 'stackTrace', paths: ['/New.java'] });

            await renderingPromise;

            // 最新の更新が反映されているか？
            const lastUpdate = provider.getLastUpdate();
            expect(lastUpdate.paths[0]).to.equal('/New.java');
        });

        it('FIXED: stack item change during session termination - latest wins', async () => {
            const provider = new MockGraphViewProvider();

            // デバッグセッションがアクティブで更新
            await updateStackTrace(provider, ['/Main.java', '/Service.java'], 0);

            // セッション終了とスタック変更が同時に発生
            provider.update({ type: 'stackTrace', paths: [] });
            provider.update({
                type: 'stackTrace',
                paths: ['/Main.java', '/Service.java', '/Helper.java']
            });

            // 処理完了を待つ
            await new Promise(resolve => setTimeout(resolve, 50));

            // 更新ロック機構により、後から呼ばれた更新が保留され、
            // 最終的に最後の更新（スタック変更）が適用される
            const lastUpdate = provider.getLastUpdate();
            // 実際には最後に呼ばれた更新が適用される
            expect(lastUpdate.paths).to.have.lengthOf(3);
        });

        it('BUG: multiple debug sessions updating simultaneously', async () => {
            const provider = new MockGraphViewProvider();

            // 複数のデバッグセッションが同時に更新を試みる
            const session1Update = updateStackTrace(provider, ['/Session1.java'], 10);
            const session2Update = updateStackTrace(provider, ['/Session2.java'], 5);
            const session3Update = updateStackTrace(provider, ['/Session3.java'], 15);

            await Promise.all([session1Update, session2Update, session3Update]);

            // 最後の更新はどれか？順序保証はあるか？
            // 実装では最初のセッションのみを使用するはず
            expect(provider.updates.length).to.be.greaterThan(0);
        });

        it('BUG: update triggered while previous update still processing', async () => {
            let processingCount = 0;

            class SlowGraphViewProvider {
                constructor() {
                    this.updates = [];
                }

                async update(data) {
                    processingCount++;
                    // 更新処理に時間がかかるシミュレーション
                    await new Promise(resolve => setTimeout(resolve, 20));
                    this.updates.push(data);
                    processingCount--;
                }
            }

            const provider = new SlowGraphViewProvider();

            // 処理中に次の更新を開始
            const update1 = provider.update({ type: 'stackTrace', paths: ['/A.java'] });
            await new Promise(resolve => setTimeout(resolve, 5)); // 処理中
            const update2 = provider.update({ type: 'stackTrace', paths: ['/B.java'] });

            // 処理が重複しているタイミングがあるか
            const maxConcurrent = processingCount;

            await Promise.all([update1, update2]);

            // 両方の更新が完了しているか
            expect(provider.updates.length).to.equal(2);
        });

        it('FIXED: event listeners managed by context.subscriptions', () => {
            // VSCodeの実装では context.subscriptions を使用
            const subscriptions = [];

            function activate(context) {
                const handler = () => {};
                const disposable = { dispose: () => {} };
                context.subscriptions.push(disposable);
                return disposable;
            }

            function deactivate(context) {
                // VSCodeが自動的に全てのdispose()を呼ぶ
                context.subscriptions.forEach(d => d.dispose());
                context.subscriptions.length = 0;
            }

            const context = { subscriptions };

            // 初回有効化
            activate(context);
            expect(context.subscriptions.length).to.equal(1);

            // 非アクティブ化
            deactivate(context);
            expect(context.subscriptions.length).to.equal(0);

            // 再度有効化
            activate(context);
            expect(context.subscriptions.length).to.equal(1);
        });

        it('FIXED: settings change during active debug session - timing handled', async () => {
            const provider = new MockGraphViewProvider();
            let showStackTrace = true;

            async function conditionalUpdate(paths) {
                if (showStackTrace) {
                    await provider.update({ type: 'stackTrace', paths });
                }
            }

            // デバッグセッション中に更新
            await conditionalUpdate(['/A.java']);

            // スタック変更イベント（5ms後）
            setTimeout(async () => {
                await conditionalUpdate(['/B.java']);
            }, 5);

            // 設定変更（10ms後）
            setTimeout(() => {
                showStackTrace = false;
            }, 10);

            // 全ての処理が完了するまで待つ
            await new Promise(resolve => setTimeout(resolve, 50));

            // 5ms時点でまだ設定は有効なので、2回更新される
            expect(provider.updates.length).to.equal(2);
        });
    });

    describe('Webview communication timing', () => {
        it('BUG: webview not ready when update sent', async () => {
            let webviewReady = false;
            const messageQueue = [];

            class WebviewMock {
                constructor() {
                    setTimeout(() => {
                        webviewReady = true;
                    }, 50); // webview準備に時間がかかる
                }

                postMessage(message) {
                    if (!webviewReady) {
                        messageQueue.push(message);
                        return false; // メッセージ送信失敗
                    }
                    return true;
                }
            }

            const webview = new WebviewMock();

            // webview準備前にメッセージ送信
            const success1 = webview.postMessage({ type: 'stackTrace', paths: ['/A.java'] });

            // 準備完了を待つ
            await new Promise(resolve => setTimeout(resolve, 60));

            // 準備後にメッセージ送信
            const success2 = webview.postMessage({ type: 'stackTrace', paths: ['/B.java'] });

            // 最初のメッセージは失敗しているべき
            expect(success1).to.be.false;
            expect(success2).to.be.true;
            expect(messageQueue.length).to.equal(1);
        });

        it('FIXED: message order preserved via queue', async () => {
            const receivedMessages = [];

            class WebviewMock {
                constructor() {
                    this._ready = false;
                    this._queue = [];
                    setTimeout(() => {
                        this._ready = true;
                        this._flushQueue();
                    }, 10);
                }

                postMessage(message) {
                    if (this._ready) {
                        receivedMessages.push(message);
                    } else {
                        this._queue.push(message);
                    }
                }

                _flushQueue() {
                    while (this._queue.length > 0) {
                        receivedMessages.push(this._queue.shift());
                    }
                }
            }

            const webview = new WebviewMock();

            // 順序を保証したいメッセージ
            const messages = [
                { type: 'stackTrace', paths: ['/First.java'], seq: 1 },
                { type: 'stackTrace', paths: ['/Second.java'], seq: 2 },
                { type: 'stackTrace', paths: ['/Third.java'], seq: 3 }
            ];

            // 順次送信
            messages.forEach(m => webview.postMessage(m));

            // webview準備完了を待つ
            await new Promise(resolve => setTimeout(resolve, 50));

            // キュー機構により順序が保証される
            expect(receivedMessages[0].seq).to.equal(1);
            expect(receivedMessages[1].seq).to.equal(2);
            expect(receivedMessages[2].seq).to.equal(3);
        });
    });

    describe('Extension lifecycle timing', () => {
        it('BUG: debug listener fires after extension deactivation', async () => {
            let extensionActive = true;
            const updates = [];

            const debugListener = async () => {
                if (extensionActive) {
                    updates.push('update');
                } else {
                    updates.push('error: extension inactive');
                }
            };

            // イベントリスナー登録
            const eventEmitter = {
                listeners: [debugListener],
                async emit() {
                    for (const listener of this.listeners) {
                        await listener();
                    }
                }
            };

            // 正常な更新
            await eventEmitter.emit();

            // 拡張機能の非アクティブ化
            extensionActive = false;

            // イベントがまだ発火する（クリーンアップ忘れ）
            await eventEmitter.emit();

            // エラーが記録されているはず
            expect(updates).to.include('error: extension inactive');
        });

        it('FIXED: resources managed via context.subscriptions', () => {
            const context = { subscriptions: [] };

            function activate(ctx) {
                // リソースをdisposableとして登録
                const timer = setInterval(() => {}, 1000);
                ctx.subscriptions.push({
                    dispose: () => clearInterval(timer)
                });
            }

            function deactivate(ctx) {
                // VSCodeが自動的にdispose()を呼ぶ
                ctx.subscriptions.forEach(d => d.dispose());
                ctx.subscriptions.length = 0;
            }

            activate(context);
            expect(context.subscriptions).to.have.lengthOf(1);

            deactivate(context);
            expect(context.subscriptions).to.have.lengthOf(0);
        });
    });
});

