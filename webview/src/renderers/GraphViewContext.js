/**
 * 2D/3Dレンダラーを管理し、モード切り替えやグラフ操作を統一的に提供するクラス
 * Strategyパターン: Context（コンテキスト）クラス
 * - GraphViewを戦略（Strategy）として扱う
 * - setStrategy()で戦略を動的に切り替え可能
 * - すべての操作を現在の戦略に委譲
 */
import GraphView2D from './GraphView2D';
import GraphView3D from './GraphView3D';

class GraphViewContext {
  /**
   * GraphViewContextを初期化
   * Strategyパターン: Contextクラスのコンストラクタ
   * @param {Function} onNodeClick - ノードクリック時のコールバック関数
   */
  constructor(onNodeClick) {
    // 利用可能な戦略（Strategy）を登録
    this._availableStrategies = {
      '2d': new GraphView2D({ onNodeClick }),
      '3d': new GraphView3D({ onNodeClick })
    };

    // デフォルト戦略を設定（2Dモード）
    this._strategy = this._availableStrategies['2d'];
    this._graph = null;
  }

  /**
   * レンダリング戦略を設定
   * Strategyパターン: 戦略の切り替えメソッド
   * @param {string} strategyName - 戦略名（'2d' または '3d'）
   * @returns {boolean} 戦略が変更された場合true
   */
  setStrategy(strategyName) {
    const newStrategy = this._availableStrategies[strategyName];
    if (!newStrategy) {
      console.error(`[DependViz] Unknown strategy: ${strategyName}`);
      return false;
    }

    const changed = this._strategy !== newStrategy;
    if (changed) {
      this._strategy = newStrategy;
      this._graph = null; // 戦略変更時はグラフを再初期化
    }
    return changed;
  }

  /**
   * グラフを初期化
   * 現在の戦略（Strategy）を使用してグラフインスタンスを作成
   * @param {HTMLElement} container - グラフを表示するコンテナ要素
   * @param {Object} context - レンダリングコンテキスト
   * @returns {boolean} 初期化が成功した場合true
   */
  initialize(container, context) {
    if (!this._strategy) {
      console.error('[DependViz] No strategy set');
      return false;
    }

    const graph = this._strategy.initializeGraph(container, context);
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
    const strategyName = mode ? '3d' : '2d';
    return this.setStrategy(strategyName);
  }

  /**
   * グラフを更新
   * グラフが未初期化の場合は自動的に初期化を実行
   * Strategyパターン: 現在の戦略に処理を委譲
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
    if (!this._strategy) return;
    this._strategy.updateGraph(context, options);
  }

  /**
   * 視覚属性のみを更新（データ構造は変更しない）
   * Strategyパターン: 現在の戦略に処理を委譲
   * @param {Object} context - レンダリングコンテキスト
   */
  refresh(context) {
    if (!this._graph || !this._strategy) return;
    this._strategy.updateVisuals(context);
  }

  /**
   * 指定ノードにフォーカス
   * Strategyパターン: 現在の戦略に処理を委譲
   * @param {Object} context - レンダリングコンテキスト
   * @param {Object} node - フォーカス対象のノード
   */
  focusNode(context, node) {
    if (!this._strategy) return;
    this._strategy.focusNode(context, node);
  }

  /**
   * フォーカスをクリア
   * フォーカス更新ループをキャンセルし、フォーカス状態をリセット
   * Strategyパターン: 現在の戦略に処理を委譲
   * @param {Object} context - レンダリングコンテキスト
   */
  clearFocus(context) {
    if (!this._strategy) return;
    if (this._strategy.cancelFocusUpdate) {
      this._strategy.cancelFocusUpdate(context);
    }
    if (this._strategy.updateFocus) {
      this._strategy.updateFocus(context);
    }
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
   * 現在の戦略を取得
   * Strategyパターン: 現在アクティブな戦略へのアクセサ
   * @returns {GraphView} 現在のレンダリング戦略
   */
  get strategy() { return this._strategy; }
}

export { GraphViewContext };