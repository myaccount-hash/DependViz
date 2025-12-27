/**
 * 2D/3Dレンダラーを管理し、モード切り替えやグラフ操作を統一的に提供するクラス
 */
import GraphRenderer2D from './GraphRenderer2D';
import GraphRenderer3D from './GraphRenderer3D';

class RendererManager {
  /**
   * レンダラーマネージャーを初期化
   * @param {Function} onNodeClick - ノードクリック時のコールバック関数
   */
  constructor(onNodeClick) {
    this._renderer2d = new GraphRenderer2D();
    this._renderer3d = new GraphRenderer3D();
    this._graph = null;
    this._mode = false;

    if (this._renderer2d) {
      this._renderer2d.callbacks = { onNodeClick };
    }
    if (this._renderer3d) {
      this._renderer3d.callbacks = { onNodeClick };
    }
  }

  /**
   * グラフを初期化
   * 現在のモードに応じたレンダラーでグラフインスタンスを作成
   * @param {HTMLElement} container - グラフを表示するコンテナ要素
   * @param {Object} context - レンダリングコンテキスト
   * @returns {boolean} 初期化が成功した場合true
   */
  initialize(container, context) {
    const renderer = this._getRenderer();
    if (!renderer) return false;
    const graph = renderer.initializeGraph(container, context);
    if (!graph) {
      console.error('[DependViz] Failed to initialize graph');
      return false;
    }
    this._graph = graph;
    return true;
  }

  /**
   * レンダリングモードを切り替え
   * モードが変更された場合、グラフインスタンスをリセット
   * @param {boolean} mode - trueで3Dモード、falseで2Dモード
   * @returns {boolean} モードが変更された場合true
   */
  toggleMode(mode) {
    const changed = mode !== this._mode;
    this._mode = mode;
    if (changed) {
      this._graph = null;
    }
    return changed;
  }

  /**
   * グラフを更新
   * グラフが未初期化の場合は自動的に初期化を実行
   * @param {Object} context - レンダリングコンテキスト
   * @param {Object} options - 更新オプション（reheatSimulationなど）
   */
  update(context, options = {}) {
    if (!this._graph) {
      const container = document.getElementById('graph-container');
      if (!container || !this.initialize(container, context)) {
        return;
      }
    }
    const renderer = this._getRenderer();
    if (!renderer) return;
    renderer.updateGraph(context, options);
  }

  /**
   * 視覚属性のみを更新（データ構造は変更しない）
   * @param {Object} context - レンダリングコンテキスト
   */
  refresh(context) {
    if (!this._graph) return;
    const renderer = this._getRenderer();
    if (!renderer) return;
    renderer.updateVisuals(context);
  }

  /**
   * 指定ノードにフォーカス
   * @param {Object} context - レンダリングコンテキスト
   * @param {Object} node - フォーカス対象のノード
   */
  focusNode(context, node) {
    const renderer = this._getRenderer();
    if (!renderer) return;
    renderer.focusNode(context, node);
  }

  /**
   * フォーカスをクリア
   * フォーカス更新ループをキャンセルし、フォーカス状態をリセット
   * @param {Object} context - レンダリングコンテキスト
   */
  clearFocus(context) {
    const renderer = this._getRenderer();
    if (renderer?.cancelFocusUpdate) renderer.cancelFocusUpdate(context);
    if (renderer?.updateFocus) renderer.updateFocus(context);
  }

  /**
   * グラフのサイズを変更
   * @param {number} width - 新しい幅
   * @param {number} height - 新しい高さ
   */
  resize(width, height) {
    if (!this._graph) return;
    this._graph.width(width).height(height);
  }

  /**
   * 現在のグラフインスタンスを取得
   * @returns {Object|null} グラフインスタンス
   */
  get graph() { return this._graph; }

  /**
   * 現在のモードに応じたレンダラーを取得
   * @returns {GraphRenderer2D|GraphRenderer3D} レンダラーインスタンス
   * @private
   */
  _getRenderer() {
    return this._mode ? this._renderer3d : this._renderer2d;
  }
}

export { RendererManager };