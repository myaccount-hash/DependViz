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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilterProvider = void 0;
const vscode = __importStar(require("vscode"));
const BaseProvider_1 = require("./BaseProvider");
const ConfigurationManager_1 = require("../ConfigurationManager");
const AnalyzerManager_1 = require("../AnalyzerManager");
/**
 * フィルタ設定UIを提供するTreeDataProvider実装
 */
class FilterProvider extends BaseProvider_1.BaseProvider {
    constructor() {
        super(...arguments);
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    get controls() {
        if (this._controls && Object.keys(this._controls).length > 0) {
            return this._controls;
        }
        return ConfigurationManager_1.ConfigurationManager.getInstance().loadControls({ ignoreCache: true });
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element)
            return this.getRootItems();
        if (element.children && Array.isArray(element.children)) {
            return element.children;
        }
        return [];
    }
    getRootItems() {
        const items = [this._createAnalyzerSection()];
        items.push(...this._createFilterItems());
        return items;
    }
    _createAnalyzerSection() {
        const analyzerId = this.controls.analyzerId || AnalyzerManager_1.AnalyzerManager.getDefaultAnalyzerId();
        const children = AnalyzerManager_1.AnalyzerManager.getAnalyzerOptions().map((option) => new AnalyzerChoiceItem(option, option.id === analyzerId));
        return new BaseProvider_1.SectionItem('Analyzer', children);
    }
    _createFilterItems() {
        const analyzerId = this.controls.analyzerId || AnalyzerManager_1.AnalyzerManager.getDefaultAnalyzerId();
        const analyzerClass = AnalyzerManager_1.AnalyzerManager.getAnalyzerClassById(analyzerId);
        const typeInfo = analyzerClass.getTypeInfo();
        const nodes = typeInfo.filter((info) => info.category === 'node');
        const edges = typeInfo.filter((info) => info.category === 'edge');
        const makeItem = (info) => {
            const prefix = info.category === 'node' ? 'Node' : 'Link';
            return this.createControlItem('checkbox', `${prefix}: ${info.type}`, info.filterKey);
        };
        return [...nodes.map(makeItem), ...edges.map(makeItem)];
    }
    createControlItem(type, label, key) {
        const value = this.controls[key];
        if (type === 'checkbox') {
            return new BaseProvider_1.CheckboxControlItem(label, value, key);
        }
        throw new Error(`Unknown control type: ${type}`);
    }
    handleSettingsChanged(controls) {
        super.handleSettingsChanged(controls);
        this.refresh();
    }
}
exports.FilterProvider = FilterProvider;
class AnalyzerChoiceItem extends vscode.TreeItem {
    constructor(option, isActive) {
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
//# sourceMappingURL=FilterProvider.js.map