const vscode = require('vscode');
const { BaseProvider, CheckboxControlItem } = require('./BaseProvider');
const { ConfigurationManager } = require('../utils/ConfigurationManager');

const FILTER_ITEMS = [
    ['checkbox', 'Node: Class', 'showClass'],
    ['checkbox', 'Node: AbstractClass', 'showAbstractClass'],
    ['checkbox', 'Node: Interface', 'showInterface'],
    ['checkbox', 'Node: Unknown', 'showUnknown'],
    ['checkbox', 'Link: ObjectCreate', 'showObjectCreate'],
    ['checkbox', 'Link: Extends', 'showExtends'],
    ['checkbox', 'Link: Implements', 'showImplements'],
    ['checkbox', 'Link: TypeUse', 'showTypeUse'],
    ['checkbox', 'Link: MethodCall', 'showMethodCall']
];

class FilterProvider extends BaseProvider {
    constructor() {
        super();
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    get controls() {
        if (this._controls && Object.keys(this._controls).length > 0) {
            return this._controls;
        }
        return ConfigurationManager.getInstance().loadControls({ ignoreCache: true });
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        return element;
    }

    getChildren(element) {
        if (!element) return this.getRootItems();
        return [];
    }

    getRootItems() {
        return FILTER_ITEMS.map(([type, label, key]) => this.createControlItem(type, label, key));
    }

    createControlItem(type, label, key) {
        const value = this.controls[key];
        if (type === 'checkbox') {
            return new CheckboxControlItem(label, value, key);
        }
        throw new Error(`Unknown control type: ${type}`);
    }

    handleSettingsChanged(controls) {
        super.handleSettingsChanged(controls);
        this.refresh();
    }
}

module.exports = FilterProvider;
