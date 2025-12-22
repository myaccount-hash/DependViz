// GraphViewModel.js
import { computeSlice } from './utils';
import ExtensionBridge from './ExtensionBridge';

/**
 * アプリケーションのグラフ状態を管理するクラス
 */
function isValidMessage(message) {
  return message && message.jsonrpc === '2.0' && typeof message.method === 'string';
}

function createMessageHandlers(state) {
  return {
    'graph:update': params => state.handleGraphUpdate(params || {}),
    'view:update': params => state.handleViewUpdate(params || {}),
    'node:focus': params => state.focusNodeById(params || {}),
    'mode:toggle': () => state.toggleMode(),
    'focus:clear': () => state.clearFocus()
  };
}

function dispatchMessage(handlers, message) {
  if (!isValidMessage(message)) return;
  const handler = handlers[message.method];
  if (handler) {
    handler(message.params);
  } else if (message.method) {
    console.warn('[DependViz] Unknown message method:', message.method);
  }
}

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
      highlightedPath: null,
      isUserInteracting: false
    };
    this.rotation = {
      frame: null,
      startTime: null,
      startAngle: null,
      timeout: null
    };
    this._graph = null;
    this._labelRenderer = null;
    this._currentRenderer = null;
    this._extensionBridge = null;
    this._messageHandlers = null;
  }

  get graph() { return this._graph; }
  get labelRenderer() { return this._labelRenderer; }

  setGraph(graph) { this._graph = graph; }
  setLabelRenderer(renderer) { this._labelRenderer = renderer; }

  initializeBridge() {
    if (!this._extensionBridge) {
      if (!this._messageHandlers) {
        this._messageHandlers = createMessageHandlers(this);
      }
      this._extensionBridge = new ExtensionBridge(message => {
        dispatchMessage(this._messageHandlers, message);
      });
    }
    return this._extensionBridge.initialize();
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

  // ノードのファイルパスを取得
  getNodeFilePath(node) {
    return node.filePath || node.file;
  }

  // パスを正規化
  _normalizePath(path) {
    if (!path) return '';
    let normalized = path.replace(/\\/g, '/');
    normalized = normalized.replace(/\/+$/, '');
    const parts = normalized.split('/').filter(p => p && p !== '.');
    const result = [];
    for (const part of parts) {
      if (part === '..') {
        if (result.length > 0 && result[result.length - 1] !== '..') {
          result.pop();
        } else {
          result.push(part);
        }
      } else {
        result.push(part);
      }
    }
    return result.join('/');
  }

  // 2つのパスが一致するか判定
  _pathsMatch(path1, path2) {
    if (!path1 || !path2) return false;
    const norm1 = this._normalizePath(path1);
    const norm2 = this._normalizePath(path2);
    if (norm1 === norm2) return true;
    const parts1 = norm1.split('/').filter(Boolean);
    const parts2 = norm2.split('/').filter(Boolean);
    if (parts1.length === 0 || parts2.length === 0) return false;
    const minLen = Math.min(parts1.length, parts2.length);
    if (minLen < 2) return false;
    for (let i = 1; i <= minLen; i++) {
      const suffix1 = parts1.slice(-i).join('/');
      const suffix2 = parts2.slice(-i).join('/');
      if (suffix1 === suffix2) return true;
    }
    return false;
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

  // パスハイライトを更新
  updateHighlightedPath(nodeNames) {
    if (!nodeNames || nodeNames.length === 0) {
      this.ui.highlightedPath = null;
      return;
    }
    
    const nodeSet = new Set();
    const pathLinks = [];
    
    nodeNames.forEach(name => {
      const node = this.data.nodes.find(n => n.name === name);
      if (node) nodeSet.add(node.id);
    });
    
    for (let i = 0; i < nodeNames.length - 1; i++) {
      const sourceName = nodeNames[i];
      const targetName = nodeNames[i + 1];
      const sourceNode = this.data.nodes.find(n => n.name === sourceName);
      const targetNode = this.data.nodes.find(n => n.name === targetName);
      
      if (sourceNode && targetNode) {
        pathLinks.push({
          source: sourceNode.id,
          target: targetNode.id
        });
      }
    }
    
    this.ui.highlightedPath = { 
      nodes: nodeSet,
      pathLinks: pathLinks
    };
  }

  // パスハイライトをクリア
  clearHighlightedPath() {
    this.ui.highlightedPath = null;
    this.updateVisuals();
  }

  // レンダリングモードをクリア
  clearRenderer() {
    if (this.rotation.frame) {
      cancelAnimationFrame(this.rotation.frame);
      this.rotation.frame = null;
    }
    clearTimeout(this.rotation.timeout);
    this._graph = null;
    this._labelRenderer = null;
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
    const filePath = this.getNodeFilePath(node);
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
  toggleMode() {
    const newMode = !this.controls.is3DMode;
    this.updateControls({ is3DMode: newMode });
    this.clearRenderer();
    this.updateGraph({ reheatSimulation: true });
  }

  // グラフインスタンスを初期化
  initGraph() {
    const renderer = this.getRenderer();
    return renderer.initGraph();
  }

  // グラフを更新
  updateGraph(options = {}) {
    const { reheatSimulation = false } = options;

    if (!this._graph) {
      if (!this.initGraph()) {
        console.error('[DependViz] Failed to initialize graph');
        return;
      }
    }

    this.getRenderer().updateGraph({ reheatSimulation });
  }

  // 視覚属性のみを更新
  updateVisuals() {
    if (!this._graph) return;
    this.getRenderer().updateVisuals();
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
      this.updateVisuals();
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
      this.updateVisuals();
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

  // ファイルパスでノードをフォーカス
  focusNodeByPath(filePath) {
    if (!filePath) return;
    const node = this.data.nodes.find(n => this._pathsMatch(this.getNodeFilePath(n), filePath));
    if (node) {
      this.ui.focusedNode = node;
      this.getRenderer().focusNode(node);
      this.updateSliceHighlight();
      this.updateVisuals();
    }
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
