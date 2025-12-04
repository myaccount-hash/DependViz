const vscode = require('vscode');

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

class ColorControlItem extends vscode.TreeItem {
    constructor(label, value, key) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'colorControl';
        this.key = key;
        this.value = value;
        this.description = value;
        this.command = {
            command: 'forceGraphViewer.showColorPicker',
            title: 'Pick Color',
            arguments: [key, value]
        };
    }
}

class SectionItem extends vscode.TreeItem {
    constructor(label, children = [], contextValue = 'section') {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this.contextValue = contextValue;
        this.children = children;
    }
}

class ButtonControlItem extends vscode.TreeItem {
    constructor(label, commandName, commandArgs = []) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'buttonControl';
        this.command = {
            command: commandName,
            title: label,
            arguments: commandArgs
        };
    }
}

module.exports = { CheckboxControlItem, SliderControlItem, ColorControlItem, SectionItem, ButtonControlItem };

