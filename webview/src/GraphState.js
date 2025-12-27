// GraphState.js
class GraphState {
  constructor() {
    this._nodes = [];
    this._links = [];
    this._version = 0;
    this._nodeById = new Map();
  }
  
  update(data, version) {
    this._nodes = this._preprocessNodes(data.nodes || []);
    this._links = this._preprocessLinks(data.links || []);
    this._version = typeof version === 'number' ? version : this._version + 1;
  }
  
  findNode(nodeId) {
    return this._nodes.find(n => n.id === nodeId);
  }
  
  get nodes() { return this._nodes; }
  get links() { return this._links; }
  get version() { return this._version; }
  
  _preprocessNodes(nodes) {
    const processed = [...nodes];
    this._nodeById.clear();
    processed.forEach(node => {
      node.neighbors = [];
      node.links = [];
      if (node.id != null) {
        this._nodeById.set(node.id, node);
      }
    });
    return processed;
  }
  
  _preprocessLinks(links) {
    const processed = [...links];
    processed.forEach(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      const a = this._nodeById.get(sourceId);
      const b = this._nodeById.get(targetId);
      if (!a || !b) return;
      a.neighbors.push(b);
      b.neighbors.push(a);
      a.links.push(link);
      b.links.push(link);
    });
    return processed;
  }
}

export { GraphState };