const { expect } = require('chai');

// webview側のパスマッチングロジックのテスト

describe('Path Matching (webview logic)', () => {
    // webview script.js の _getNodeFilePath と同じロジック
    function getNodeFilePath(node) {
        return node.filePath || node.file;
    }

    // webview script.js の setStackTraceLinks 内のマッチングロジック
    function matchNode(nodes, targetPath) {
        if (!targetPath) return undefined;
        return nodes.find(n => {
            const nodePath = getNodeFilePath(n);
            if (!nodePath) return false;
            const nodeBasename = nodePath.split('/').pop();
            const frameBasename = targetPath.split('/').pop();
            return nodePath === targetPath ||
                nodeBasename === frameBasename ||
                targetPath.endsWith(nodePath) ||
                nodePath.endsWith(targetPath);
        });
    }

    describe('getNodeFilePath', () => {
        it('should return filePath if available', () => {
            const node = { filePath: '/path/to/file.java' };
            expect(getNodeFilePath(node)).to.equal('/path/to/file.java');
        });

        it('should fallback to file if filePath is undefined', () => {
            const node = { file: '/path/to/file.java' };
            expect(getNodeFilePath(node)).to.equal('/path/to/file.java');
        });

        it('should prefer filePath over file', () => {
            const node = {
                filePath: '/path/to/file1.java',
                file: '/path/to/file2.java'
            };
            expect(getNodeFilePath(node)).to.equal('/path/to/file1.java');
        });

        it('should return undefined if both are missing', () => {
            const node = { id: 'test' };
            expect(getNodeFilePath(node)).to.be.undefined;
        });
    });

    describe('Path matching strategies', () => {
        const nodes = [
            {
                id: 'com.test.ClassA',
                filePath: '/Users/project/src/main/java/com/test/ClassA.java'
            },
            {
                id: 'com.test.ClassB',
                filePath: '/Users/project/src/main/java/com/test/ClassB.java'
            },
            {
                id: 'com.example.Util',
                file: '/Users/project/src/main/java/com/example/Util.java'
            },
            {
                id: 'java.lang.String',
                filePath: null
            }
        ];

        describe('Exact match', () => {
            it('should match exact full path', () => {
                const path = '/Users/project/src/main/java/com/test/ClassA.java';
                const matched = matchNode(nodes, path);

                expect(matched).to.not.be.undefined;
                expect(matched.id).to.equal('com.test.ClassA');
            });
        });

        describe('Basename match', () => {
            it('should match by filename only', () => {
                const path = '/different/directory/ClassA.java';
                const matched = matchNode(nodes, path);

                expect(matched).to.not.be.undefined;
                expect(matched.id).to.equal('com.test.ClassA');
            });

            it('should match first occurrence when multiple files have same name', () => {
                const nodesWithDuplicates = [
                    { id: 'com.test.Foo', filePath: '/path1/Foo.java' },
                    { id: 'com.other.Foo', filePath: '/path2/Foo.java' }
                ];

                const matched = matchNode(nodesWithDuplicates, '/path3/Foo.java');

                expect(matched.id).to.equal('com.test.Foo');
            });
        });

        describe('EndsWith match', () => {
            it('should match if target path ends with node path', () => {
                const nodes = [
                    { id: 'Test', filePath: 'com/test/Test.java' }
                ];
                const path = '/Users/project/src/main/java/com/test/Test.java';
                const matched = matchNode(nodes, path);

                expect(matched).to.not.be.undefined;
                expect(matched.id).to.equal('Test');
            });

            it('should match if node path ends with target path', () => {
                const nodes = [
                    { id: 'Test', filePath: '/Users/project/src/main/java/com/test/Test.java' }
                ];
                const path = 'com/test/Test.java';
                const matched = matchNode(nodes, path);

                expect(matched).to.not.be.undefined;
                expect(matched.id).to.equal('Test');
            });
        });

        describe('No match cases', () => {
            it('should return undefined for non-existent file', () => {
                const path = '/path/to/NonExistent.java';
                const matched = matchNode(nodes, path);

                expect(matched).to.be.undefined;
            });

            it('should skip nodes without filePath', () => {
                const path = 'String.java';
                const matched = matchNode(nodes, path);

                expect(matched).to.be.undefined;
            });
        });

        describe('Edge cases', () => {
            it('should handle nodes with file field instead of filePath', () => {
                const path = '/Users/project/src/main/java/com/example/Util.java';
                const matched = matchNode(nodes, path);

                expect(matched).to.not.be.undefined;
                expect(matched.id).to.equal('com.example.Util');
            });

            it('should handle empty path', () => {
                const matched = matchNode(nodes, '');

                expect(matched).to.be.undefined;
            });

            it('should handle path with only filename', () => {
                const matched = matchNode(nodes, 'ClassB.java');

                expect(matched).to.not.be.undefined;
                expect(matched.id).to.equal('com.test.ClassB');
            });
        });
    });

    describe('Multiple path matching', () => {
        const nodes = [
            { id: 'com.test.A', filePath: '/project/A.java' },
            { id: 'com.test.B', filePath: '/project/B.java' },
            { id: 'com.test.C', filePath: '/project/C.java' }
        ];

        function matchMultiplePaths(nodes, paths) {
            const matched = [];
            const unmatched = [];

            paths.forEach(path => {
                const node = matchNode(nodes, path);
                if (node) {
                    matched.push({ path, node });
                } else {
                    unmatched.push(path);
                }
            });

            return { matched, unmatched };
        }

        it('should match all existing paths', () => {
            const paths = ['/project/A.java', '/project/B.java', '/project/C.java'];
            const result = matchMultiplePaths(nodes, paths);

            expect(result.matched).to.have.lengthOf(3);
            expect(result.unmatched).to.have.lengthOf(0);
        });

        it('should separate matched and unmatched paths', () => {
            const paths = [
                '/project/A.java',
                '/project/NonExistent.java',
                '/project/B.java'
            ];
            const result = matchMultiplePaths(nodes, paths);

            expect(result.matched).to.have.lengthOf(2);
            expect(result.unmatched).to.have.lengthOf(1);
            expect(result.unmatched[0]).to.equal('/project/NonExistent.java');
        });

        it('should handle empty paths array', () => {
            const result = matchMultiplePaths(nodes, []);

            expect(result.matched).to.have.lengthOf(0);
            expect(result.unmatched).to.have.lengthOf(0);
        });

        it('should handle all unmatched paths', () => {
            const paths = [
                '/project/X.java',
                '/project/Y.java',
                '/project/Z.java'
            ];
            const result = matchMultiplePaths(nodes, paths);

            expect(result.matched).to.have.lengthOf(0);
            expect(result.unmatched).to.have.lengthOf(3);
        });
    });
});
