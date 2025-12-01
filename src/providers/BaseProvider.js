const vscode = require('vscode');
const { ConfigurationManager } = require('../utils/ConfigurationManager');

/**
 * TreeViewプロバイダーの基底クラス
 * - VS Code設定との連携
 * - イベント管理（onDidChangeTreeData, onDidChange）
 * - サブクラスで getChildren() と createControlItem() を実装すること
 */
class BaseProvider {
   constructor() {
      this._onDidChangeTreeData = new vscode.EventEmitter();
      this.onDidChangeTreeData = this._onDidChangeTreeData.event;
      this._onDidChange = new vscode.EventEmitter();
      this.onDidChange = this._onDidChange.event;
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
      this._onDidChange.fire(this.controls);
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
    * サブクラスで実装必須: ツリーの子要素を返す
    * @param {any} element - 親要素（nullの場合はルート要素）
    * @returns {any[]} 子要素の配列
    */
   getChildren(element) {
      throw new Error('getChildren() must be implemented by subclass');
   }

   /**
    * サブクラスで実装必須: コントロール定義からTreeItemを生成
    * @param {Array} controlDef - コントロール定義配列 [type, label, key, ...params]
    * @returns {TreeItem} 生成されたTreeItem
    */
   createControlItem(controlDef) {
      throw new Error('createControlItem() must be implemented by subclass');
   }
}

module.exports = BaseProvider;

