// GraphViewModel.js
import { computeSlice } from './utils';
import ExtensionBridge from './ExtensionBridge';

/**
 * アプリケーションのグラフ状態を管理するクラス
 */
class GraphViewModel {
  constructor() {
    this.data = { nodes: [], links: [] };
    this.dataVersion = null;
    this.controls = {};
    this.ui = {
      callStackLinks: new Set(),
      sliceNodes: null,
      sliceLinks: null,
      focusedNode: null,
      isUserInteracting: false
    };
    this.rotation = {
      frame: null,
      startTime: null,
      startAngle: null,
      timeout: null
    };
    this._graph = null;
    this._currentRenderer = null;
    this._extensionBridge = null;
    this._messageHandlers = null;
  }

  get graph() { return this._graph; }
  setGraph(graph) { this._graph = graph; }

  initializeBridge() {
    if (!this._extensionBridge) {
      if (!this._messageHandlers) {
        this._messageHandlers = {
          'graph:update': params => this.handleGraphUpdate(params || {}),
          'view:update': params => this.handleViewUpdate(params || {}),
          'node:focus': params => this.focusNodeById(params || {}),
          'focus:clear': () => this.clearFocus()
        };
      }
      this._extensionBridge = new ExtensionBridge(message => {
        if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') return;
        const handler = this._messageHandlers[message.method];
        if (handler) {
          handler(message.params);
        } else if (message.method) {
          console.warn('[DependViz] Unknown message method:', message.method);
        }
      });
    }
    return this._extensionBridge.initializeBridge();
  }

  // VSCode背景色を取得
  getBackgroundColor() {
    const style = getComputedStyle(document.body);
    const bgColor = style.getPropertyValue('--vscode-editor-background').trim();
    const COLORS = this.controls.COLORS || {};
    return bgColor || COLORS.BACKGROUND_DARK || '#1a1a1a';
  }

  // グラフデータとバージョンを更新
  refreshGraph(data, version) {
    this.data = { 
      nodes: [...(data.nodes || [])], 
      links: [...(data.links || [])] 
    };
    const nodeById = new Map();
    
    this.data.nodes.forEach(node => {
      node.neighbors = [];
      node.links = [];
      if (node.id != null) {
        nodeById.set(node.id, node);
      }
    });

    this.data.links.forEach(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;

      const a = nodeById.get(sourceId);
      const b = nodeById.get(targetId);
      if (!a || !b) return;

      a.neighbors.push(b);
      b.neighbors.push(a);
      a.links.push(link);
      b.links.push(link);
    });
    
