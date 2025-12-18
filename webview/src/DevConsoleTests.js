import state from './GraphViewModel';
import { applyFilter, computeSlice } from './utils';

const buildSampleData = () => {
  const nodes = [
    { id: 'n1', name: 'Alpha.Component', type: 'core', filePath: '/src/core/alpha.ts', neighbors: ['n2'] },
    { id: 'n2', name: 'Beta.Component', type: 'ui', filePath: '/src/ui/beta.ts', neighbors: ['n3'] },
    { id: 'n3', name: 'Gamma.Helper', type: 'util', filePath: '/src/util/gamma.ts' }
  ];
  const links = [
    { source: 'n1', target: 'n2', type: 'strong' },
    { source: 'n2', target: 'n3', type: 'weak' }
  ];
  return { nodes, links };
};

const createStateStub = overrides => {
  const controls = {
    nodeOpacity: 1,
    edgeOpacity: 1,
    linkWidth: 1,
    hideIsolatedNodes: false,
    search: '',
    typeFilters: {},
    ...overrides
  };
  return { controls };
};

const runApplyFilterTest = () => {
  const data = buildSampleData();
  const stub = createStateStub({
    hideIsolatedNodes: true,
    typeFilters: { node: { core: true, ui: false, util: false } },
    search: 'Alpha'
  });
  const result = applyFilter(data.nodes, data.links, stub);
  const pass = result.nodes.length === 1 && result.nodes[0].id === 'n1';
  return {
    pass,
    filtered: {
      nodes: result.nodes.map(n => n.id),
      links: result.links.map(l => `${l.source}->${l.target}`)
    }
  };
};

const runComputeSliceTest = () => {
  const data = buildSampleData();
  const target = data.nodes[0];
  const controls = {
    enableForwardSlice: true,
    enableBackwardSlice: false,
    sliceDepth: 2
  };
  const result = computeSlice(target, controls, data.nodes, data.links);
  const pass = result.sliceNodes && result.sliceNodes.has('n2') && result.sliceNodes.has('n1');
  const sliceNodes = result.sliceNodes ? Array.from(result.sliceNodes) : [];
  const sliceLinks = result.sliceLinks ? Array.from(result.sliceLinks).map(l => `${l.source}->${l.target}`) : [];
  return { pass, sliceNodes, sliceLinks };
};

const runAllTests = () => ({
  applyFilter: runApplyFilterTest(),
  computeSlice: runComputeSliceTest()
});

const register = () => {
  if (typeof window === 'undefined') return;
  window.DependVizTests = {
    runAllTests,
    runApplyFilterTest,
    runComputeSliceTest,
    getSampleData: buildSampleData,
    state
  };
};

register();
