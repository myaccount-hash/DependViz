import ForceGraph from 'force-graph';
import GraphRenderer, { applyOpacityToColor } from './GraphRenderer';

/**
 * 2Dグラフのレンダリングと更新を管理するクラス
 */

class GraphRenderer2D extends GraphRenderer {
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

export default GraphRenderer2D;
