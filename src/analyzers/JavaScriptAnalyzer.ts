import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as parser from '@babel/parser';
// @ts-ignore - @babel/traverse doesn't have type definitions
import traverse from '@babel/traverse';
import { validateGraphData, GraphData, GraphNode, GraphLink } from '../utils/utils';
import { BaseAnalyzer, TypeDefinitions } from './BaseAnalyzer';

interface Dependency {
    value: string;
    kind: 'Import' | 'Require' | 'DynamicImport';
}

export class JavaScriptAnalyzer extends BaseAnalyzer {
    private supportedExtensions: string[];
    private parserOptions: parser.ParserOptions;

    static get analyzerId(): string {
        return 'javascript';
    }

    static get displayName(): string {
        return 'Babel(JavaScript)(未実装)';
    }

    static getTypeDefinitions(): TypeDefinitions {
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

    async analyze(): Promise<GraphData> {
        const workspaceFolder = this.getWorkspaceFolder();
        const files = await vscode.workspace.findFiles('**/*.{js,jsx,ts,tsx,mjs,cjs}', '{**/node_modules/**,**/dist/**,**/.git/**}');
        if (files.length === 0) {
            return { nodes: [], links: [] };
        }
        const graph: GraphData = { nodes: [], links: [] };
        const nodeMap = new Map<string, GraphNode>();
        for (const file of files) {
            const filePath = file.fsPath;
            await this.processFile(filePath, workspaceFolder, nodeMap, graph.links);
        }
        graph.nodes = [...nodeMap.values()];
        validateGraphData(graph);
        return graph;
    }

    async analyzeFile(filePath: string): Promise<GraphData> {
        const workspaceFolder = this.getWorkspaceFolder();
        const graph: GraphData = { nodes: [], links: [] };
        const nodeMap = new Map<string, GraphNode>();
        await this.processFile(filePath, workspaceFolder, nodeMap, graph.links);
        graph.nodes = [...nodeMap.values()];
        validateGraphData(graph);
        return graph;
    }

    private async processFile(filePath: string, workspaceFolder: vscode.WorkspaceFolder, nodeMap: Map<string, GraphNode>, links: GraphLink[]): Promise<void> {
        if (!this.isSupportedFile(filePath)) return;
        const content = await this.readFile(filePath);
        if (content === null) return;
        const nodeId = this.getNodeId(filePath, workspaceFolder);
        if (!nodeMap.has(nodeId)) {
            nodeMap.set(nodeId, this.createNode(filePath, content, workspaceFolder));
        }
        const deps = this.extractDependencies(content, filePath);
        for (const dep of deps) {
            const resolved = this.resolveDependency(dep.value, filePath, workspaceFolder);
            if (!resolved) continue;
            const targetId = this.getNodeId(resolved, workspaceFolder);
            if (!nodeMap.has(targetId)) {
                const depContent = await this.readFile(resolved);
                if (depContent === null) continue;
                nodeMap.set(targetId, this.createNode(resolved, depContent, workspaceFolder));
            }
            if (!this.hasLink(links, nodeId, targetId, dep.kind)) {
                links.push({ source: nodeId, target: targetId, type: dep.kind });
            }
        }
    }

    private createNode(filePath: string, content: string, workspaceFolder: vscode.WorkspaceFolder): GraphNode {
        const relativePath = this.toRelative(filePath, workspaceFolder);
        return {
            id: relativePath,
            name: relativePath,
            type: 'File',
            filePath,
            linesOfCode: this.countLines(content)
        };
    }

    private extractDependencies(content: string, filePath: string): Dependency[] {
        try {
            const ast = parser.parse(content, this.parserOptions);
            const deps: Dependency[] = [];
            const record = (value: string, kind: Dependency['kind']) => {
                if (typeof value === 'string' && value.length > 0) {
                    deps.push({ value, kind });
                }
            };
            traverse(ast, {
                ImportDeclaration: (pathNode: any) => record(pathNode.node.source.value, 'Import'),
                ExportAllDeclaration: (pathNode: any) => {
                    if (pathNode.node.source) {
                        record(pathNode.node.source.value, 'Import');
                    }
                },
                ExportNamedDeclaration: (pathNode: any) => {
                    if (pathNode.node.source) {
                        record(pathNode.node.source.value, 'Import');
                    }
                },
                CallExpression: (pathNode: any) => {
                    const { callee, arguments: args } = pathNode.node;
                    if (callee?.type === 'Identifier' && callee.name === 'require' && args.length > 0) {
                        const arg = args[0];
                        if (arg.type === 'StringLiteral') {
                            record(arg.value, 'Require');
                        }
                    }
                },
                Import: (pathNode: any) => {
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
        } catch (error) {
            const err = error as Error;
            console.warn(`[DependViz][JS Analyzer] Failed to parse ${filePath}: ${err.message}`);
            return [];
        }
    }

    private resolveDependency(specifier: string, fromPath: string, workspaceFolder: vscode.WorkspaceFolder): string | null {
        if (!specifier || (!specifier.startsWith('.') && !specifier.startsWith('/'))) {
            return null;
        }
        const basePath = specifier.startsWith('.')
            ? path.resolve(path.dirname(fromPath), specifier)
            : path.resolve(workspaceFolder.uri.fsPath, specifier.slice(1));
        return this.resolveWithExtensions(basePath);
    }

    private resolveWithExtensions(basePath: string): string | null {
        const candidates = [basePath, ...this.supportedExtensions.map(ext => `${basePath}${ext}`)];
        for (const candidate of candidates) {
            const resolved = this.tryFile(candidate);
            if (resolved) return resolved;
        }
        for (const ext of this.supportedExtensions) {
            const candidate = path.join(basePath, `index${ext}`);
            const resolved = this.tryFile(candidate);
            if (resolved) return resolved;
        }
        return null;
    }

    private tryFile(filePath: string): string | null {
        try {
            const stat = fs.statSync(filePath);
            return stat.isFile() ? filePath : null;
        } catch {
            return null;
        }
    }

    private async readFile(filePath: string): Promise<string | null> {
        try {
            return await fs.promises.readFile(filePath, 'utf8');
        } catch (error) {
            const err = error as Error;
            console.warn(`[DependViz][JS Analyzer] Failed to read ${filePath}: ${err.message}`);
            return null;
        }
    }

    private countLines(content: string): number {
        if (!content) return 0;
        return content.split(/\r?\n/).length;
    }

    private hasLink(links: GraphLink[], source: string, target: string, type: string): boolean {
        return links.some(link => link.source === source && link.target === target && link.type === type);
    }

    isFileSupported(filePath: string): boolean {
        return this.isSupportedFile(filePath);
    }

    private isSupportedFile(filePath: string): boolean {
        return this.supportedExtensions.includes(path.extname(filePath));
    }

    private getNodeId(filePath: string, workspaceFolder: vscode.WorkspaceFolder): string {
        return this.toRelative(filePath, workspaceFolder);
    }

    private toRelative(filePath: string, workspaceFolder: vscode.WorkspaceFolder): string {
        const relative = path.relative(workspaceFolder.uri.fsPath, filePath) || path.basename(filePath);
        return relative.replace(/\\/g, '/');
    }

    private getWorkspaceFolder(): vscode.WorkspaceFolder {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) throw new Error('ワークスペースが開かれていません');
        return workspaceFolder;
    }
}

export default JavaScriptAnalyzer;
