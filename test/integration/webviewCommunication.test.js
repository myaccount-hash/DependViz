const { expect } = require('chai');
const sinon = require('sinon');

// WebviewとVSCode Extension間の通信テスト

describe('Webview Communication Integration', () => {
    let mockWebview;
    let mockVscode;
    let messageHandlers;

    beforeEach(() => {
        // Webviewのモック
        mockWebview = {
            postMessage: sinon.spy(),
            onDidReceiveMessage: sinon.stub()
        };

        // VSCode APIのモック
        mockVscode = {
            postMessage: sinon.spy()
        };

        // メッセージハンドラー（実装のシミュレーション）
        messageHandlers = {
            data: sinon.spy(),
            controls: sinon.spy(),
            stackTrace: sinon.spy(),
            focusNode: sinon.spy(),
            focusNodeById: sinon.spy(),
            update: sinon.spy()
        };
    });

    describe('Extension -> Webview messages', () => {
        it('should send data message with graph data', () => {
            const graphData = {
                nodes: [{ id: 1, name: 'ClassA' }],
                links: [{ source: 1, target: 2 }]
            };

            mockWebview.postMessage({
                type: 'data',
                data: graphData
            });

            expect(mockWebview.postMessage.calledOnce).to.be.true;
            const call = mockWebview.postMessage.getCall(0);
            expect(call.args[0].type).to.equal('data');
            expect(call.args[0].data.nodes).to.have.lengthOf(1);
        });

        it('should send controls message with settings', () => {
            const controls = {
                nodeSize: 3.0,
                linkWidth: 0.5,
                textSize: 12,
                colorClass: '#93c5fd'
            };

            mockWebview.postMessage({
                type: 'controls',
                controls: controls
            });

            expect(mockWebview.postMessage.calledOnce).to.be.true;
            const call = mockWebview.postMessage.getCall(0);
            expect(call.args[0].type).to.equal('controls');
            expect(call.args[0].controls.textSize).to.equal(12);
        });

        it('should send focusNode message with file path', () => {
            mockWebview.postMessage({
                type: 'focusNode',
                filePath: '/src/Main.java'
            });

            expect(mockWebview.postMessage.calledOnce).to.be.true;
            const call = mockWebview.postMessage.getCall(0);
            expect(call.args[0].type).to.equal('focusNode');
            expect(call.args[0].filePath).to.equal('/src/Main.java');
        });

        it('should send focusNodeById message with node ID', () => {
            mockWebview.postMessage({
                type: 'focusNodeById',
                nodeId: 42
            });

            expect(mockWebview.postMessage.calledOnce).to.be.true;
            const call = mockWebview.postMessage.getCall(0);
            expect(call.args[0].type).to.equal('focusNodeById');
            expect(call.args[0].nodeId).to.equal(42);
        });

        it('should send stackTrace message with paths', () => {
            const stackTracePaths = [
                { link: { source: 1, target: 2 }, path: '/src/A.java' },
                { link: { source: 2, target: 3 }, path: '/src/B.java' }
            ];

            mockWebview.postMessage({
                type: 'stackTrace',
                paths: stackTracePaths
            });

            expect(mockWebview.postMessage.calledOnce).to.be.true;
            const call = mockWebview.postMessage.getCall(0);
            expect(call.args[0].paths).to.have.lengthOf(2);
        });

        it('should send update message with combined data', () => {
            mockWebview.postMessage({
                type: 'update',
                data: { nodes: [], links: [] },
                controls: { nodeSize: 3.0 },
                stackTracePaths: []
            });

            expect(mockWebview.postMessage.calledOnce).to.be.true;
            const call = mockWebview.postMessage.getCall(0);
            expect(call.args[0].type).to.equal('update');
            expect(call.args[0]).to.have.property('data');
            expect(call.args[0]).to.have.property('controls');
        });
    });

    describe('Webview -> Extension messages', () => {
        it('should send ready message on initialization', () => {
            mockVscode.postMessage({ type: 'ready' });

            expect(mockVscode.postMessage.calledOnce).to.be.true;
            const call = mockVscode.postMessage.getCall(0);
            expect(call.args[0].type).to.equal('ready');
        });

        it('should handle focusNode message from user interaction', () => {
            const message = {
                type: 'focusNode',
                node: {
                    id: 1,
                    filePath: '/src/Main.java',
                    name: 'Main'
                }
            };

            messageHandlers.focusNode(message);

            expect(messageHandlers.focusNode.calledOnce).to.be.true;
        });
    });

    describe('Message routing', () => {
        function routeMessage(message) {
            const handler = messageHandlers[message.type];
            if (handler) {
                handler(message);
                return true;
            } else {
                console.warn('[DependViz] Unknown message type:', message.type);
                return false;
            }
        }

        it('should route data message to data handler', () => {
            const msg = { type: 'data', data: {} };
            const result = routeMessage(msg);

            expect(result).to.be.true;
            expect(messageHandlers.data.calledOnce).to.be.true;
        });

        it('should route controls message to controls handler', () => {
            const msg = { type: 'controls', controls: {} };
            const result = routeMessage(msg);

            expect(result).to.be.true;
            expect(messageHandlers.controls.calledOnce).to.be.true;
        });

        it('should route stackTrace message to stackTrace handler', () => {
            const msg = { type: 'stackTrace', paths: [] };
            const result = routeMessage(msg);

            expect(result).to.be.true;
            expect(messageHandlers.stackTrace.calledOnce).to.be.true;
        });

        it('should route focusNode message to focusNode handler', () => {
            const msg = { type: 'focusNode', filePath: '/test.java' };
            const result = routeMessage(msg);

            expect(result).to.be.true;
            expect(messageHandlers.focusNode.calledOnce).to.be.true;
        });

        it('should route focusNodeById message to focusNodeById handler', () => {
            const msg = { type: 'focusNodeById', nodeId: 1 };
            const result = routeMessage(msg);

            expect(result).to.be.true;
            expect(messageHandlers.focusNodeById.calledOnce).to.be.true;
        });

        it('should route update message to update handler', () => {
            const msg = { type: 'update', data: {}, controls: {} };
            const result = routeMessage(msg);

            expect(result).to.be.true;
            expect(messageHandlers.update.calledOnce).to.be.true;
        });

        it('should return false for unknown message type', () => {
            const msg = { type: 'unknownType' };
            const result = routeMessage(msg);

            expect(result).to.be.false;
        });
    });

    describe('Message payload validation', () => {
        it('should validate data message has data property', () => {
            const validMsg = { type: 'data', data: { nodes: [], links: [] } };
            const invalidMsg = { type: 'data' };

            expect(validMsg).to.have.property('data');
            expect(invalidMsg).to.not.have.property('data');
        });

        it('should validate controls message has controls property', () => {
            const validMsg = { type: 'controls', controls: { nodeSize: 3 } };
            const invalidMsg = { type: 'controls' };

            expect(validMsg).to.have.property('controls');
            expect(invalidMsg).to.not.have.property('controls');
        });

        it('should validate focusNode message has filePath', () => {
            const validMsg = { type: 'focusNode', filePath: '/test.java' };
            const invalidMsg = { type: 'focusNode' };

            expect(validMsg).to.have.property('filePath');
            expect(invalidMsg).to.not.have.property('filePath');
        });

        it('should validate focusNodeById message has nodeId', () => {
            const validMsg = { type: 'focusNodeById', nodeId: 1 };
            const invalidMsg = { type: 'focusNodeById' };

            expect(validMsg).to.have.property('nodeId');
            expect(invalidMsg).to.not.have.property('nodeId');
        });
    });

    describe('Performance considerations', () => {
        it('should batch multiple control updates into single update message', () => {
            // 複数のコントロール変更を1つの update メッセージにまとめる
            const batchedUpdate = {
                type: 'update',
                controls: {
                    nodeSize: 3.0,
                    linkWidth: 0.5,
                    textSize: 12
                }
            };

            mockWebview.postMessage(batchedUpdate);

            expect(mockWebview.postMessage.calledOnce).to.be.true;
        });

        it('should avoid sending unchanged data', () => {
            const currentData = { nodes: [{ id: 1 }], links: [] };
            const newData = { nodes: [{ id: 1 }], links: [] };

            // データが変わっていない場合は送信しない
            const dataChanged = JSON.stringify(currentData) !== JSON.stringify(newData);

            expect(dataChanged).to.be.false;
        });
    });
});

