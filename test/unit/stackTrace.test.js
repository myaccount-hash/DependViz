const { expect } = require('chai');

// スタックトレース関連のテスト用ヘルパー関数
// VSCode APIをモックしないシンプルなロジックテスト

describe('Stack Trace Logic', () => {
    describe('Path filtering', () => {
        it('should filter out null paths', () => {
            const frames = [
                { source: { path: '/path/to/file1.java' } },
                { source: { path: null } },
                { source: { path: '/path/to/file2.java' } },
                { source: null },
                { source: { path: '/path/to/file3.java' } }
            ];

            const paths = frames
                .map(f => f.source?.path)
                .filter(p => p);

            expect(paths).to.have.lengthOf(3);
            expect(paths).to.deep.equal([
                '/path/to/file1.java',
                '/path/to/file2.java',
                '/path/to/file3.java'
            ]);
        });

        it('should handle empty frame array', () => {
            const frames = [];
            const paths = frames
                .map(f => f.source?.path)
                .filter(p => p);

            expect(paths).to.have.lengthOf(0);
        });

        it('should handle all null frames', () => {
            const frames = [
                { source: null },
                { source: { path: null } },
                {}
            ];

            const paths = frames
                .map(f => f.source?.path)
                .filter(p => p);

            expect(paths).to.have.lengthOf(0);
        });
    });

    describe('Path matching logic', () => {
        const mockNodes = [
            { id: 'com.test.ClassA', filePath: '/Users/test/project/src/main/java/com/test/ClassA.java' },
            { id: 'com.test.ClassB', filePath: '/Users/test/project/src/main/java/com/test/ClassB.java' },
            { id: 'com.example.Util', filePath: '/Users/test/project/src/main/java/com/example/Util.java' }
        ];

        function findNodeByPath(nodes, targetPath) {
            return nodes.find(n => {
                const nodePath = n.filePath;
                if (!nodePath) return false;
                const nodeBasename = nodePath.split('/').pop();
                const targetBasename = targetPath.split('/').pop();
                return nodePath === targetPath ||
                    nodeBasename === targetBasename ||
                    targetPath.endsWith(nodePath) ||
                    nodePath.endsWith(targetPath);
            });
        }

        it('should match exact path', () => {
            const path = '/Users/test/project/src/main/java/com/test/ClassA.java';
            const matched = findNodeByPath(mockNodes, path);

            expect(matched).to.not.be.undefined;
            expect(matched.id).to.equal('com.test.ClassA');
        });

        it('should match by basename', () => {
            const path = '/different/path/ClassA.java';
            const matched = findNodeByPath(mockNodes, path);

            expect(matched).to.not.be.undefined;
            expect(matched.id).to.equal('com.test.ClassA');
        });

        it('should not match non-existent file', () => {
            const path = '/path/to/NonExistent.java';
            const matched = findNodeByPath(mockNodes, path);

            expect(matched).to.be.undefined;
        });

        it('should handle null filePath in nodes', () => {
            const nodesWithNull = [
                { id: 'com.test.ClassA', filePath: null },
                { id: 'com.test.ClassB', filePath: '/path/ClassB.java' }
            ];

            const path = '/path/ClassB.java';
            const matched = findNodeByPath(nodesWithNull, path);

            expect(matched).to.not.be.undefined;
            expect(matched.id).to.equal('com.test.ClassB');
        });
    });

    describe('Stack trace link creation', () => {
        function createStackTraceLinks(nodes) {
            const links = [];
            for (let i = 0; i < nodes.length - 1; i++) {
                links.push({
                    source: nodes[i + 1].id,
                    target: nodes[i].id,
                    type: 'StackTrace',
                    isStackTraceLink: true
                });
            }
            return links;
        }

        it('should create links from stack nodes', () => {
            const nodes = [
                { id: 'com.test.Main' },
                { id: 'com.test.ServiceA' },
                { id: 'com.test.ServiceB' },
                { id: 'com.test.Util' }
            ];

            const links = createStackTraceLinks(nodes);

            expect(links).to.have.lengthOf(3);
            expect(links[0]).to.deep.equal({
                source: 'com.test.ServiceA',
                target: 'com.test.Main',
                type: 'StackTrace',
                isStackTraceLink: true
            });
            expect(links[1]).to.deep.equal({
                source: 'com.test.ServiceB',
                target: 'com.test.ServiceA',
                type: 'StackTrace',
                isStackTraceLink: true
            });
            expect(links[2]).to.deep.equal({
                source: 'com.test.Util',
                target: 'com.test.ServiceB',
                type: 'StackTrace',
                isStackTraceLink: true
            });
        });

        it('should create no links for single node', () => {
            const nodes = [{ id: 'com.test.Main' }];
            const links = createStackTraceLinks(nodes);

            expect(links).to.have.lengthOf(0);
        });

        it('should create no links for empty array', () => {
            const nodes = [];
            const links = createStackTraceLinks(nodes);

            expect(links).to.have.lengthOf(0);
        });

        it('should create one link for two nodes', () => {
            const nodes = [
                { id: 'com.test.Main' },
                { id: 'com.test.Service' }
            ];
            const links = createStackTraceLinks(nodes);

            expect(links).to.have.lengthOf(1);
            expect(links[0]).to.deep.equal({
                source: 'com.test.Service',
                target: 'com.test.Main',
                type: 'StackTrace',
                isStackTraceLink: true
            });
        });
    });

    describe('Unique paths', () => {
        it('should remove duplicate paths', () => {
            const paths = [
                '/path/to/ClassA.java',
                '/path/to/ClassB.java',
                '/path/to/ClassA.java',
                '/path/to/ClassC.java',
                '/path/to/ClassB.java'
            ];

            const uniquePaths = [...new Set(paths)];

            expect(uniquePaths).to.have.lengthOf(3);
            expect(uniquePaths).to.deep.equal([
                '/path/to/ClassA.java',
                '/path/to/ClassB.java',
                '/path/to/ClassC.java'
            ]);
        });

        it('should handle empty array', () => {
            const paths = [];
            const uniquePaths = [...new Set(paths)];

            expect(uniquePaths).to.have.lengthOf(0);
        });
    });
});
