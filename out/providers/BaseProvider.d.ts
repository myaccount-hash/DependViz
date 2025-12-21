import * as vscode from 'vscode';
export interface Controls {
    [key: string]: any;
}
/**
 * Providerの設定更新を統一する基底クラス
 */
export declare class BaseProvider {
    protected _controls: Controls | null;
    handleSettingsChanged(controls: Controls | null): void;
    get controls(): Controls;
}
export declare class CheckboxControlItem extends vscode.TreeItem {
    key: string;
    checked: boolean;
    constructor(label: string, checked: boolean, key: string);
}
export declare class SliderControlItem extends vscode.TreeItem {
    key: string;
    value: number;
    min: number;
    max: number;
    step: number;
    constructor(label: string, value: number, min: number, max: number, step: number, key: string);
}
export declare class SectionItem extends vscode.TreeItem {
    children: vscode.TreeItem[];
    constructor(label: string, children: vscode.TreeItem[]);
}
export declare class SearchControlItem extends vscode.TreeItem {
    constructor(label: string, value: string);
}
//# sourceMappingURL=BaseProvider.d.ts.map