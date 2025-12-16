export function applyFilter(nodes, links, state) {
  const controls = state.controls;

  let filteredNodes = nodes.filter(node => {
    if (!controls[`show${node.type}`]) return false;
    if (controls.hideIsolatedNodes && (!node.neighbors || node.neighbors.length === 0)) return false;
    if (controls.search && !matchesSearchQuery(node, controls.search)) return false;
    return true;
  });

  const nodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredLinks = links.filter(link => {
    if (!controls[`show${link.type}`]) return false;
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

  const visit = (nodeId, depth, direction) => {
    if (depth <= 0) return;
    links.forEach(link => {
      const sourceId = getId(link.source);
      const targetId = getId(link.target);
      const isForward = direction === 'forward' && sourceId === nodeId;
      const isBackward = direction === 'backward' && targetId === nodeId;
      if (!isForward && !isBackward) return;

      sliceLinks.add(link);
      const nextId = direction === 'forward' ? targetId : sourceId;
      if (!sliceNodes.has(nextId)) {
        sliceNodes.add(nextId);
        visit(nextId, depth - 1, direction);
      }
    });
  };

  sliceNodes.add(focusedNode.id);
  if (controls.enableForwardSlice) {
    visit(focusedNode.id, controls.sliceDepth, 'forward');
  }
  if (controls.enableBackwardSlice) {
    visit(focusedNode.id, controls.sliceDepth, 'backward');
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

    const results = parts.map(subQ => {
      if (subQ.startsWith('not ')) {
        return !evaluateFieldQuery(node, subQ.substring(4));
      }
      return evaluateFieldQuery(node, subQ);
    });

    if (hasAnd && !hasOr) return results.every(Boolean);
    if (hasOr && !hasAnd) return results.some(Boolean);
    if (hasAnd && hasOr) return results.every(Boolean);
    return results[0];
  }

  return (node.name && node.name.toLowerCase().includes(q)) ||
         (node.id && node.id.toLowerCase().includes(q));
}

function evaluateFieldQuery(node, query) {
  const match = query.match(/^(\w+):(.+)$/);
  if (!match) return false;

  const [, field, rawValue] = match;
  const isRegex = rawValue.startsWith('/') && rawValue.endsWith('/');
  const searchValue = isRegex ? rawValue.slice(1, -1) : rawValue;

  let nodeValue = '';
  if (field === 'name') nodeValue = node.name || '';
  else if (field === 'type') nodeValue = node.type || '';
  else if (field === 'path') nodeValue = node.filePath || node.file || '';

  if (isRegex) {
    try {
      return new RegExp(searchValue, 'i').test(nodeValue);
    } catch (e) {
      return false;
    }
  }

  return nodeValue.toLowerCase().includes(searchValue.toLowerCase());
}
