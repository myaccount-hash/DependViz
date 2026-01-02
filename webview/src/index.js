import { GraphViewModel } from './GraphViewModel';

function initialize() {
  const container = document.getElementById('graph-container');
  if (!container) {
    console.error('[DependViz] Container not found');
    return null;
  }

  const viewModel = new GraphViewModel({ container });

  // ウィンドウリサイズ時にグラフをリサイズ
  window.addEventListener('resize', () => {
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    viewModel.resize(width, height);
  });

  return viewModel;
}

const viewModel = initialize();