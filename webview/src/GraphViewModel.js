/**
 * グラフの状態管理とレンダリングを統括するViewModelクラス
 *
 * MVVMパターン: ViewModel
 * - Model（GraphModel）: グラフデータとビジネスロジック
 * - View（GraphViewContext）: グラフの視覚的表現（Strategyパターンのコンテキスト）
 * - ViewModel（このクラス）: ModelとViewの仲介、プレゼンテーションロジック
 *
 * 責務:
 * 1. プレゼンテーション状態の管理（フォーカス、スライス、UI状態）
 * 2. ModelからViewへのデータ変換とコンテキスト生成
 * 3. ユーザーインタラクションの処理とModelへの反映
 * 4. Extension Bridge経由の外部イベント処理
 */
import { GraphModel } from './GraphModel';
import { GraphViewContext } from './views/GraphViewContext';
import { EXTENSION_TO_WEBVIEW, WEBVIEW_TO_EXTENSION, createMessage, isValidMessage } from './MessageTypes';

class GraphViewModel {
  /**
   * GraphViewModelを初期化
   * @param {Object} options - 初期化オプション
   * @param {HTMLElement} options.container - グラフコンテナ要素
   */
  constructor(options = {}) {
    // Model: グラフデータとビジネスロジック
    this._model = new GraphModel();

    // View: レンダリング戦略を管理するコンテキスト（StrategyパターンのContext）
    this._viewContext = new GraphViewContext(
      node => this._handleNodeClickCommand(node)
    );

    // ViewModel: プレゼンテーション状態
    this._presentationState = {
      controls: {},          // UI制御設定
      focusedNode: null,     // フォーカス中のノード
      sliceNodes: null,      // スライスハイライト対象ノード
      sliceLinks: null,      // スライスハイライト対象リンク
      isUserInteracting: false // ユーザー操作中フラグ
    };

    // VSCode API通信
    this._vscode = null;
    this._initializeVSCodeAPI();

    // 初期化時にViewをセットアップ
    if (options.container) {
      this._viewContext.initialize(options.container, this._createRenderingContext());
    }
  }

  /**
   * VSCode APIを初期化し、メッセージリスナーを設定
   * @private
   */
  _initializeVSCodeAPI() {
    if (typeof acquireVsCodeApi === 'function') {
      this._vscode = acquireVsCodeApi();
    }
    if (!this._vscode) return;

    window.addEventListener('message', event => {
      if (isValidMessage(event.data)) {
        this._handleMessage(event.data);
      }
    });

    this._sendMessage(WEBVIEW_TO_EXTENSION.READY);
  }

  /**
   * VSCode拡張機能にメッセージを送信
   * @param {string} type - メッセージタイプ
   * @param {*} payload - ペイロード（省略可能）
   * @private
   */
  _sendMessage(type, payload) {
    if (!this._vscode) return;
    this._vscode.postMessage(createMessage(type, payload));
  }

  /**
   * Extensionからのメッセージを処理
   * MVVMパターン: 外部イベントのディスパッチ
   * @param {Object} message - メッセージ { type: string, payload?: any }
   * @private
   */
  _handleMessage(message) {
    if (!message?.type) return;

    const handlers = {
      [EXTENSION_TO_WEBVIEW.GRAPH_UPDATE]: payload => this._handleGraphUpdate(payload || {}),
      [EXTENSION_TO_WEBVIEW.VIEW_UPDATE]: payload => this._handleViewUpdate(payload || {}),
      [EXTENSION_TO_WEBVIEW.NODE_FOCUS]: payload => this._executeFocusNodeCommand(payload || {}),
      [EXTENSION_TO_WEBVIEW.FOCUS_CLEAR]: () => this._executeClearFocusCommand()
    };

    const handler = handlers[message.type];
    if (!handler) {
      console.warn('[DependViz] Unknown message type:', message.type);
      return;
    }
    handler(message.payload);
  }

  /**
   * グラフデータ更新メッセージを処理
   * MVVMパターン: Modelへの更新とViewへの反映
   * @param {Object} payload - 更新データ（data、controls、dataVersion）
   * @private
   */
  _handleGraphUpdate(payload) {
    const version = typeof payload.dataVersion === 'number' ? payload.dataVersion : null;
    const { dataChange, modeChanged } = this._updateModelAndPresentation(payload, {
      allowData: true,
      dataVersion: version
    });
    if ((payload.data || payload.controls) && !modeChanged) {
      this._viewContext.update(this._createRenderingContext(), { reheatSimulation: dataChange });
    }
  }

