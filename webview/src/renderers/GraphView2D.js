import ForceGraph from 'force-graph';
import GraphView, { applyOpacityToColor } from './GraphView';

/**
 * 2Dグラフのレンダリングと更新を管理するクラス
 * Strategyパターン: Concrete Strategy（具体的な戦略）
 * - 2D Force Graphライブラリを使用したレンダリング戦略を実装
 */

class GraphView2D extends GraphView {
  /**
   * GraphView2Dを初期化
   * @param {Object} options - オプション（親クラスに渡される）
   */
  constructor(options = {}) {
    super(options);
  }
  createLabelRenderer(ctx) {
    return {
      apply: (graph, getNodeProps) => {
        graph
          .nodeCanvasObject((node, localCtx) => {
            const props = getNodeProps(node);
            if (!props) return;
            const label = props?.label || node.name || node.id;
            const fontSize = ctx.controls.textSize || 12;
            localCtx.font = `${fontSize}px Sans-Serif`;
            localCtx.textAlign = 'center';
            localCtx.textBaseline = 'middle';
            localCtx.fillStyle = applyOpacityToColor('#ffffff', props.opacity);
            localCtx.fillText(label, node.x, node.y);
          })
          .nodeCanvasObjectMode(() => 'after');
      },
      clear: graph => {
        graph.nodeCanvasObjectMode(() => null);
      }
    };
  }

  createGraph(container) {
    return ForceGraph()(container);
  }

  focusNode(ctx, node) {
    if (ctx.graph && node.x !== undefined && node.y !== undefined) {
      ctx.graph.centerAt(node.x, node.y, 1000);
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

export default GraphView2D;
