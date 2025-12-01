const BaseProvider = require('./BaseProvider');
const { SectionItem } = require('../utils/TreeItems');
const { SLIDER_RANGES } = require('../constants');

const DETAIL_SECTIONS = [
   ['サイズ・透明度', [
      ['slider', 'ノードサイズ', 'nodeSize', SLIDER_RANGES.nodeSize],
      ['slider', 'リンク幅', 'linkWidth', SLIDER_RANGES.linkWidth],
      ['slider', 'ノード透明度', 'nodeOpacity', SLIDER_RANGES.opacity],
      ['slider', 'エッジ透明度', 'edgeOpacity', SLIDER_RANGES.opacity],
      ['slider', '矢印サイズ', 'arrowSize', SLIDER_RANGES.arrowSize],
      ['slider', '名前フォントサイズ', 'nameFontSize', { min: 6, max: 32, step: 1 }]
   ]],
   ['レイアウト', [
      ['slider', 'リンク距離', 'linkDistance', SLIDER_RANGES.linkDistance],
      ['slider', 'フォーカス距離', 'focusDistance', { min: 20, max: 300, step: 10 }]
   ]],
   ['アニメーション', [
      ['checkbox', '自動回転', 'autoRotate'],
      ['slider', '回転速度', 'rotateSpeed', SLIDER_RANGES.rotateSpeed]
   ]],
   ['ノード色', [
      ['color', 'Class', 'colorClass'],
      ['color', 'AbstractClass', 'colorAbstractClass'],
      ['color', 'Interface', 'colorInterface'],
      ['color', 'Unknown', 'colorUnknown']
   ]],
   ['エッジ色', [
      ['color', 'ObjectCreate', 'colorObjectCreate'],
      ['color', 'Extends', 'colorExtends'],
      ['color', 'Implements', 'colorImplements'],
      ['color', 'TypeUse', 'colorTypeUse'],
      ['color', 'MethodCall', 'colorMethodCall']
   ]]
];

class DetailSettingsProvider extends BaseProvider {
   getRootItems() {
      return DETAIL_SECTIONS.map(([label, ctrls]) =>
         new SectionItem(label, ctrls.map(c => this.createControlItem(c)), 'controlSection')
      );
   }
}

module.exports = DetailSettingsProvider;

