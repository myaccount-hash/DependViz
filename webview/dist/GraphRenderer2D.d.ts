import GraphRenderer from './GraphRenderer';
import type { GraphNode, GraphViewModel, LabelRenderer, ForceGraph2DInstance } from './types';
/**
 * 2Dグラフのレンダリングと更新を管理するクラス
 */
declare class GraphRenderer2D extends GraphRenderer {
    constructor(state: GraphViewModel);
    createLabelRenderer(): LabelRenderer;
    createGraph(container: HTMLElement): ForceGraph2DInstance;
    focusNode(node: GraphNode): void;
    checkLibraryAvailability(): boolean;
    getLibraryName(): string;
    getModeName(): string;
}
export default GraphRenderer2D;
//# sourceMappingURL=GraphRenderer2D.d.ts.map