    if (typeof version === 'number') {
      this.dataVersion = version;
    } else {
      this.dataVersion = (this.dataVersion ?? 0) + 1;
    }
  }

  // コントロール設定を更新
  setControls(controls) {
    const oldMode = this.controls.is3DMode ?? false;
    const hasMode = Object.prototype.hasOwnProperty.call(controls, 'is3DMode');
    const newMode = hasMode ? controls.is3DMode : oldMode;
    const modeChanged = hasMode && newMode !== oldMode;
    if (modeChanged) {
      return this.toggleMode(newMode, { controls, updateGraph: true });
    }
    this.controls = { ...this.controls, ...controls };
    return { modeChanged: false };
  }

  // スライスハイライトを更新
  updateSliceHighlight() {
    if (!this.ui.focusedNode || (!this.controls.enableForwardSlice && !this.controls.enableBackwardSlice)) {
      this.ui.sliceNodes = null;
      this.ui.sliceLinks = null;
      return;
    }
    const { sliceNodes, sliceLinks } = computeSlice(
      this.ui.focusedNode, 
      this.controls, 
      this.data.nodes, 
      this.data.links
    );
    this.ui.sliceNodes = sliceNodes;
    this.ui.sliceLinks = sliceLinks;
  }


  // 現在のレンダラーを取得
  getRenderer() {
    return this._currentRenderer;
  }

  // レンダラーを生成
  _createRenderer() {
    const GraphRenderer2D = require('./GraphRenderer2D').default;
    const GraphRenderer3D = require('./GraphRenderer3D').default;
    const callbacks = {
      onNodeClick: node => this.notifyNodeFocus(node)
    };
    
    return this.controls.is3DMode
      ? new GraphRenderer3D(callbacks)
      : new GraphRenderer2D(callbacks);
  }

  // ノードクリック時の通知を送信
  notifyNodeFocus(node) {
    if (!node) return;
    const filePath = node.filePath;
    if (!filePath) return;
    this._extensionBridge?.send('focusNode', {
      node: {
        id: node.id,
        filePath: filePath,
        name: node.name
      }
    });
  }

  // モード切り替えを処理
  toggleMode(nextMode, options = {}) {
    const oldMode = this.controls.is3DMode ?? false;
    const mode = typeof nextMode === 'boolean' ? nextMode : !oldMode;
    const modeChanged = mode !== oldMode;
    const controls = options.controls || null;

    if (controls) {
      this.controls = { ...this.controls, ...controls, is3DMode: mode };
    } else {
      this.controls = { ...this.controls, is3DMode: mode };
    }

    if (modeChanged) {
      if (this.rotation.frame) {
        cancelAnimationFrame(this.rotation.frame);
        this.rotation.frame = null;
      }
      clearTimeout(this.rotation.timeout);
      this._graph = null;
      this._currentRenderer = null;
      this._currentRenderer = this._createRenderer();
      if (options.updateGraph !== false) {
        this.updateGraph({ reheatSimulation: true });
      }
    }

    return { modeChanged };
  }

  // グラフを更新
  updateGraph(options = {}) {
    const { reheatSimulation = false } = options;

    if (!this._graph) {
      if (!this.initializeGraph()) return;
    }

    const renderer = this.getRenderer();
    if (!renderer) return;
    renderer.updateGraph(this._getRenderContext(), { reheatSimulation });
  }

  // グラフ更新メッセージを処理
  handleGraphUpdate(payload = {}) {
    const incomingVersion = typeof payload.dataVersion === 'number' ? payload.dataVersion : null;
    const result = this._applyPayload(payload, {
      allowData: true,
      dataVersion: incomingVersion
    });
    if (payload.data || payload.controls) {
      if (!result.modeChanged) {
        this.updateGraph({ reheatSimulation: result.dataChange });
      }
    } else if (payload.callStackPaths) {
      if (!this._graph) return;
      const renderer = this.getRenderer();
      if (!renderer) return;
      renderer.updateVisuals(this._getRenderContext());
    }
  }

  refreshView() {
    if (!this._graph) return;
    const renderer = this.getRenderer();
    if (!renderer) return;
    renderer.updateVisuals(this._getRenderContext());
  }

  // ビュー更新メッセージを処理
  handleViewUpdate(payload = {}) {
    const result = this._applyPayload(payload);
    if (payload.controls && !result.modeChanged) {
      this.updateGraph();
    } else if (payload.callStackPaths) {
      if (!this._graph) return;
      const renderer = this.getRenderer();
      if (!renderer) return;
      renderer.updateVisuals(this._getRenderContext());
    }
  }

  _applyPayload(payload, options = {}) {
    const allowData = options.allowData === true;
    const dataVersion = options.dataVersion ?? null;
    let dataChange = false;
    let modeChanged = false;

    if (allowData && payload.data) {
      const ok = dataVersion === null || dataVersion !== this.dataVersion;
      if (ok) {
        this.refreshGraph(payload.data, dataVersion);
      }
      dataChange = ok;
    }
    if (payload.controls) {
      const result = this.setControls(payload.controls);
      modeChanged = result.modeChanged;
    }
    if (payload.callStackPaths) {
      this.ui.callStackLinks = new Set(payload.callStackPaths.map(p => p.link));
    }
    if (payload.data || payload.controls) {
      this.updateSliceHighlight();
    }

    return { dataChange, modeChanged };
  }

  // ウィンドウリサイズを処理
  handleResize() {
    if (!this._graph) return;
    const container = document.getElementById('graph-container');
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    this._graph.width(width).height(height);
  }

  // IDでノードをフォーカス
  focusNodeById(msg) {
    const nodeId = msg.nodeId || (msg.node && msg.node.id);
    const node = this.data.nodes.find(n => n.id === nodeId);

    if (!node) return;

    if (node.x === undefined || node.y === undefined) {
      setTimeout(() => this.focusNodeById(msg), 100);
      return;
    }

    this.ui.focusedNode = node;
    const renderer = this.getRenderer();
    if (!renderer) return;
    renderer.focusNode(this._getRenderContext(), node);
    this.updateSliceHighlight();
    this.refreshView();
  }

  // フォーカスをクリア
  clearFocus() {
    this.ui.focusedNode = null;
    const renderer = this.getRenderer();
    if (renderer?.cancelRotation) renderer.cancelRotation(this._getRenderContext());
    if (renderer?.updateAutoRotation) renderer.updateAutoRotation(this._getRenderContext());
    this.updateSliceHighlight();
    this.refreshView();
  }

  _getRenderContext() {
    return {
      data: this.data,
      controls: this.controls,
      ui: this.ui,
      rotation: this.rotation,
      graph: this._graph,
      getBackgroundColor: () => this.getBackgroundColor()
    };
  }

  initializeGraph() {
    const renderer = this._currentRenderer || this._createRenderer();
    this._currentRenderer = renderer;
    if (!renderer) return false;
    const container = document.getElementById('graph-container');
    const graph = renderer.initializeGraph(container, this._getRenderContext());
    if (!graph) {
      console.error('[DependViz] Failed to initialize graph');
      return false;
    }
    this.setGraph(graph);
    return true;
  }
}

const state = new GraphViewModel();

export { GraphViewModel, state };
export default state;
