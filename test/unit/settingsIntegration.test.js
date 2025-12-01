const { expect } = require('chai');

// 設定とグラフの連携をテスト
// ConfigurationManager と GraphViewProvider の連携

describe('Settings and Graph Integration', () => {
    // ConfigurationManager のモック
    class MockConfigurationManager {
        constructor(initialControls = {}) {
            this.controls = {
                search: '',
                showStackTrace: true,
                showNames: true,
                shortNames: true,
                nodeSize: 1.0,
                linkWidth: 1.0,
                showClass: true,
                showInterface: true,
                showMethodCall: true,
                ...initialControls
            };
        }

        loadControls() {
            return { ...this.controls };
        }

        updateControl(key, value) {
            this.controls[key] = value;
        }

        updateControls(updates) {
            this.controls = { ...this.controls, ...updates };
        }
    }

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

        getUpdatesByType(type) {
            return this.updates.filter(u => u.type === type);
        }
    }

    describe('showStackTrace setting integration', () => {
        let configManager;
        let graphProvider;

        beforeEach(() => {
            configManager = new MockConfigurationManager();
            graphProvider = new MockGraphViewProvider();
        });

        function syncControls(configManager, graphProvider, shouldUpdateStackTrace) {
            graphProvider.update({ type: 'controls' });
            const controls = configManager.loadControls();

            if (controls.showStackTrace && shouldUpdateStackTrace) {
                // updateStackTrace would be called here
                return true;
            }
            return false;
        }

        it('should enable stack trace updates when setting is true', () => {
            configManager.updateControl('showStackTrace', true);
            const shouldUpdate = syncControls(configManager, graphProvider, true);

            expect(shouldUpdate).to.be.true;
        });

        it('should disable stack trace updates when setting is false', () => {
            configManager.updateControl('showStackTrace', false);
            const shouldUpdate = syncControls(configManager, graphProvider, true);

            expect(shouldUpdate).to.be.false;
        });

        it('should update controls on graph when syncing', () => {
            syncControls(configManager, graphProvider, false);

            const controlUpdates = graphProvider.getUpdatesByType('controls');
            expect(controlUpdates).to.have.lengthOf(1);
        });
    });

    describe('Setting changes triggering updates', () => {
        let configManager;
        let graphProvider;

        beforeEach(() => {
            configManager = new MockConfigurationManager();
            graphProvider = new MockGraphViewProvider();
        });

        function handleSettingChange(configManager, graphProvider, changedSettings) {
            configManager.updateControls(changedSettings);
            graphProvider.update({ type: 'controls' });

            // If showStackTrace changed to true, trigger stack trace update
            if (changedSettings.showStackTrace === true) {
                graphProvider.update({ type: 'stackTrace', paths: [] });
            }
        }

        it('should trigger control update when any setting changes', () => {
            handleSettingChange(configManager, graphProvider, { nodeSize: 2.0 });

            const updates = graphProvider.getUpdatesByType('controls');
            expect(updates).to.have.lengthOf(1);
        });

        it('should trigger stack trace update when showStackTrace enabled', () => {
            handleSettingChange(configManager, graphProvider, { showStackTrace: true });

            const stackTraceUpdates = graphProvider.getUpdatesByType('stackTrace');
            expect(stackTraceUpdates).to.have.lengthOf(1);
        });

        it('should not trigger stack trace update when other settings change', () => {
            handleSettingChange(configManager, graphProvider, { nodeSize: 2.0 });

            const stackTraceUpdates = graphProvider.getUpdatesByType('stackTrace');
            expect(stackTraceUpdates).to.have.lengthOf(0);
        });

        it('should handle multiple setting changes', () => {
            handleSettingChange(configManager, graphProvider, {
                nodeSize: 2.0,
                linkWidth: 1.5,
                showNames: false
            });

            const controls = configManager.loadControls();
            expect(controls.nodeSize).to.equal(2.0);
            expect(controls.linkWidth).to.equal(1.5);
            expect(controls.showNames).to.equal(false);
        });
    });

    describe('Filter settings integration', () => {
        let configManager;

        beforeEach(() => {
            configManager = new MockConfigurationManager();
        });

        function applyFilters(data, controls) {
            const { nodes, links } = data;

            // ノードタイプフィルター
            const filteredNodes = nodes.filter(node => {
                if (node.type === 'Class' && !controls.showClass) return false;
                if (node.type === 'Interface' && !controls.showInterface) return false;
                return true;
            });

            // エッジタイプフィルター
            const filteredLinks = links.filter(link => {
                if (link.type === 'MethodCall' && !controls.showMethodCall) return false;
                return true;
            });

            return { nodes: filteredNodes, links: filteredLinks };
        }

        it('should filter nodes by type based on settings', () => {
            const data = {
                nodes: [
                    { id: 'A', type: 'Class' },
                    { id: 'B', type: 'Interface' },
                    { id: 'C', type: 'Class' }
                ],
                links: []
            };

            configManager.updateControl('showClass', false);
            const controls = configManager.loadControls();
            const filtered = applyFilters(data, controls);

            expect(filtered.nodes).to.have.lengthOf(1);
            expect(filtered.nodes[0].type).to.equal('Interface');
        });

        it('should filter links by type based on settings', () => {
            const data = {
                nodes: [],
                links: [
                    { source: 'A', target: 'B', type: 'MethodCall' },
                    { source: 'B', target: 'C', type: 'Extends' },
                    { source: 'C', target: 'D', type: 'MethodCall' }
                ]
            };

            configManager.updateControl('showMethodCall', false);
            const controls = configManager.loadControls();
            const filtered = applyFilters(data, controls);

            expect(filtered.links).to.have.lengthOf(1);
            expect(filtered.links[0].type).to.equal('Extends');
        });

        it('should preserve all nodes when all filters enabled', () => {
            const data = {
                nodes: [
                    { id: 'A', type: 'Class' },
                    { id: 'B', type: 'Interface' }
                ],
                links: []
            };

            configManager.updateControls({
                showClass: true,
                showInterface: true
            });

            const controls = configManager.loadControls();
            const filtered = applyFilters(data, controls);

            expect(filtered.nodes).to.have.lengthOf(2);
        });
    });

    describe('Search functionality integration', () => {
        function searchNodes(nodes, searchQuery) {
            if (!searchQuery) return nodes;

            const lowerQuery = searchQuery.toLowerCase();
            return nodes.filter(node => {
                return node.id.toLowerCase().includes(lowerQuery) ||
                       (node.name && node.name.toLowerCase().includes(lowerQuery));
            });
        }

        it('should filter nodes by search query', () => {
            const nodes = [
                { id: 'com.example.UserService', name: 'UserService' },
                { id: 'com.example.ProductService', name: 'ProductService' },
                { id: 'com.example.OrderService', name: 'OrderService' }
            ];

            const results = searchNodes(nodes, 'User');
            expect(results).to.have.lengthOf(1);
            expect(results[0].id).to.include('User');
        });

        it('should return all nodes when search query is empty', () => {
            const nodes = [
                { id: 'com.example.A', name: 'A' },
                { id: 'com.example.B', name: 'B' }
            ];

            const results = searchNodes(nodes, '');
            expect(results).to.have.lengthOf(2);
        });

        it('should be case-insensitive', () => {
            const nodes = [
                { id: 'com.example.UserService', name: 'UserService' }
            ];

            const results1 = searchNodes(nodes, 'user');
            const results2 = searchNodes(nodes, 'USER');
            const results3 = searchNodes(nodes, 'User');

            expect(results1).to.have.lengthOf(1);
            expect(results2).to.have.lengthOf(1);
            expect(results3).to.have.lengthOf(1);
        });

        it('should search in both id and name', () => {
            const nodes = [
                { id: 'com.example.Service', name: 'UserService' }
            ];

            const resultsById = searchNodes(nodes, 'example');
            const resultsByName = searchNodes(nodes, 'User');

            expect(resultsById).to.have.lengthOf(1);
            expect(resultsByName).to.have.lengthOf(1);
        });
    });

    describe('Settings persistence', () => {
        it('should maintain settings across updates', () => {
            const configManager = new MockConfigurationManager({
                nodeSize: 1.5,
                linkWidth: 2.0
            });

            // 複数回読み込んでも同じ値
            const controls1 = configManager.loadControls();
            const controls2 = configManager.loadControls();

            expect(controls1.nodeSize).to.equal(1.5);
            expect(controls2.nodeSize).to.equal(1.5);
        });

        it('should update settings correctly', () => {
            const configManager = new MockConfigurationManager();

            configManager.updateControl('nodeSize', 3.0);
            const controls = configManager.loadControls();

            expect(controls.nodeSize).to.equal(3.0);
        });

        it('should merge multiple setting updates', () => {
            const configManager = new MockConfigurationManager();

            configManager.updateControls({
                nodeSize: 2.5,
                linkWidth: 1.5,
                showNames: false
            });

            const controls = configManager.loadControls();

            expect(controls.nodeSize).to.equal(2.5);
            expect(controls.linkWidth).to.equal(1.5);
            expect(controls.showNames).to.equal(false);
            // 他の設定は変更されない
            expect(controls.showStackTrace).to.equal(true);
        });
    });

    describe('Complex integration scenarios', () => {
        it('should handle showStackTrace toggle with active debug session', () => {
            const configManager = new MockConfigurationManager({ showStackTrace: false });
            const graphProvider = new MockGraphViewProvider();

            // showStackTrace を有効化
            configManager.updateControl('showStackTrace', true);
            graphProvider.update({ type: 'controls' });

            // デバッグセッションがアクティブならスタックトレースを更新
            const hasActiveSession = true;
            if (hasActiveSession && configManager.loadControls().showStackTrace) {
                graphProvider.update({
                    type: 'stackTrace',
                    paths: ['/path/Main.java', '/path/Service.java']
                });
            }

            const stackTraceUpdates = graphProvider.getUpdatesByType('stackTrace');
            expect(stackTraceUpdates).to.have.lengthOf(1);
            expect(stackTraceUpdates[0].data.paths).to.have.lengthOf(2);
        });

        it('should clear stack trace when showStackTrace disabled', () => {
            const configManager = new MockConfigurationManager({ showStackTrace: true });
            const graphProvider = new MockGraphViewProvider();

            // 最初にスタックトレースを設定
            graphProvider.update({
                type: 'stackTrace',
                paths: ['/path/Main.java']
            });

            // showStackTrace を無効化
            configManager.updateControl('showStackTrace', false);

            // スタックトレースをクリア
            if (!configManager.loadControls().showStackTrace) {
                graphProvider.update({ type: 'stackTrace', paths: [] });
            }

            const stackTraceUpdates = graphProvider.getUpdatesByType('stackTrace');
            expect(stackTraceUpdates).to.have.lengthOf(2);
            expect(stackTraceUpdates[1].data.paths).to.have.lengthOf(0);
        });

        it('should coordinate filter and search settings', () => {
            const configManager = new MockConfigurationManager();
            const data = {
                nodes: [
                    { id: 'com.example.UserService', type: 'Class' },
                    { id: 'com.example.UserInterface', type: 'Interface' },
                    { id: 'com.example.ProductService', type: 'Class' }
                ],
                links: []
            };

            // フィルター適用
            configManager.updateControl('showInterface', false);
            let controls = configManager.loadControls();
            let filtered = data.nodes.filter(n =>
                !(n.type === 'Interface' && !controls.showInterface)
            );

            // 検索適用
            configManager.updateControl('search', 'User');
            controls = configManager.loadControls();
            const searchQuery = controls.search.toLowerCase();
            filtered = filtered.filter(n =>
                n.id.toLowerCase().includes(searchQuery)
            );

            // UserServiceのみが残る（UserInterfaceはInterfaceなので除外）
            expect(filtered).to.have.lengthOf(1);
            expect(filtered[0].id).to.equal('com.example.UserService');
        });
    });
});
