const BaseProvider = require('./BaseProvider');
const { SectionItem } = require('../utils/TreeItems');
const { SLIDER_RANGES } = require('../constants');

const APPEARANCE_SECTIONS = [
    ['表示設定', [
        ['checkbox', 'スタックトレース', 'showStackTrace'],
        ['checkbox', '名前を表示', 'showNames'],
        ['checkbox', '短縮名を表示', 'shortNames'],
        ['checkbox', '孤立ノードを非表示', 'hideIsolatedNodes'],
        ['checkbox', 'ノードサイズをLOCで決定', 'nodeSizeByLoc']
    ]],
    ['スライス設定', [
        ['checkbox', '順方向スライス', 'enableForwardSlice'],
        ['checkbox', '逆方向スライス', 'enableBackwardSlice'],
        ['slider', 'スライス深度', 'sliceDepth', SLIDER_RANGES.sliceDepth]
    ]]
];

class AppearanceSettingsProvider extends BaseProvider {
    getRootItems() {
        return APPEARANCE_SECTIONS.map(([label, ctrls]) =>
            new SectionItem(label, ctrls.map(c => this.createControlItem(c)), 'controlSection')
        );
    }
}

module.exports = AppearanceSettingsProvider;

