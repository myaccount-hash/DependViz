const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { validateGraphData } = require('../utils/utils');
const BaseAnalyzer = require('./BaseAnalyzer');

class JavaScriptAnalyzer extends BaseAnalyzer {
    static get analyzerId() {
        return 'javascript';
    }

    static get displayName() {
        return 'JavaScript (Babel)';
    }

    static getTypeDefinitions() {
        return {
            node: [
                { type: 'JavaScriptFile', defaultEnabled: true, defaultColor: '#fcd34d' }
            ],
            edge: [
                { type: 'Import', defaultEnabled: true, defaultColor: '#38bdf8' },
                { type: 'Require', defaultEnabled: true, defaultColor: '#34d399' },
                { type: 'DynamicImport', defaultEnabled: true, defaultColor: '#fb7185' }
            ]
        };
    }

    constructor() {
        super();
        this.supportedExtensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
        this.parserOptions = {
            sourceType: 'unambiguous',
            plugins: [
                'jsx',
                'typescript',
                'classProperties',
                'classPrivateProperties',
                'classPrivateMethods',
                'decorators-legacy',
                'dynamicImport',
                'optionalChaining',
                'nullishCoalescingOperator',
                'objectRestSpread',
                'topLevelAwait'
            ]
        };
    }

    async analyze() {
        const workspaceFolder = this._getWorkspaceFolder();
        const files = await vscode.workspace.findFiles('**/*.{js,jsx,ts,tsx,mjs,cjs}', '{**/node_modules/**,**/dist/**,**/.git/**}');
        if (files.length === 0) {
            return { nodes: [], links: [] };
        }
        const graph = { nodes: [], links: [] };
        const nodeMap = new Map();
        for (const file of files) {
            const filePath = file.fsPath;
            await this._processFile(filePath, workspaceFolder, nodeMap, graph.links);
        }
        graph.nodes = [...nodeMap.values()];
        validateGraphData(graph);
        return graph;
    }

    async analyzeFile(filePath) {
        const workspaceFolder = this._getWorkspaceFolder();
        const graph = { nodes: [], links: [] };
        const nodeMap = new Map();
        await this._processFile(filePath, workspaceFolder, nodeMap, graph.links);
        graph.nodes = [...nodeMap.values()];
        validateGraphData(graph);
        return graph;
    }

    async _processFile(filePath, workspaceFolder, nodeMap, links) {
        if (!this._isSupportedFile(filePath)) return;
        const content = await this._readFile(filePath);
        if (content === null) return;
        const nodeId = this._getNodeId(filePath, workspaceFolder);
        if (!nodeMap.has(nodeId)) {
            nodeMap.set(nodeId, this._createNode(filePath, content, workspaceFolder));
        }
        const deps = this._extractDependencies(content, filePath);
        for (const dep of deps) {
            const resolved = this._resolveDependency(dep.value, filePath, workspaceFolder);
            if (!resolved) continue;
            const targetId = this._getNodeId(resolved, workspaceFolder);
            if (!nodeMap.has(targetId)) {
                const depContent = await this._readFile(resolved);
                if (depContent === null) continue;
                nodeMap.set(targetId, this._createNode(resolved, depContent, workspaceFolder));
            }
            if (!this._hasLink(links, nodeId, targetId, dep.kind)) {
                links.push({ source: nodeId, target: targetId, type: dep.kind });
            }
        }
    }

    _createNode(filePath, content, workspaceFolder) {
        const relativePath = this._toRelative(filePath, workspaceFolder);
        return {
            id: relativePath,
            name: relativePath,
            type: 'JavaScriptFile',
            filePath,
            linesOfCode: this._countLines(content)
        };
    }

    _extractDependencies(content, filePath) {
        try {
            const ast = parser.parse(content, this.parserOptions);
            const deps = [];
            const record = (value, kind) => {
                if (typeof value === 'string' && value.length > 0) {
                    deps.push({ value, kind });
                }
            };
            traverse(ast, {
                ImportDeclaration: (pathNode) => record(pathNode.node.source.value, 'Import'),
                ExportAllDeclaration: (pathNode) => {
                    if (pathNode.node.source) {
                        record(pathNode.node.source.value, 'Import');
                    }
                },
                ExportNamedDeclaration: (pathNode) => {
                    if (pathNode.node.source) {
                        record(pathNode.node.source.value, 'Import');
                    }
                },
                CallExpression: (pathNode) => {
                    const { callee, arguments: args } = pathNode.node;
                    if (callee?.type === 'Identifier' && callee.name === 'require' && args.length > 0) {
                        const arg = args[0];
                        if (arg.type === 'StringLiteral') {
                            record(arg.value, 'Require');
                        }
                    }
                },
                Import: (pathNode) => {
                    const parent = pathNode.parent;
                    if (parent?.arguments && parent.arguments.length > 0) {
                        const arg = parent.arguments[0];
                        if (arg.type === 'StringLiteral') {
                            record(arg.value, 'DynamicImport');
                        }
                    }
                }
            });
            return deps;
        } catch (error) {
            console.warn(`[DependViz][JS Analyzer] Failed to parse ${filePath}: ${error.message}`);
            return [];
        }
    }

    _resolveDependency(specifier, fromPath, workspaceFolder) {
        if (!specifier || (!specifier.startsWith('.') && !specifier.startsWith('/'))) {
            return null;
        }
        const basePath = specifier.startsWith('.')
            ? path.resolve(path.dirname(fromPath), specifier)
            : path.resolve(workspaceFolder.uri.fsPath, specifier.slice(1));
        return this._resolveWithExtensions(basePath);
    }

    _resolveWithExtensions(basePath) {
        const candidates = [basePath, ...this.supportedExtensions.map(ext => `${basePath}${ext}`)];
        for (const candidate of candidates) {
            const resolved = this._tryFile(candidate);
            if (resolved) return resolved;
        }
        for (const ext of this.supportedExtensions) {
            const candidate = path.join(basePath, `index${ext}`);
            const resolved = this._tryFile(candidate);
            if (resolved) return resolved;
        }
        return null;
    }

    _tryFile(filePath) {
        try {
            const stat = fs.statSync(filePath);
            return stat.isFile() ? filePath : null;
        } catch (e) {
            return null;
        }
    }

    async _readFile(filePath) {
        try {
            return await fs.promises.readFile(filePath, 'utf8');
        } catch (error) {
            console.warn(`[DependViz][JS Analyzer] Failed to read ${filePath}: ${error.message}`);
            return null;
        }
    }

    _countLines(content) {
        if (!content) return 0;
        return content.split(/\r?\n/).length;
    }

    _hasLink(links, source, target, type) {
        return links.some(link => link.source === source && link.target === target && link.type === type);
    }

    isFileSupported(filePath) {
        return this._isSupportedFile(filePath);
    }

    _isSupportedFile(filePath) {
        return this.supportedExtensions.includes(path.extname(filePath));
    }

    _getNodeId(filePath, workspaceFolder) {
        return this._toRelative(filePath, workspaceFolder);
    }

    _toRelative(filePath, workspaceFolder) {
        const relative = path.relative(workspaceFolder.uri.fsPath, filePath) || path.basename(filePath);
        return relative.replace(/\\/g, '/');
    }

    _getWorkspaceFolder() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) throw new Error('ワークスペースが開かれていません');
        return workspaceFolder;
    }
}

module.exports = JavaScriptAnalyzer;
