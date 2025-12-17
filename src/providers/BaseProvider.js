const vscode = require('vscode');

/**
 * Providerの設定更新を統一する基底クラス
 */
class BaseProvider {
    constructor() {
        this._controls = null;
    }

    handleSettingsChanged(controls) {
        this._controls = controls ? { ...controls } : null;
    }

    get controls() {
        return this._controls || {};
    }
}

class CheckboxControlItem extends vscode.TreeItem {
    constructor(label, checked, key) {
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

class SliderControlItem extends vscode.TreeItem {
    constructor(label, value, min, max, step, key) {
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

class SectionItem extends vscode.TreeItem {
    constructor(label, children) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this.contextValue = 'section';
        this.children = children;
    }
}

class SearchControlItem extends vscode.TreeItem {
    constructor(label, value) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'searchControl';
        this.description = value || '検索...';
        this.command = {
            command: 'forceGraphViewer.showSearchInput',
            title: '検索'
        };
    }
}

module.exports = {
    BaseProvider,
    CheckboxControlItem,
    SliderControlItem,
    SectionItem,
    SearchControlItem
};
