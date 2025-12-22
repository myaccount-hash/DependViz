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
  updateData(data, version) {
    this.data = { 
      nodes: [...(data.nodes || [])], 
      links: [...(data.links || [])] 
    };
    this._buildNeighborRelations();
    
    if (typeof version === 'number') {
      this.dataVersion = version;
    } else {
      this.dataVersion = (this.dataVersion ?? 0) + 1;
    }
  }

  // 隣接関係を構築
  _buildNeighborRelations() {
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
  }

  // コントロール設定を更新
  updateControls(controls) {
    this.controls = { ...this.controls, ...controls };
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


  // レンダリングモードをクリア
  clearRenderer() {
    if (this.rotation.frame) {
      cancelAnimationFrame(this.rotation.frame);
      this.rotation.frame = null;
    }
    clearTimeout(this.rotation.timeout);
    this._graph = null;
    this._currentRenderer = null;
  }

  // 現在のレンダラーを取得
  getRenderer() {
    const GraphRenderer2D = require('./GraphRenderer2D').default;
    const GraphRenderer3D = require('./GraphRenderer3D').default;
    const callbacks = {
      onNodeClick: node => this.notifyNodeFocus(node)
    };
    
    if (!this._currentRenderer || this._currentRenderer.is3DMode !== this.controls.is3DMode) {
      this._currentRenderer = this.controls.is3DMode
        ? new GraphRenderer3D(this, callbacks)
        : new GraphRenderer2D(this, callbacks);
    }
    return this._currentRenderer;
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
  toggle3DMode() {
    const newMode = !this.controls.is3DMode;
    this.updateControls({ is3DMode: newMode });
    this.clearRenderer();
    this.updateGraph({ reheatSimulation: true });
  }

  // グラフを更新
  updateGraph(options = {}) {
    const { reheatSimulation = false } = options;

    if (!this._graph) {
      const renderer = this.getRenderer();
      if (!renderer.initializeGraph()) {
        console.error('[DependViz] Failed to initialize graph');
        return;
      }
    }

    this.getRenderer().updateGraph({ reheatSimulation });
  }

  // グラフ更新メッセージを処理
  handleGraphUpdate(payload = {}) {
    const incomingVersion = typeof payload.dataVersion === 'number' ? payload.dataVersion : null;
    const result = this._applyPayload(payload, {
      allowData: true,
      dataVersion: incomingVersion
    });
    const reheatSimulation = result.dataChange || result.modeChanged;
    if (payload.data || payload.controls) {
      this.updateGraph({ reheatSimulation });
    } else if (payload.callStackPaths) {
      if (!this._graph) return;
      this.getRenderer().updateVisuals();
    }
  }

  // ビュー更新メッセージを処理
  handleViewUpdate(payload = {}) {
    const result = this._applyPayload(payload);
    if (result.modeChanged) {
      this.clearRenderer();
      this.updateGraph({ reheatSimulation: true });
    } else if (payload.controls) {
      this.updateGraph();
    } else if (payload.callStackPaths) {
      if (!this._graph) return;
      this.getRenderer().updateVisuals();
    }
  }

  _applyPayload(payload, options = {}) {
    const allowData = options.allowData === true;
    const dataVersion = options.dataVersion ?? null;
    const oldMode = this.controls.is3DMode ?? false;
    let dataChange = false;

    if (allowData && payload.data) {
      const ok = dataVersion === null || dataVersion !== this.dataVersion;
      if (ok) {
        this.updateData(payload.data, dataVersion);
      }
      dataChange = ok;
    }
    if (payload.controls) {
      this.updateControls(payload.controls);
    }
    if (payload.callStackPaths) {
      this.ui.callStackLinks = new Set(payload.callStackPaths.map(p => p.link));
    }
    if (payload.data || payload.controls) {
      this.updateSliceHighlight();
    }

    const newMode = this.controls.is3DMode ?? false;
    const modeChanged = payload.controls && (newMode !== oldMode);
    if (modeChanged) {
      this.clearRenderer();
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
    this.getRenderer().focusNode(node);
    this.updateSliceHighlight();
    this.updateVisuals();
  }

  // フォーカスをクリア
  clearFocus() {
    this.ui.focusedNode = null;
    const renderer = this.getRenderer();
    if (renderer?.cancelRotation) renderer.cancelRotation();
    if (renderer?.updateAutoRotation) renderer.updateAutoRotation();
    this.updateSliceHighlight();
    this.updateVisuals();
  }
}

const state = new GraphViewModel();

export { GraphViewModel, state };
export default state;
