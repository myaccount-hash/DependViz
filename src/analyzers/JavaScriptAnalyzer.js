const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { validateGraphData } = require('../utils/graph');
const BaseAnalyzer = require('./BaseAnalyzer');

class JavaScriptAnalyzer extends BaseAnalyzer {
    static get analyzerId() {
        return 'javascript';
    }

    static get displayName() {
        return 'Babel(JavaScript)(未実装)';
    }

    static getTypeDefinitions() {
        return {
            node: [
                { type: 'File', defaultEnabled: true, defaultColor: '#fcd34d' }
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
        this._supportedExtensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
        this._outputChannel = null;
        this._parserOptions = {
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
        if (!this._supportedExtensions.includes(path.extname(filePath))) return;
        const content = await this._readFile(filePath);
        if (content === null) return;
        const nodeId = this._toRelative(filePath, workspaceFolder);
        if (!nodeMap.has(nodeId)) {
            nodeMap.set(nodeId, this._createNode(filePath, content, workspaceFolder));
        }
        const deps = this._extractDependencies(content, filePath);
        for (const dep of deps) {
            const resolved = this._resolveDependency(dep.value, filePath, workspaceFolder);
            if (!resolved) continue;
            const targetId = this._toRelative(resolved, workspaceFolder);
            if (!nodeMap.has(targetId)) {
                const depContent = await this._readFile(resolved);
                if (depContent === null) continue;
                nodeMap.set(targetId, this._createNode(resolved, depContent, workspaceFolder));
            }
            const exists = links.some(link => link.source === nodeId && link.target === targetId && link.type === dep.kind);
            if (!exists) {
                links.push({ source: nodeId, target: targetId, type: dep.kind });
            }
        }
    }

    _createNode(filePath, content, workspaceFolder) {
        const relativePath = this._toRelative(filePath, workspaceFolder);
        return {
            id: relativePath,
            name: relativePath,
            type: 'File',
            filePath,
            linesOfCode: content ? content.split(/\r?\n/).length : 0
        };
    }

    _extractDependencies(content, filePath) {
        try {
            const ast = parser.parse(content, this._parserOptions);
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
            const message = `[DependViz][JS Analyzer] Failed to parse ${filePath}: ${error.message}`;
            console.warn(message);
            this._getOutputChannel().appendLine(message);
            if (error.stack) {
                this._getOutputChannel().appendLine(error.stack);
            }
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
        const candidates = [basePath, ...this._supportedExtensions.map(ext => `${basePath}${ext}`)];
        for (const candidate of candidates) {
            try {
                const stat = fs.statSync(candidate);
                if (stat.isFile()) {
                    return candidate;
                }
            } catch (error) {
                // ignore
            }
        }
        for (const ext of this._supportedExtensions) {
            const candidate = path.join(basePath, `index${ext}`);
            try {
                const stat = fs.statSync(candidate);
                if (stat.isFile()) {
                    return candidate;
                }
            } catch (error) {
                // ignore
            }
        }
        return null;
    }

    async _readFile(filePath) {
        try {
            return await fs.promises.readFile(filePath, 'utf8');
        } catch (error) {
            const message = `[DependViz][JS Analyzer] Failed to read ${filePath}: ${error.message}`;
            console.warn(message);
            this._getOutputChannel().appendLine(message);
            if (error.stack) {
                this._getOutputChannel().appendLine(error.stack);
            }
            return null;
        }
    }

    isFileSupported(filePath) {
        return this._supportedExtensions.includes(path.extname(filePath));
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

    _getOutputChannel() {
        if (!this._outputChannel) {
            this._outputChannel = vscode.window.createOutputChannel('DependViz JavaScript Analyzer');
        }
        return this._outputChannel;
    }
}

module.exports = JavaScriptAnalyzer;
