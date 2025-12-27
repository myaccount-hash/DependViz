/**
 * グラフの状態管理とレンダリングを統括するViewModelクラス
 * ExtensionとWebView間のメッセージング、状態管理、レンダリング制御を担当
 */
import { GraphState } from './GraphState';
import { RendererManager } from './renderers/RendererManager';
import { computeSlice } from './utils';

class GraphViewModel {
  /**
   * GraphViewModelを初期化
   * @param {Object} options - 初期化オプション
   * @param {Object} options.extensionBridge - ExtensionBridgeインスタンス
   * @param {HTMLElement} options.container - グラフコンテナ要素
   */
  constructor(options = {}) {
    this._state = new GraphState();
    this._render = new RendererManager(
      node => this._onNodeClick(node)
    );
    
    this._view = {
      controls: {},
      focusedNode: null,
      sliceNodes: null,
      sliceLinks: null,
      isUserInteracting: false
    };
    
    this._bridge = options.extensionBridge || null;
    if (this._bridge) {
      this._bridge.onMessage = msg => this._handleMessage(msg);
      this._bridge.initializeBridge();
    }
    
    if (options.container) {
      this._render.initialize(options.container, this._getContext());
    }
  }

  /**
   * ウィンドウリサイズイベントを処理
   */
  handleResize() {
    const container = document.getElementById('graph-container');
    if (!container) return;
    this._render.resize(container.clientWidth, container.clientHeight);
  }

  /**
   * ExtensionからのJSONRPCメッセージを処理
   * @param {Object} message - JSONRPCメッセージ
   * @private
   */
  _handleMessage(message) {
    if (!message || message.jsonrpc !== '2.0' || !message.method) return;
    
    const handlers = {
      'graph:update': params => this._handleGraphUpdate(params || {}),
      'view:update': params => this._handleViewUpdate(params || {}),
      'node:focus': params => this._focusNodeById(params || {}),
      'focus:clear': () => this._clearFocus()
    };
    
    const handler = handlers[message.method];
    if (!handler) {
      console.warn('[DependViz] Unknown method:', message.method);
      return;
    }
    handler(message.params);
  }

  /**
   * グラフデータ更新メッセージを処理
   * @param {Object} payload - 更新データ（data、controls、dataVersion）
   * @private
   */
  _handleGraphUpdate(payload) {
    const version = typeof payload.dataVersion === 'number' ? payload.dataVersion : null;
    const { dataChange, modeChanged } = this._applyPayload(payload, {
      allowData: true,
      dataVersion: version
    });
    if ((payload.data || payload.controls) && !modeChanged) {
      this._render.update(this._getContext(), { reheatSimulation: dataChange });
    }
  }

  /**
   * ビュー更新メッセージを処理（データは更新せず、表示設定のみ更新）
   * @param {Object} payload - 更新データ（controls）
   * @private
   */
  _handleViewUpdate(payload) {
    const { modeChanged } = this._applyPayload(payload);
    if (payload.controls && !modeChanged) {
      this._render.update(this._getContext());
    }
  }

  /**
   * ペイロードを適用して状態を更新
   * @param {Object} payload - 適用するペイロード
   * @param {Object} options - オプション
   * @param {boolean} options.allowData - データ更新を許可するか
   * @param {number} options.dataVersion - データバージョン
   * @returns {Object} 更新結果（dataChange、modeChanged）
   * @private
   */
  _applyPayload(payload, options = {}) {
    let dataChange = false;
    let modeChanged = false;
    
    if (options.allowData && payload.data) {
      const ok = options.dataVersion === null || options.dataVersion !== this._state.version;
      if (ok) {
        this._state.update(payload.data, options.dataVersion);
        dataChange = true;
      }
    }
    if (payload.controls) {
      modeChanged = this._setControls(payload.controls);
    }
    if (payload.data || payload.controls) {
      this._updateSliceHighlight();
    }
    
    return { dataChange, modeChanged };
  }

