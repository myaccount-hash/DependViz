import * as vscode from 'vscode';

export interface Controls {
    [key: string]: any;
}

/**
 * Providerの設定更新を統一する基底クラス
 */
export class BaseProvider {
    protected _controls: Controls | null = null;

    handleSettingsChanged(controls: Controls | null): void {
        this._controls = controls ? { ...controls } : null;
    }

    get controls(): Controls {
        return this._controls || {};
    }
}

export class CheckboxControlItem extends vscode.TreeItem {
    key: string;
    checked: boolean;

    constructor(label: string, checked: boolean, key: string) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'checkboxControl';
        this.key = key;
        this.checked = checked;
        this.iconPath = new vscode.ThemeIcon(checked ? 'check' : 'circle-outline');
        this.command = {
            command: 'forceGraphViewer.toggleCheckbox',
            title: 'Toggle',
            arguments: [key]
        };
    }
}

export class SliderControlItem extends vscode.TreeItem {
    key: string;
    value: number;
    min: number;
    max: number;
    step: number;

    constructor(label: string, value: number, min: number, max: number, step: number, key: string) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'sliderControl';
        this.key = key;
        this.value = value;
        this.min = min;
        this.max = max;
        this.step = step;
        this.description = value.toString();
        this.command = {
            command: 'forceGraphViewer.showSliderInput',
            title: 'Adjust',
            arguments: [key, min, max, step, value]
        };
    }
}

export class SectionItem extends vscode.TreeItem {
    children: vscode.TreeItem[];

    constructor(label: string, children: vscode.TreeItem[]) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this.contextValue = 'section';
        this.children = children;
    }
}

export class SearchControlItem extends vscode.TreeItem {
    constructor(label: string, value: string) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'searchControl';
        this.description = value || '検索...';
        this.command = {
            command: 'forceGraphViewer.showSearchInput',
            title: '検索'
        };
    }
}
