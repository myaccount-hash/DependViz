const vscode = require('vscode');
const { loadControls, getWorkspaceFolder } = require('../utils/utils');
const fs = require('fs');
const path = require('path');

class BaseProvider {
   constructor() {
      this._onDidChangeTreeData = new vscode.EventEmitter();
      this.onDidChangeTreeData = this._onDidChangeTreeData.event;
      this._onDidChange = new vscode.EventEmitter();
      this.onDidChange = this._onDidChange.event;
      this._cache = null;
      this._cacheFilePath = null;
   }

   // 設定管理機能（オプショナル）
   get controls() {
      return loadControls();
   }

   _updateControls(data) {
      if (data && typeof data === 'object' && 'key' in data && 'value' in data) {
         const config = vscode.workspace.getConfiguration('forceGraphViewer');
         config.update(data.key, data.value, vscode.ConfigurationTarget.Workspace);
      }
   }

   // キャッシュファイル管理機能（オプショナル）
   _initCache(filename) {
      try {
         const workspaceFolder = getWorkspaceFolder();
         const vscodePath = path.join(workspaceFolder.uri.fsPath, '.vscode');
         if (!fs.existsSync(vscodePath)) {
            fs.mkdirSync(vscodePath, { recursive: true });
         }
         this._cacheFilePath = path.join(vscodePath, filename);
         this._cache = this._loadCache();
      } catch (e) {
         this._cache = null;
      }
   }

   _loadCache() {
      if (!this._cacheFilePath || !fs.existsSync(this._cacheFilePath)) {
         return null;
      }
      try {
         const data = fs.readFileSync(this._cacheFilePath, 'utf8');
         return JSON.parse(data);
      } catch (e) {
         return null;
      }
   }

   _saveCache(data) {
      if (!this._cacheFilePath) return;
      try {
         fs.writeFileSync(this._cacheFilePath, JSON.stringify(data, null, 2));
         this._cache = data;
      } catch (e) {
         console.error('Failed to save cache:', e);
      }
   }

   // 汎用メソッド
   update(data) {
      // 統一された更新ロジック
      if (data && data.key && 'value' in data) {
         // { key, value } → 個別設定更新
         this._updateControls(data);
      } else if (Array.isArray(data)) {
         // 配列 → キャッシュ更新
         this._updateCache(data);
      } else if (data && data.items) {
         // { items } → チェックボックス更新
         this._updateCheckboxes(data.items);
      }

      this._onDidChangeTreeData.fire();
      this._onDidChange.fire(this._getData());
   }

   refresh() {
      this._onDidChangeTreeData.fire();
   }

   getTreeItem(element) {
      return element;
   }

   // サブクラスでオーバーライド可能（オプショナル）
   _getData() {
      // デフォルト: 設定を返す
      return loadControls();
   }

   _updateCache(data) {
      // デフォルト実装（サブクラスでオーバーライド）
   }

   _updateCheckboxes(items) {
      // デフォルト実装（サブクラスでオーバーライド）
   }
}

module.exports = BaseProvider;