  /**
   * コントロール設定を更新
   * @param {Object} controls - 新しいコントロール設定
   * @returns {boolean} モードが変更された場合true
   * @private
   */
  _setControls(controls) {
    const oldMode = this._view.controls.is3DMode ?? false;
    const hasMode = Object.prototype.hasOwnProperty.call(controls, 'is3DMode');
    const newMode = hasMode ? controls.is3DMode : oldMode;
    
    this._view.controls = { ...this._view.controls, ...controls };
    
    if (hasMode && newMode !== oldMode) {
      const changed = this._render.toggleMode(newMode, this._getContext());
      if (changed) {
        this._render.update(this._getContext(), { reheatSimulation: true });
      }
      return changed;
    }
    return false;
  }

  /**
   * スライスハイライトを更新
   * フォーカスノードと関連ノード/リンクを計算
   * @private
   */
  _updateSliceHighlight() {
    if (!this._view.focusedNode ||
        (!this._view.controls.enableForwardSlice && !this._view.controls.enableBackwardSlice)) {
      this._view.sliceNodes = null;
      this._view.sliceLinks = null;
      return;
    }
    const { sliceNodes, sliceLinks } = computeSlice(
      this._view.focusedNode,
      this._view.controls,
      this._state.nodes,
      this._state.links
    );
    this._view.sliceNodes = sliceNodes;
    this._view.sliceLinks = sliceLinks;
  }

  /**
   * フォーカスノードを設定（状態変化ハンドラ）
   * フォーカス状態が変更されると自動的にカメラ移動とビジュアル更新を実行
   * @param {Object|null} node - フォーカスするノード、またはクリア時null
   * @private
   */
  _setFocusedNode(node) {
    // 変更がない場合は何もしない
    if (this._view.focusedNode === node) return;

    this._view.focusedNode = node;
    this._updateSliceHighlight();

    // フォーカス状態に応じてカメラを移動
    if (node) {
      this._render.focusNode(this._getContext(), node);
    } else {
      this._render.clearFocus(this._getContext());
    }

    this._render.refresh(this._getContext());
  }

  /**
   * ノードIDでノードをフォーカス
   * @param {Object} msg - フォーカスメッセージ（nodeIdまたはnode.id）
   * @private
   */
  _focusNodeById(msg) {
    const nodeId = msg.nodeId || (msg.node && msg.node.id);
    const node = this._state.findNode(nodeId);
    if (!node) return;

    if (node.x === undefined || node.y === undefined) {
      setTimeout(() => this._focusNodeById(msg), 100);
      return;
    }

    // 状態変更ハンドラを使用
    this._setFocusedNode(node);
  }

  /**
   * フォーカスをクリア
   * @private
   */
  _clearFocus() {
    // 状態変更ハンドラを使用
    this._setFocusedNode(null);
  }

  /**
   * ノードクリックイベントを処理
   * Extensionにメッセージを送信してファイルを開く
   * @param {Object} node - クリックされたノード
   * @private
   */
  _onNodeClick(node) {
    if (!node?.filePath) return;
    this._bridge?.send('focusNode', {
      node: {
        id: node.id,
        filePath: node.filePath,
        name: node.name
      }
    });
  }

  /**
   * レンダリングコンテキストを生成
   * @returns {Object} レンダリングに必要な全ての情報を含むコンテキスト
   * @private
   */
  _getContext() {
    const bgColor = (() => {
      const style = getComputedStyle(document.body);
      const bg = style.getPropertyValue('--vscode-editor-background').trim();
      const COLORS = this._view.controls.COLORS || {};
      return bg || COLORS.BACKGROUND_DARK || '#1a1a1a';
    })();

    return {
      data: {
        nodes: this._state.nodes,
        links: this._state.links
      },
      controls: this._view.controls,
      ui: {
        focusedNode: this._view.focusedNode,
        sliceNodes: this._view.sliceNodes,
        sliceLinks: this._view.sliceLinks,
        isUserInteracting: this._view.isUserInteracting
      },
      graph: this._render.graph,
      getBackgroundColor: () => bgColor
    };
  }
}

export { GraphViewModel };