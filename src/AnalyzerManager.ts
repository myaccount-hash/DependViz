import * as vscode from 'vscode';
import { BaseAnalyzer } from './analyzers/BaseAnalyzer';
import { JavaAnalyzer } from './analyzers/JavaAnalyzer';
import { JavaScriptAnalyzer } from './analyzers/JavaScriptAnalyzer';
import { ConfigurationManager } from './ConfigurationManager';
import { GraphData } from './utils/utils';

interface AnalyzerConstructor {
    new(context?: vscode.ExtensionContext): BaseAnalyzer;
    analyzerId: string;
    displayName: string;
    getTypeInfo(): import('./analyzers/BaseAnalyzer').TypeInfo[];
    getTypeDefaults(): import('./analyzers/BaseAnalyzer').TypeDefaults;
}

const REGISTERED_ANALYZERS: AnalyzerConstructor[] = [JavaAnalyzer as any, JavaScriptAnalyzer as any];

interface AnalyzerOption {
    id: string;
    label: string;
}

export class AnalyzerManager {
    private _configManager: ConfigurationManager;
    private _analyzers: Record<string, BaseAnalyzer>;

    constructor(context: vscode.ExtensionContext, configManager: ConfigurationManager) {
        this._configManager = configManager;
        this._analyzers = this._createAnalyzers(context, REGISTERED_ANALYZERS);
    }

    private _createAnalyzers(context: vscode.ExtensionContext, list: AnalyzerConstructor[]): Record<string, BaseAnalyzer> {
        const map: Record<string, BaseAnalyzer> = {};
        list.forEach((AnalyzerConstructor) => {
            const analyzer = new AnalyzerConstructor(context);
            map[AnalyzerConstructor.analyzerId] = analyzer;
        });
        return map;
    }

    static getAnalyzerClassById(analyzerId: string): AnalyzerConstructor {
        return REGISTERED_ANALYZERS.find(analyzer => analyzer.analyzerId === analyzerId) || REGISTERED_ANALYZERS[0];
    }

    static getAnalyzerOptions(): AnalyzerOption[] {
        return REGISTERED_ANALYZERS.map(analyzer => ({
            id: analyzer.analyzerId,
            label: analyzer.displayName
        }));
    }

    static getDefaultAnalyzerId(): string {
        const analyzer = REGISTERED_ANALYZERS[0];
        return analyzer ? analyzer.analyzerId : 'default';
    }

    getActiveAnalyzer(): BaseAnalyzer {
        const controls = this._configManager.loadControls();
        const analyzerId = controls.analyzerId || AnalyzerManager.getDefaultAnalyzerId();
        return this._analyzers[analyzerId] || this._analyzers[AnalyzerManager.getDefaultAnalyzerId()];
    }

    getActiveAnalyzerId(): string {
        const controls = this._configManager.loadControls();
        return controls.analyzerId || AnalyzerManager.getDefaultAnalyzerId();
    }

    getActiveAnalyzerName(): string {
        const analyzer = this.getActiveAnalyzer();
        return this.getAnalyzerName(analyzer);
    }

    getAnalyzerName(analyzer: BaseAnalyzer): string {
        return (analyzer?.constructor as any)?.displayName || (analyzer?.constructor as any)?.name || 'Analyzer';
    }

    isFileSupported(filePath: string): boolean {
        const analyzer = this.getActiveAnalyzer();
        if (!analyzer || typeof analyzer.isFileSupported !== 'function') {
            return true;
        }
        return analyzer.isFileSupported(filePath);
    }

    async analyzeProject(): Promise<GraphData | null> {
        const analyzer = this.getActiveAnalyzer();
        if (!analyzer || typeof analyzer.analyze !== 'function') {
            return null;
        }
        return analyzer.analyze();
    }

    async analyzeFile(filePath: string): Promise<GraphData | null> {
        const analyzer = this.getActiveAnalyzer();
        if (!analyzer || typeof analyzer.analyzeFile !== 'function') {
            return null;
        }
        return analyzer.analyzeFile(filePath);
    }

    async stopAll(): Promise<void> {
        const analyzers = Object.values(this._analyzers);
        for (const analyzer of analyzers) {
            if (typeof analyzer.stop === 'function') {
                await analyzer.stop();
            }
        }
    }
}
