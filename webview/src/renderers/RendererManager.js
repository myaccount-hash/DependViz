// RendererManager.js
import GraphRenderer2D from './GraphRenderer2D';
import GraphRenderer3D from './GraphRenderer3D';

class RendererManager {
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
  
  toggleMode(mode) {
    const changed = mode !== this._mode;
    this._mode = mode;
    if (changed) {
      this._graph = null;
    }
    return changed;
  }
  
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
  
  refresh(context) {
    if (!this._graph) return;
    const renderer = this._getRenderer();
    if (!renderer) return;
    renderer.updateVisuals(context);
  }
  
  focusNode(context, node) {
    const renderer = this._getRenderer();
    if (!renderer) return;
    renderer.focusNode(context, node);
  }
  
  clearFocus(context) {
    const renderer = this._getRenderer();
    if (renderer?.cancelFocusUpdate) renderer.cancelFocusUpdate(context);
    if (renderer?.updateFocus) renderer.updateFocus(context);
  }

  resize(width, height) {
    if (!this._graph) return;
    this._graph.width(width).height(height);
  }

  get graph() { return this._graph; }

  _getRenderer() {
    return this._mode ? this._renderer3d : this._renderer2d;
  }
}

export { RendererManager };