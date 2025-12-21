import ForceGraph from 'force-graph';
import GraphRenderer, { applyOpacityToColor } from './GraphRenderer';
import type {
  GraphNode,
  GraphViewModel,
  LabelRenderer,
  NodeVisualProps,
  ForceGraph2DInstance
} from './types';

/**
 * 2Dグラフのレンダリングと更新を管理するクラス
 */
class GraphRenderer2D extends GraphRenderer {
  constructor(state: GraphViewModel) {
    super(state);
  }

  createLabelRenderer(): LabelRenderer {
    return {
      apply: (graph, getNodeProps) => {
        const getFontSize = (): number => this.state.controls.textSize || 12;
        const getLabel = (node: GraphNode, props: NodeVisualProps | null): string =>
          props?.label || node.name || node.id;

        const graph2D = graph as ForceGraph2DInstance;
        graph2D
          .nodeCanvasObject((node: any, ctx: any) => {
            const graphNode = node as GraphNode;
            const props = getNodeProps(graphNode);
            if (!props) return;
            const label = getLabel(graphNode, props);
            const fontSize = getFontSize();
            ctx.font = `${fontSize}px Sans-Serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = applyOpacityToColor('#ffffff', props.opacity);
            ctx.fillText(label, graphNode.x || 0, graphNode.y || 0);
          })
          .nodeCanvasObjectMode(() => 'after');
      },
      clear: (graph) => {
        const graph2D = graph as ForceGraph2DInstance;
        graph2D.nodeCanvasObjectMode(() => null);
      }
    };
  }

  createGraph(container: HTMLElement): ForceGraph2DInstance {
    return (ForceGraph as any)()(container);
  }

  focusNode(node: GraphNode): void {
    if (this.state.graph && node.x !== undefined && node.y !== undefined) {
      const graph2D = this.state.graph as ForceGraph2DInstance;
      graph2D.centerAt(node.x, node.y, 1000);
    }
  }

  checkLibraryAvailability(): boolean {
    return typeof ForceGraph !== 'undefined';
  }

  getLibraryName(): string {
    return 'ForceGraph';
  }

  getModeName(): string {
    return '2D';
  }
}

export default GraphRenderer2D;
