import { GraphViewModel } from './GraphViewModel';
import ExtensionBridge from './ExtensionBridge';

function initialize() {
  const container = document.getElementById('graph-container');
  if (!container) {
    console.error('[DependViz] Container not found');
    return null;
  }

  const viewModel = new GraphViewModel({
    extensionBridge: new ExtensionBridge(),
    container
  });

  window.addEventListener('resize', () => viewModel.handleResizeCommand());

  return viewModel;
}

const viewModel = initialize();