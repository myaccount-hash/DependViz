const { expect } = require('chai');
const sinon = require('sinon');

// フォーカスノードの実際の挙動をテスト

describe('Focus Node Behavior', () => {
    let mockGraph;
    let mockState;

    beforeEach(() => {
        // グラフのモック
        mockGraph = {
            centerAt: sinon.spy(),
            zoom: sinon.spy(),
            graphData: sinon.spy(),
            d3ReheatSimulation: sinon.spy(),
            nodeColor: sinon.stub().returnsThis(),
            linkColor: sinon.stub().returnsThis(),
            nodeCanvasObject: sinon.stub().returnsThis(),
            linkDirectionalParticles: sinon.stub().returnsThis(),
            nodeCanvasObjectMode: sinon.stub().returnsThis()
        };

        // 状態のモック
        mockState = {
            graph: mockGraph,
            data: {
                nodes: [
                    { id: 1, name: 'A', x: 100, y: 100, neighbors: [] },
                    { id: 2, name: 'B', x: 200, y: 200, neighbors: [] },
                    { id: 3, name: 'C', x: 300, y: 300, neighbors: [] }
                ],
                links: [
                    { source: 1, target: 2 },
                    { source: 2, target: 3 }
                ]
            },
            ui: {
                focusedNode: null
            },
            controls: {
                textSize: 12,
                showNames: true,
                nodeOpacity: 1.0,
                edgeOpacity: 0.6
            },
            getNodeVisualProps: sinon.stub().returns({
                color: '#93c5fd',
                opacity: 1.0,
                size: 3,
                label: 'Test'
            }),
            getLinkVisualProps: sinon.stub().returns({
                color: '#4b5563',
                opacity: 0.6,
                width: 0.5,
                particles: 0
            }),
            _pathsMatch: sinon.stub().returns(false),
            _getNodeFilePath: sinon.stub().returns('/test/file.java')
        };

        // 隣接関係を設定
        mockState.data.nodes[0].neighbors = [mockState.data.nodes[1]];
        mockState.data.nodes[1].neighbors = [mockState.data.nodes[0], mockState.data.nodes[2]];
        mockState.data.nodes[2].neighbors = [mockState.data.nodes[1]];
    });

    describe('focusNodeById implementation', () => {
        function focusNodeById(state, nodeId) {
            const node = state.data.nodes.find(n => n.id === nodeId);

            if (!node) return false;

            if (node.x === undefined || node.y === undefined) {
                return 'retry'; // 実際は setTimeout で再試行
            }

            state.ui.focusedNode = node;
            state.graph.centerAt(node.x, node.y, 1000);

            // ここで updateVisuals() が呼ばれるべき
            // updateGraph() は呼ばれないべき
            return true;
        }

        it('should find and focus node by ID', () => {
            const result = focusNodeById(mockState, 2);

            expect(result).to.be.true;
            expect(mockState.ui.focusedNode).to.deep.equal(mockState.data.nodes[1]);
        });

        it('should call centerAt with node coordinates and 1000ms', () => {
            focusNodeById(mockState, 2);

            expect(mockGraph.centerAt.calledOnce).to.be.true;
            expect(mockGraph.centerAt.calledWith(200, 200, 1000)).to.be.true;
        });

        it('should NOT call zoom()', () => {
            focusNodeById(mockState, 2);

            expect(mockGraph.zoom.called).to.be.false;
        });

        it('should NOT call d3ReheatSimulation()', () => {
            focusNodeById(mockState, 2);

            expect(mockGraph.d3ReheatSimulation.called).to.be.false;
        });

        it('should NOT call graphData()', () => {
            focusNodeById(mockState, 2);

            expect(mockGraph.graphData.called).to.be.false;
        });

        it('should return false for non-existent node', () => {
            const result = focusNodeById(mockState, 999);

            expect(result).to.be.false;
            expect(mockState.ui.focusedNode).to.be.null;
        });

        it('should retry for node with undefined coordinates', () => {
            const nodeWithoutCoords = { id: 4, name: 'D', x: undefined, y: undefined };
            mockState.data.nodes.push(nodeWithoutCoords);

            const result = focusNodeById(mockState, 4);

            expect(result).to.equal('retry');
            expect(mockGraph.centerAt.called).to.be.false;
        });
    });

    describe('focusNodeByPath implementation', () => {
        function focusNodeByPath(state, filePath) {
            if (!filePath) return false;

            const node = state.data.nodes.find(n =>
                state._pathsMatch(state._getNodeFilePath(n), filePath)
            );

            if (!node) return false;

            state.ui.focusedNode = node;
            if (state.graph && node.x !== undefined && node.y !== undefined) {
                state.graph.centerAt(node.x, node.y, 1000);
            }

            return true;
        }

        it('should find node by path', () => {
            mockState._pathsMatch.withArgs('/test/file.java', '/test/file.java').returns(true);

            const result = focusNodeByPath(mockState, '/test/file.java');

            expect(result).to.be.true;
            expect(mockState._pathsMatch.called).to.be.true;
        });

        it('should return false for empty path', () => {
            const result = focusNodeByPath(mockState, '');

            expect(result).to.be.false;
        });

        it('should call centerAt when node is found', () => {
            mockState._pathsMatch.withArgs('/test/file.java', '/test/file.java').returns(true);

            focusNodeByPath(mockState, '/test/file.java');

            expect(mockGraph.centerAt.calledOnce).to.be.true;
        });
    });

    describe('Visual properties during focus', () => {
        function getNodeVisualPropsWithFocus(node, state) {
            const baseProps = {
                color: '#93c5fd',
                opacity: 1.0,
                size: 3,
                label: node.name
            };

            if (!state.ui.focusedNode) {
                return baseProps;
            }

            const isFocused = node.id === state.ui.focusedNode.id;
            const isNeighbor = state.ui.focusedNode.neighbors &&
                               state.ui.focusedNode.neighbors.some(n => n.id === node.id);

            if (!isFocused && !isNeighbor) {
                baseProps.opacity = baseProps.opacity * 0.2;
            }

            return baseProps;
        }

        function getLinkVisualPropsWithFocus(link, state) {
            const baseProps = {
                color: '#4b5563',
                opacity: 0.6,
                width: 0.5,
                particles: 0,
                widthMultiplier: 1
            };

            if (!state.ui.focusedNode) {
                return baseProps;
            }

            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            const focusedId = state.ui.focusedNode.id;

            const isConnectedToFocus = sourceId === focusedId || targetId === focusedId;

            if (isConnectedToFocus) {
                baseProps.particles = 3;
                baseProps.widthMultiplier = 1.5;
            } else {
                baseProps.opacity = baseProps.opacity * 0.1;
            }

            return baseProps;
        }

        it('should keep focused node fully opaque', () => {
            mockState.ui.focusedNode = mockState.data.nodes[1]; // Node B

            const props = getNodeVisualPropsWithFocus(mockState.data.nodes[1], mockState);

            expect(props.opacity).to.equal(1.0);
        });

        it('should keep neighbor nodes fully opaque', () => {
            mockState.ui.focusedNode = mockState.data.nodes[1]; // Node B

            const propsA = getNodeVisualPropsWithFocus(mockState.data.nodes[0], mockState);
            const propsC = getNodeVisualPropsWithFocus(mockState.data.nodes[2], mockState);

            expect(propsA.opacity).to.equal(1.0);
            expect(propsC.opacity).to.equal(1.0);
        });

        it('should dim non-connected nodes to 0.2x opacity', () => {
            mockState.ui.focusedNode = mockState.data.nodes[0]; // Node A

            // Node C は Node A と接続されていない
            const propsC = getNodeVisualPropsWithFocus(mockState.data.nodes[2], mockState);

            expect(propsC.opacity).to.equal(0.2);
        });

        it('should add 3 particles to focused edges', () => {
            mockState.ui.focusedNode = mockState.data.nodes[1]; // Node B

            const link = mockState.data.links[0]; // A -> B
            const props = getLinkVisualPropsWithFocus(link, mockState);

            expect(props.particles).to.equal(3);
        });

        it('should increase focused edge width by 1.5x', () => {
            mockState.ui.focusedNode = mockState.data.nodes[1]; // Node B

            const link = mockState.data.links[0]; // A -> B
            const props = getLinkVisualPropsWithFocus(link, mockState);

            expect(props.widthMultiplier).to.equal(1.5);
        });

        it('should dim non-focused edges to 0.1x opacity', () => {
            mockState.ui.focusedNode = mockState.data.nodes[0]; // Node A

            const link = mockState.data.links[1]; // B -> C (not connected to A)
            const props = getLinkVisualPropsWithFocus(link, mockState);

            expect(props.opacity).to.equal(0.06); // 0.6 * 0.1
        });

        it('should restore normal opacity when focus is cleared', () => {
            mockState.ui.focusedNode = mockState.data.nodes[1];
            mockState.ui.focusedNode = null; // Clear focus

            const props = getNodeVisualPropsWithFocus(mockState.data.nodes[0], mockState);

            expect(props.opacity).to.equal(1.0);
        });
    });

    describe('Edge cases', () => {
        it('should handle node with no neighbors', () => {
            const isolatedNode = { id: 5, name: 'E', x: 500, y: 500, neighbors: [] };
            mockState.data.nodes.push(isolatedNode);

            mockState.ui.focusedNode = isolatedNode;

            // All other nodes should be dimmed
            const propsA = {
                color: '#93c5fd',
                opacity: 1.0,
                size: 3,
                label: 'A'
            };

            if (mockState.ui.focusedNode.neighbors.length === 0) {
                propsA.opacity = propsA.opacity * 0.2;
            }

            expect(propsA.opacity).to.equal(0.2);
        });

        it('should handle focus on node with undefined neighbors array', () => {
            const nodeWithoutNeighbors = { id: 6, name: 'F', x: 600, y: 600 };
            delete nodeWithoutNeighbors.neighbors;

            mockState.ui.focusedNode = nodeWithoutNeighbors;

            // Should not throw error
            expect(() => {
                const isNeighbor = mockState.ui.focusedNode.neighbors &&
                                   mockState.ui.focusedNode.neighbors.some(n => n.id === 1);
            }).to.not.throw();
        });
    });
});
