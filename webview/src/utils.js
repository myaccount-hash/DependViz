function applyFilter(nodes, links) {
  const controls = state.controls;

  let filteredNodes = nodes.filter(node => {
    if (!controls[`show${node.type}`]) return false;
    if (controls.hideIsolatedNodes && (!node.neighbors || node.neighbors.length === 0)) return false;
    if (controls.search && !matchesSearchQuery(node, controls.search)) return false;
    return true;
  });

  if (state.ui.focusedNode && (controls.enableForwardSlice || controls.enableBackwardSlice)) {
    const sliceNodes = new Set();
    sliceNodes.add(state.ui.focusedNode.id);

    if (controls.enableForwardSlice) {
      traverseSlice(state.ui.focusedNode, 'forward', controls.sliceDepth, sliceNodes, nodes, links);
    }
    if (controls.enableBackwardSlice) {
      traverseSlice(state.ui.focusedNode, 'backward', controls.sliceDepth, sliceNodes, nodes, links);
    }

    filteredNodes = filteredNodes.filter(node => sliceNodes.has(node.id));
  }

  const nodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredLinks = links.filter(link => {
    if (!controls[`show${link.type}`]) return false;
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    return nodeIds.has(sourceId) && nodeIds.has(targetId);
  });

  return { nodes: filteredNodes, links: filteredLinks };
}

function traverseSlice(node, direction, depth, visited, allNodes, allLinks) {
  if (depth <= 0) return;

  const relevantLinks = allLinks.filter(link => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    return direction === 'forward' ? sourceId === node.id : targetId === node.id;
  });

  relevantLinks.forEach(link => {
    const nextNodeId = direction === 'forward'
      ? (typeof link.target === 'object' ? link.target.id : link.target)
      : (typeof link.source === 'object' ? link.source.id : link.source);

    if (!visited.has(nextNodeId)) {
      visited.add(nextNodeId);
      const nextNode = allNodes.find(n => n.id === nextNodeId);
      if (nextNode) {
        traverseSlice(nextNode, direction, depth - 1, visited, allNodes, allLinks);
      }
    }
  });
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


// Message handlers for VSCode communication
function createMessageHandlers(state) {
  return {
    stackTrace: msg => {
      state.ui.stackTraceLinks = new Set(msg.paths.map(p => p.link));
      state.updateVisuals();
    },
    focusNodeById: msg => {
      state.focusNodeById(msg);
    },
    update: msg => {
      const hasDataChange = !!msg.data;
      const oldIs3DMode = state.controls.is3DMode;

      if (msg.data) {
        state.updateData(msg.data);
      }
      if (msg.controls) {
        state.updateControls(msg.controls);
      }
      if (msg.stackTracePaths) {
        state.ui.stackTraceLinks = new Set(msg.stackTracePaths.map(p => p.link));
      }

      const modeChanged = msg.controls && (state.controls.is3DMode !== oldIs3DMode);

      if (hasDataChange || modeChanged) {
        state.updateGraph({ reheatSimulation: true });
      } else {
        state.updateVisuals();
      }
    },
    toggle3DMode: msg => {
      state.toggleMode();
    }
  };
}
