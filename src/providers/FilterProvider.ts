import * as vscode from 'vscode';
import { BaseProvider, CheckboxControlItem, SectionItem, Controls } from './BaseProvider';
import { ConfigurationManager } from '../ConfigurationManager';
import { AnalyzerManager } from '../AnalyzerManager';

interface AnalyzerOption {
    id: string;
    label: string;
}

/**
 * フィルタ設定UIを提供するTreeDataProvider実装
 */
export class FilterProvider extends BaseProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    get controls(): Controls {
        if (this._controls && Object.keys(this._controls).length > 0) {
            return this._controls;
        }
        return ConfigurationManager.getInstance().loadControls({ ignoreCache: true });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
        if (!element) return this.getRootItems();
        if ((element as any).children && Array.isArray((element as any).children)) {
            return (element as any).children;
        }
        return [];
    }

    getRootItems(): vscode.TreeItem[] {
        const items: vscode.TreeItem[] = [this._createAnalyzerSection()];
        items.push(...this._createFilterItems());
        return items;
    }

    private _createAnalyzerSection(): SectionItem {
        const analyzerId = this.controls.analyzerId || AnalyzerManager.getDefaultAnalyzerId();
        const children = AnalyzerManager.getAnalyzerOptions().map((option) => new AnalyzerChoiceItem(option, option.id === analyzerId));
        return new SectionItem('Analyzer', children);
    }

    private _createFilterItems(): vscode.TreeItem[] {
        const analyzerId = this.controls.analyzerId || AnalyzerManager.getDefaultAnalyzerId();
        const analyzerClass = AnalyzerManager.getAnalyzerClassById(analyzerId);
        const typeInfo = analyzerClass.getTypeInfo();
        const nodes = typeInfo.filter((info: import('../analyzers/BaseAnalyzer').TypeInfo) => info.category === 'node');
        const edges = typeInfo.filter((info: import('../analyzers/BaseAnalyzer').TypeInfo) => info.category === 'edge');
        const makeItem = (info: import('../analyzers/BaseAnalyzer').TypeInfo) => {
            const prefix = info.category === 'node' ? 'Node' : 'Link';
            return this.createControlItem('checkbox', `${prefix}: ${info.type}`, info.filterKey);
        };
        return [...nodes.map(makeItem), ...edges.map(makeItem)];
    }

    createControlItem(type: string, label: string, key: string): vscode.TreeItem {
        const value = this.controls[key];
        if (type === 'checkbox') {
            return new CheckboxControlItem(label, value, key);
        }
        throw new Error(`Unknown control type: ${type}`);
    }

    handleSettingsChanged(controls: Controls | null): void {
        super.handleSettingsChanged(controls);
        this.refresh();
    }
}

class AnalyzerChoiceItem extends vscode.TreeItem {
    constructor(option: AnalyzerOption, isActive: boolean) {
        super(option.label, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'analyzerChoice';
        this.iconPath = new vscode.ThemeIcon(isActive ? 'check' : 'circle-outline');
        this.command = {
            command: 'forceGraphViewer.selectAnalyzer',
            title: 'Select Analyzer',
            arguments: [option.id]
        };
    }
}
