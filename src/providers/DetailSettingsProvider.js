const BaseProvider = require('./BaseProvider');
const { CheckboxControlItem, SliderControlItem, ColorControlItem, SectionItem } = require('../utils/TreeItems');
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
   constructor() {
      super();
   }

   getChildren(element) {
      if (!element) return this.getRootItems();
      if (element.contextValue === 'section' || element.contextValue === 'controlSection') {
         return element.children;
      }
      return [];
   }

   getRootItems() {
      return DETAIL_SECTIONS.map(([label, ctrls]) =>
         new SectionItem(label, ctrls.map(c => this.createControlItem(c)), 'controlSection')
      );
   }

   createControlItem(c) {
      const [type, label, key, ...params] = c;
      const controls = this.controls;

      if (type === 'checkbox') return new CheckboxControlItem(label, controls[key], key);
      if (type === 'slider') {
         const range = params[0];
         return new SliderControlItem(label, controls[key], range.min, range.max, range.step, key);
      }
      if (type === 'color') return new ColorControlItem(label, controls[key], key);

      throw new Error(`Unknown control type: ${type}`);
   }
}

module.exports = DetailSettingsProvider;

