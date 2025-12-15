// 2D GraphRenderer implementation

class GraphRenderer2D extends GraphRenderer {
  createLabelRenderer() {
    return new Canvas2DLabelRenderer(this.state);
  }

  createGraph(container) {
    return ForceGraph()(container);
  }

  focusNode(node) {
    if (this.state.graph && node.x !== undefined && node.y !== undefined) {
      this.state.graph.centerAt(node.x, node.y, 1000);
    }
  }

  checkLibraryAvailability() {
    return typeof ForceGraph !== 'undefined';
  }

  getLibraryName() {
    return 'ForceGraph';
  }

  getModeName() {
    return '2D';
  }
}