  /**
   * ビュー更新メッセージを処理
   * MVVMパターン: プレゼンテーション状態の更新とViewへの反映
   * @param {Object} payload - 更新データ（controls）
   * @private
   */
  _handleViewUpdate(payload) {
    const { modeChanged } = this._updateModelAndPresentation(payload);
    if (payload.controls && !modeChanged) {
      this._viewContext.update(this._createRenderingContext());
    }
  }

  /**
   * ペイロードからModelとプレゼンテーション状態を更新
   * MVVMパターン: ModelとViewModelの状態管理
   * @param {Object} payload - 適用するペイロード
   * @param {Object} options - オプション
   * @param {boolean} options.allowData - データ更新を許可するか
   * @param {number} options.dataVersion - データバージョン
   * @returns {Object} 更新結果（dataChange、modeChanged）
   * @private
   */
  _updateModelAndPresentation(payload, options = {}) {
    let dataChange = false;
    let modeChanged = false;

    // Modelの更新
    if (options.allowData && payload.data) {
      const ok = options.dataVersion === null || options.dataVersion !== this._model.version;
      if (ok) {
        this._model.update(payload.data, options.dataVersion);
        dataChange = true;
      }
    }

    // プレゼンテーション状態の更新
    if (payload.controls) {
      modeChanged = this._updatePresentationControls(payload.controls);
    }

    // スライスハイライトの再計算（プレゼンテーションロジック）
    if (payload.data || payload.controls) {
      this._computePresentationSlice();
    }

    return { dataChange, modeChanged };
  }

  /**
   * コントロール設定を更新
   * MVVMパターン: プレゼンテーション状態の管理
   * @param {Object} controls - 新しいコントロール設定
   * @returns {boolean} モードが変更された場合true
   * @private
   */
  _updatePresentationControls(controls) {
    const oldMode = this._presentationState.controls.is3DMode ?? false;
    const hasMode = Object.prototype.hasOwnProperty.call(controls, 'is3DMode');
    const newMode = hasMode ? controls.is3DMode : oldMode;

    this._presentationState.controls = { ...this._presentationState.controls, ...controls };

    if (hasMode && newMode !== oldMode) {
      const changed = this._viewContext.toggleMode(newMode);
      if (changed) {
        this._viewContext.update(this._createRenderingContext(), { reheatSimulation: true });
      }
      return changed;
    }
    return false;
  }

  /**
   * スライスハイライトを計算
   * MVVMパターン: プレゼンテーションロジック
   * フォーカスノードと関連ノード/リンクを計算
   * @private
   */
  _computePresentationSlice() {
    if (!this._presentationState.focusedNode ||
        (!this._presentationState.controls.enableForwardSlice &&
         !this._presentationState.controls.enableBackwardSlice)) {
      this._presentationState.sliceNodes = null;
      this._presentationState.sliceLinks = null;
      return;
    }
    const { sliceNodes, sliceLinks } = this._computeSlice(
      this._presentationState.focusedNode,
      this._presentationState.controls,
      this._model.links
    );
    this._presentationState.sliceNodes = sliceNodes;
    this._presentationState.sliceLinks = sliceLinks;
  }

  /**
   * 依存関係スライスを計算
   * フォーカスノードから前方/後方の依存関係を指定深度まで探索
   * @param {Object} focusedNode - フォーカスノード
   * @param {Object} controls - コントロール設定
   * @param {Array} links - 全リンク配列
   * @returns {Object} { sliceNodes, sliceLinks }
   * @private
   */
  _computeSlice(focusedNode, controls, links) {
    const hasSlice = focusedNode && (controls.enableForwardSlice || controls.enableBackwardSlice);
    if (!hasSlice) return { sliceNodes: null, sliceLinks: null };

    const sliceNodes = new Set();
    const sliceLinks = new Set();
    const getId = v => (typeof v === 'object' ? v.id : v);

    sliceNodes.add(focusedNode.id);
    if (controls.enableForwardSlice) {
      const visitForward = (nodeId, depth) => {
        if (depth <= 0) return;
        links.forEach(link => {
          const sourceId = getId(link.source);
          if (sourceId !== nodeId) return;
          const targetId = getId(link.target);
          sliceLinks.add(link);
          if (!sliceNodes.has(targetId)) {
            sliceNodes.add(targetId);
            visitForward(targetId, depth - 1);
          }
        });
      };
      visitForward(focusedNode.id, controls.sliceDepth);
    }
    if (controls.enableBackwardSlice) {
      const visitBackward = (nodeId, depth) => {
        if (depth <= 0) return;
        links.forEach(link => {
          const targetId = getId(link.target);
          if (targetId !== nodeId) return;
          const sourceId = getId(link.source);
          sliceLinks.add(link);
          if (!sliceNodes.has(sourceId)) {
            sliceNodes.add(sourceId);
            visitBackward(sourceId, depth - 1);
          }
        });
      };
      visitBackward(focusedNode.id, controls.sliceDepth);
    }

    return { sliceNodes, sliceLinks };
  }

