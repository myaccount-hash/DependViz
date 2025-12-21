"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JavaScriptAnalyzer = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const parser = __importStar(require("@babel/parser"));
// @ts-ignore - @babel/traverse doesn't have type definitions
const traverse_1 = __importDefault(require("@babel/traverse"));
const utils_1 = require("../utils/utils");
const BaseAnalyzer_1 = require("./BaseAnalyzer");
class JavaScriptAnalyzer extends BaseAnalyzer_1.BaseAnalyzer {
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
        const workspaceFolder = this.getWorkspaceFolder();
        const files = await vscode.workspace.findFiles('**/*.{js,jsx,ts,tsx,mjs,cjs}', '{**/node_modules/**,**/dist/**,**/.git/**}');
        if (files.length === 0) {
            return { nodes: [], links: [] };
        }
        const graph = { nodes: [], links: [] };
        const nodeMap = new Map();
        for (const file of files) {
            const filePath = file.fsPath;
            await this.processFile(filePath, workspaceFolder, nodeMap, graph.links);
        }
        graph.nodes = [...nodeMap.values()];
        (0, utils_1.validateGraphData)(graph);
        return graph;
    }
    async analyzeFile(filePath) {
        const workspaceFolder = this.getWorkspaceFolder();
        const graph = { nodes: [], links: [] };
        const nodeMap = new Map();
        await this.processFile(filePath, workspaceFolder, nodeMap, graph.links);
        graph.nodes = [...nodeMap.values()];
        (0, utils_1.validateGraphData)(graph);
        return graph;
    }
    async processFile(filePath, workspaceFolder, nodeMap, links) {
        if (!this.isSupportedFile(filePath))
            return;
        const content = await this.readFile(filePath);
        if (content === null)
            return;
        const nodeId = this.getNodeId(filePath, workspaceFolder);
        if (!nodeMap.has(nodeId)) {
            nodeMap.set(nodeId, this.createNode(filePath, content, workspaceFolder));
        }
        const deps = this.extractDependencies(content, filePath);
        for (const dep of deps) {
            const resolved = this.resolveDependency(dep.value, filePath, workspaceFolder);
            if (!resolved)
                continue;
            const targetId = this.getNodeId(resolved, workspaceFolder);
            if (!nodeMap.has(targetId)) {
                const depContent = await this.readFile(resolved);
                if (depContent === null)
                    continue;
                nodeMap.set(targetId, this.createNode(resolved, depContent, workspaceFolder));
            }
            if (!this.hasLink(links, nodeId, targetId, dep.kind)) {
                links.push({ source: nodeId, target: targetId, type: dep.kind });
            }
        }
    }
    createNode(filePath, content, workspaceFolder) {
        const relativePath = this.toRelative(filePath, workspaceFolder);
        return {
            id: relativePath,
            name: relativePath,
            type: 'File',
            filePath,
            linesOfCode: this.countLines(content)
        };
    }
    extractDependencies(content, filePath) {
        try {
            const ast = parser.parse(content, this.parserOptions);
            const deps = [];
            const record = (value, kind) => {
                if (typeof value === 'string' && value.length > 0) {
                    deps.push({ value, kind });
                }
            };
            (0, traverse_1.default)(ast, {
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
                    if (parent && 'arguments' in parent && Array.isArray(parent.arguments) && parent.arguments.length > 0) {
                        const arg = parent.arguments[0];
                        if (arg.type === 'StringLiteral') {
                            record(arg.value, 'DynamicImport');
                        }
                    }
                }
            });
            return deps;
        }
        catch (error) {
            const err = error;
            console.warn(`[DependViz][JS Analyzer] Failed to parse ${filePath}: ${err.message}`);
            return [];
        }
    }
    resolveDependency(specifier, fromPath, workspaceFolder) {
        if (!specifier || (!specifier.startsWith('.') && !specifier.startsWith('/'))) {
            return null;
        }
        const basePath = specifier.startsWith('.')
            ? path.resolve(path.dirname(fromPath), specifier)
            : path.resolve(workspaceFolder.uri.fsPath, specifier.slice(1));
        return this.resolveWithExtensions(basePath);
    }
    resolveWithExtensions(basePath) {
        const candidates = [basePath, ...this.supportedExtensions.map(ext => `${basePath}${ext}`)];
        for (const candidate of candidates) {
            const resolved = this.tryFile(candidate);
            if (resolved)
                return resolved;
        }
        for (const ext of this.supportedExtensions) {
            const candidate = path.join(basePath, `index${ext}`);
            const resolved = this.tryFile(candidate);
            if (resolved)
                return resolved;
        }
        return null;
    }
    tryFile(filePath) {
        try {
            const stat = fs.statSync(filePath);
            return stat.isFile() ? filePath : null;
        }
        catch (e) {
            return null;
        }
    }
    async readFile(filePath) {
        try {
            return await fs.promises.readFile(filePath, 'utf8');
        }
        catch (error) {
            const err = error;
            console.warn(`[DependViz][JS Analyzer] Failed to read ${filePath}: ${err.message}`);
            return null;
        }
    }
    countLines(content) {
        if (!content)
            return 0;
        return content.split(/\r?\n/).length;
    }
    hasLink(links, source, target, type) {
        return links.some(link => link.source === source && link.target === target && link.type === type);
    }
    isFileSupported(filePath) {
        return this.isSupportedFile(filePath);
    }
    isSupportedFile(filePath) {
        return this.supportedExtensions.includes(path.extname(filePath));
    }
    getNodeId(filePath, workspaceFolder) {
        return this.toRelative(filePath, workspaceFolder);
    }
    toRelative(filePath, workspaceFolder) {
        const relative = path.relative(workspaceFolder.uri.fsPath, filePath) || path.basename(filePath);
        return relative.replace(/\\/g, '/');
    }
    getWorkspaceFolder() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder)
            throw new Error('ワークスペースが開かれていません');
        return workspaceFolder;
    }
}
exports.JavaScriptAnalyzer = JavaScriptAnalyzer;
exports.default = JavaScriptAnalyzer;
//# sourceMappingURL=JavaScriptAnalyzer.js.map