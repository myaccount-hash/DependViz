import GraphRenderer from './GraphRenderer';
import type { GraphNode, GraphViewModel, LabelRenderer, ForceGraph3DInstance, GraphInstance } from './types';
/**
 * 3Dグラフのレンダリングと更新を管理するクラス
 */
declare class GraphRenderer3D extends GraphRenderer {
    constructor(state: GraphViewModel);
    createLabelRenderer(): LabelRenderer;
    createGraph(container: HTMLElement): ForceGraph3DInstance;
    focusNode(node: GraphNode): void;
    checkLibraryAvailability(): boolean;
    getLibraryName(): string;
    getModeName(): string;
    setupEventListeners(graph: GraphInstance): void;
    onGraphUpdated(): void;
    cancelRotation(): void;
    updateAutoRotation(): void;
}
export default GraphRenderer3D;
//# sourceMappingURL=GraphRenderer3D.d.ts.map