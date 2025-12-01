const vscode = require('vscode');
const { ConfigurationManager } = require('../utils/ConfigurationManager');
const { CheckboxControlItem, SliderControlItem, ColorControlItem } = require('../utils/TreeItems');

/**
 * TreeViewプロバイダーの基底クラス
 * - VS Code設定との連携
 * - イベント管理（onDidChangeTreeData）
 * - 共通コントロール生成ロジック
 * - サブクラスで getRootItems() を実装すること
 */
class BaseProvider {
   constructor() {
      this._onDidChangeTreeData = new vscode.EventEmitter();
      this.onDidChangeTreeData = this._onDidChangeTreeData.event;
   }

   // 設定管理機能
   get controls() {
      return ConfigurationManager.getInstance().loadControls();
   }

   async _updateControls(data) {
      if (data && typeof data === 'object' && 'key' in data && 'value' in data) {
         await ConfigurationManager.getInstance().updateControl(data.key, data.value);
      }
   }

   /**
    * 設定更新（統一されたエントリポイント）
    */
   async update(data) {
      if (data && data.key && 'value' in data) {
         await this._updateControls(data);
      }
      this._onDidChangeTreeData.fire();
   }

   /**
    * ツリービューを再描画
    */
   refresh() {
      this._onDidChangeTreeData.fire();
   }

   /**
    * VS Code TreeView プロトコル必須メソッド
    */
   getTreeItem(element) {
      return element;
   }

   /**
    * ツリーの子要素を返す（セクション構造をサポート）
    * @param {any} element - 親要素（nullの場合はルート要素）
    * @returns {any[]} 子要素の配列
    */
   getChildren(element) {
      if (!element) return this.getRootItems();
      if (element.contextValue === 'section' || element.contextValue === 'controlSection') {
         return element.children;
      }
      return [];
   }

   /**
    * コントロール定義からTreeItemを生成（共通実装）
    * @param {Array} controlDef - コントロール定義配列 [type, label, key, ...params]
    * @returns {TreeItem} 生成されたTreeItem
    */
   createControlItem(controlDef) {
      const [type, label, key, ...params] = controlDef;
      const controls = this.controls;

      if (type === 'checkbox') return new CheckboxControlItem(label, controls[key], key);
      if (type === 'slider') {
         const range = params[0];
         return new SliderControlItem(label, controls[key], range.min, range.max, range.step, key);
      }
      if (type === 'color') return new ColorControlItem(label, controls[key], key);

      throw new Error(`Unknown control type: ${type}`);
   }

   /**
    * サブクラスで実装: ルート要素を返す
    * @returns {any[]} ルート要素の配列
    */
   getRootItems() {
      throw new Error('getRootItems() must be implemented by subclass');
   }
}

module.exports = BaseProvider;

