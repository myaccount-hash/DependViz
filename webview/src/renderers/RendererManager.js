// RendererManager.js
import GraphRenderer2D from './GraphRenderer2D';
import GraphRenderer3D from './GraphRenderer3D';

class RendererManager {
  constructor(onNodeClick) {
    this._renderer2d = new GraphRenderer2D();
    this._renderer3d = new GraphRenderer3D();
    this._graph = null;
    this._mode = false;
    this._rotation = { frame: null, startTime: null, startAngle: null, timeout: null };

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
  
  toggleMode(mode, context) {
    const changed = mode !== this._mode;
    this._mode = mode;
    if (changed) {
      this._cancelRotation();
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
    if (renderer?.cancelRotation) renderer.cancelRotation(context);
    if (renderer?.updateAutoRotation) renderer.updateAutoRotation(context);
  }
  
  resize(width, height) {
    if (!this._graph) return;
    this._graph.width(width).height(height);
  }
  
  get graph() { return this._graph; }
  get rotation() { return this._rotation; }
  
  _getRenderer() {
    return this._mode ? this._renderer3d : this._renderer2d;
  }
  
  _cancelRotation() {
    if (this._rotation.frame) {
      cancelAnimationFrame(this._rotation.frame);
      this._rotation.frame = null;
    }
    clearTimeout(this._rotation.timeout);
  }
}

export { RendererManager };