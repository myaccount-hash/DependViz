import { GraphViewModel } from './GraphViewModel';
import ExtensionBridge from './ExtensionBridge';
import GraphRenderer2D from './GraphRenderer2D';
import GraphRenderer3D from './GraphRenderer3D';

function initialize() {
  const container = document.getElementById('graph-container');
  if (!container) {
    console.error('[DependViz] Container not found');
    return null;
  }
  
  const viewModel = new GraphViewModel({
    renderer2d: new GraphRenderer2D(),
    renderer3d: new GraphRenderer3D(),
    extensionBridge: new ExtensionBridge(),
    container
  });
  
  window.addEventListener('resize', () => viewModel.handleResize());
  
  return viewModel;
}

const viewModel = initialize();