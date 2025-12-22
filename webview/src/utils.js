export function applyFilter(nodes, links, state) {
  const controls = state.controls;
  const typeFilters = controls.typeFilters || {};

  const filteredNodes = nodes.filter(node => {
    const nodeTypeMap = typeFilters.node;
    if (nodeTypeMap && node.type && nodeTypeMap[node.type] !== undefined && !nodeTypeMap[node.type]) {
      return false;
    }
    if (controls.hideIsolatedNodes && (!node.neighbors || node.neighbors.length === 0)) return false;
    if (controls.search && !matchesSearchQuery(node, controls.search)) return false;
    return true;
  });

  const nodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredLinks = links.filter(link => {
    const edgeTypeMap = typeFilters.edge;
    if (edgeTypeMap && link.type && edgeTypeMap[link.type] !== undefined && !edgeTypeMap[link.type]) {
      return false;
    }
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    return nodeIds.has(sourceId) && nodeIds.has(targetId);
  });

  return { nodes: filteredNodes, links: filteredLinks };
}

export function computeSlice(focusedNode, controls, nodes, links) {
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

function matchesSearchQuery(node, query) {
  if (!query) return true;
  const q = query.toLowerCase();

  if (q.includes(':')) {
    const hasAnd = q.includes(' and ');
    const hasOr = q.includes(' or ');
    const parts = q.split(/\s+and\s+|\s+or\s+/).map(s => s.trim());

    const results = parts.map(raw => {
      let subQ = raw;
      const isNot = subQ.startsWith('not ');
      if (isNot) subQ = subQ.substring(4);

      const match = subQ.match(/^(\w+):(.+)$/);
      if (!match) return isNot ? true : false;

      const [, field, rawValue] = match;
      const isRegex = rawValue.startsWith('/') && rawValue.endsWith('/');
      const searchValue = isRegex ? rawValue.slice(1, -1) : rawValue;

      let nodeValue = '';
      if (field === 'name') nodeValue = node.name || '';
      else if (field === 'type') nodeValue = node.type || '';
      else if (field === 'path') nodeValue = node.filePath || '';

      let ok = false;
      if (isRegex) {
        try {
          ok = new RegExp(searchValue, 'i').test(nodeValue);
        } catch (e) {
          ok = false;
        }
      } else {
        ok = nodeValue.toLowerCase().includes(searchValue.toLowerCase());
      }

      return isNot ? !ok : ok;
    });

    if (hasAnd && !hasOr) return results.every(Boolean);
    if (hasOr && !hasAnd) return results.some(Boolean);
    if (hasAnd && hasOr) return results.every(Boolean);
    return results[0];
  }

  return (node.name && node.name.toLowerCase().includes(q)) ||
         (node.id && node.id.toLowerCase().includes(q));
}