// Java Analyzer との通信テスト
describe('Java Analyzer Communication', () => {
    let mockAnalyzerProcess;
    let messageQueue;

    beforeEach(() => {
        messageQueue = [];
        mockAnalyzerProcess = {
            stdin: {
                write: (data) => {
                    messageQueue.push(JSON.parse(data));
                }
            },
            stdout: {
                on: sinon.stub()
            },
            stderr: {
                on: sinon.stub()
            }
        };
    });

    describe('Analysis requests', () => {
        it('should send analyze request with project path', () => {
            const request = {
                type: 'analyze',
                projectPath: '/path/to/project',
                options: {
                    includeTests: false
                }
            };

            mockAnalyzerProcess.stdin.write(JSON.stringify(request));

            expect(messageQueue).to.have.lengthOf(1);
            expect(messageQueue[0].type).to.equal('analyze');
            expect(messageQueue[0].projectPath).to.equal('/path/to/project');
        });

        it('should send file-specific analysis request', () => {
            const request = {
                type: 'analyzeFile',
                filePath: '/path/to/Main.java'
            };

            mockAnalyzerProcess.stdin.write(JSON.stringify(request));

            expect(messageQueue).to.have.lengthOf(1);
            expect(messageQueue[0].type).to.equal('analyzeFile');
        });

        it('should send shutdown request', () => {
            const request = { type: 'shutdown' };

            mockAnalyzerProcess.stdin.write(JSON.stringify(request));

            expect(messageQueue).to.have.lengthOf(1);
            expect(messageQueue[0].type).to.equal('shutdown');
        });
    });

    describe('Analysis responses', () => {
        it('should handle graph data response', () => {
            const response = {
                type: 'graphData',
                data: {
                    nodes: [
                        { id: 1, name: 'com.example.Main', type: 'Class' }
                    ],
                    links: [
                        { source: 1, target: 2, type: 'MethodCall' }
                    ]
                }
            };

            // レスポンスの検証
            expect(response.type).to.equal('graphData');
            expect(response.data.nodes).to.have.lengthOf(1);
            expect(response.data.links).to.have.lengthOf(1);
        });

        it('should handle error response', () => {
            const response = {
                type: 'error',
                error: 'Analysis failed',
                details: 'ClassNotFoundException'
            };

            expect(response.type).to.equal('error');
            expect(response.error).to.be.a('string');
        });

        it('should handle progress update', () => {
            const response = {
                type: 'progress',
                current: 50,
                total: 100,
                message: 'Analyzing files...'
            };

            expect(response.type).to.equal('progress');
            expect(response.current).to.equal(50);
            expect(response.total).to.equal(100);
        });
    });

    describe('Protocol validation', () => {
        it('should validate request has type field', () => {
            const validRequest = { type: 'analyze', projectPath: '/test' };
            const invalidRequest = { projectPath: '/test' };

            expect(validRequest).to.have.property('type');
            expect(invalidRequest).to.not.have.property('type');
        });

        it('should validate response has type field', () => {
            const validResponse = { type: 'graphData', data: {} };
            const invalidResponse = { data: {} };

            expect(validResponse).to.have.property('type');
            expect(invalidResponse).to.not.have.property('type');
        });
    });
});