  /**
   * フォーカスノードを設定
   * MVVMパターン: プレゼンテーション状態の変更とViewへの反映
   * フォーカス状態が変更されると自動的にカメラ移動とビジュアル更新を実行
   * @param {Object|null} node - フォーカスするノード、またはクリア時null
   * @private
   */
  _updateFocusedNode(node) {
    // 変更がない場合は何もしない
    if (this._presentationState.focusedNode === node) return;

    this._presentationState.focusedNode = node;
    this._computePresentationSlice();

    // Viewコマンド: フォーカス状態に応じてカメラを移動
    const ctx = this._createRenderingContext();
    if (node) {
      this._viewContext.focusNode(ctx, node);
    } else {
      this._viewContext.clearFocus(ctx);
    }

    this._viewContext.refresh(ctx);
  }

  /**
   * ノードIDでノードをフォーカス
   * MVVMパターン: ViewModelコマンド
   * @param {Object} msg - フォーカスメッセージ（nodeIdまたはnode.id）
   * @private
   */
  _executeFocusNodeCommand(msg) {
    const nodeId = msg.nodeId || (msg.node && msg.node.id);
    const node = this._model.findNode(nodeId);
    if (!node) return;

    if (node.x === undefined || node.y === undefined) {
      setTimeout(() => this._executeFocusNodeCommand(msg), 100);
      return;
    }

    this._updateFocusedNode(node);
  }

  /**
   * フォーカスをクリア
   * MVVMパターン: ViewModelコマンド
   * @private
   */
  _executeClearFocusCommand() {
    this._updateFocusedNode(null);
  }

  /**
   * ノードクリックイベントを処理
   * MVVMパターン: ユーザーインタラクションの処理
   * Extensionにメッセージを送信してファイルを開く
   * @param {Object} node - クリックされたノード
   * @private
   */
  _handleNodeClickCommand(node) {
    if (!node?.filePath) return;
    this._sendMessage(WEBVIEW_TO_EXTENSION.FOCUS_NODE, {
      node: {
        id: node.id,
        filePath: node.filePath,
        name: node.name
      }
    });
  }

  /**
   * レンダリングコンテキストを生成
   * MVVMパターン: ViewModelがModelとプレゼンテーション状態をViewに変換
   * ModelとViewModelの状態をViewが必要とする形式に変換
   * @returns {Object} レンダリングに必要な全ての情報を含むコンテキスト
   * @private
   */
  _createRenderingContext() {
    const bgColor = (() => {
      const style = getComputedStyle(document.body);
      const bg = style.getPropertyValue('--vscode-editor-background').trim();
      const COLORS = this._presentationState.controls.COLORS || {};
      return bg || COLORS.BACKGROUND_DARK || '#1a1a1a';
    })();

    return {
      // Modelからのデータ
      data: {
        nodes: this._model.nodes,
        links: this._model.links
      },
      // プレゼンテーション状態（ViewModel）
      controls: this._presentationState.controls,
      ui: {
        focusedNode: this._presentationState.focusedNode,
        sliceNodes: this._presentationState.sliceNodes,
        sliceLinks: this._presentationState.sliceLinks,
        isUserInteracting: this._presentationState.isUserInteracting
      },
      // Viewへの参照
      graph: this._viewContext.graph,
      getBackgroundColor: () => bgColor
    };
  }

  /**
   * グラフのサイズを変更
   * @param {number} width - 新しい幅
   * @param {number} height - 新しい高さ
   */
  resize(width, height) {
    this._viewContext?.resize(width, height);
  }
}

export { GraphViewModel };