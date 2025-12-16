import ForceGraph from 'force-graph';
import GraphRenderer, { applyOpacityToColor } from './GraphRenderer';

/**
 * 2Dグラフのレンダリングと更新を管理するクラス
 */

class GraphRenderer2D extends GraphRenderer {
  createLabelRenderer() {
    return {
      apply: (graph, getNodeProps) => {
        const getFontSize = () => this.state.controls.textSize || 12;
        const getLabel = (node, props) => props?.label || node.name || node.id;

        graph
          .nodeCanvasObject((node, ctx) => {
            const props = getNodeProps(node);
            if (!props) return;
            const label = getLabel(node, props);
            const fontSize = getFontSize();
            ctx.font = `${fontSize}px Sans-Serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = applyOpacityToColor('#ffffff', props.opacity);
            ctx.fillText(label, node.x, node.y);
          })
          .nodeCanvasObjectMode(() => 'after');
      },
      clear: (graph) => {
        graph.nodeCanvasObjectMode(() => null);
      }
    };
  }

  createGraph(container) {
    return ForceGraph()(container);
  }

  focusNode(node) {
    if (this.state.graph && node.x !== undefined && node.y !== undefined) {
      this.state.graph.centerAt(node.x, node.y, 1000);
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
