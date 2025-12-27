// GraphViewModel.js
import { GraphState } from './GraphState';
import { RendererManager } from './renderers/RendererManager';
import { computeSlice } from './utils';

class GraphViewModel {
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
  
  handleResize() {
    const container = document.getElementById('graph-container');
    if (!container) return;
    this._render.resize(container.clientWidth, container.clientHeight);
  }
  
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
  
  _handleViewUpdate(payload) {
    const { modeChanged } = this._applyPayload(payload);
    if (payload.controls && !modeChanged) {
      this._render.update(this._getContext());
    }
  }
  
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
  
  _focusNodeById(msg) {
    const nodeId = msg.nodeId || (msg.node && msg.node.id);
    const node = this._state.findNode(nodeId);
    if (!node) return;
    
    if (node.x === undefined || node.y === undefined) {
      setTimeout(() => this._focusNodeById(msg), 100);
      return;
    }
    
    this._view.focusedNode = node;
    this._render.focusNode(this._getContext(), node);
    this._updateSliceHighlight();
    this._render.refresh(this._getContext());
  }
  
  _clearFocus() {
    this._view.focusedNode = null;
    this._render.clearFocus(this._getContext());
    this._updateSliceHighlight();
    this._render.refresh(this._getContext());
  }
  
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