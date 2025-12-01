const BaseProvider = require('./BaseProvider');
const { CheckboxControlItem, SliderControlItem } = require('../utils/TreeItems');
const { SLIDER_RANGES } = require('../constants');

const APPEARANCE_CONTROLS = [
    ['checkbox', 'スタックトレース', 'showStackTrace'],
    ['checkbox', '名前を表示', 'showNames'],
    ['checkbox', '短縮名を表示', 'shortNames'],
    ['checkbox', '孤立ノードを非表示', 'hideIsolatedNodes'],
    ['checkbox', 'ノードサイズをLOCで決定', 'nodeSizeByLoc'],
    ['checkbox', '順方向スライス', 'enableForwardSlice'],
    ['checkbox', '逆方向スライス', 'enableBackwardSlice'],
    ['slider', 'スライス深度', 'sliceDepth', SLIDER_RANGES.sliceDepth]
];

class AppearanceSettingsProvider extends BaseProvider {
    constructor() {
        super();
    }

    getChildren(element) {
        if (!element) return this.getRootItems();
        return [];
    }

    createControlItem(c) {
        const [type, label, key, ...params] = c;
        const controls = this.controls;

        if (type === 'checkbox') return new CheckboxControlItem(label, controls[key], key);
        if (type === 'slider') {
            const range = params[0];
            return new SliderControlItem(label, controls[key], range.min, range.max, range.step, key);
        }

        throw new Error(`Unknown control type: ${type}`);
    }

    getRootItems() {
        return APPEARANCE_CONTROLS.map(c => this.createControlItem(c));
    }
}

module.exports = AppearanceSettingsProvider;

