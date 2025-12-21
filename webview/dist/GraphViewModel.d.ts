import type { GraphData, GraphNode, Controls, UIState, RotationState, GraphInstance, GraphUpdateOptions, GraphUpdatePayload, ViewUpdatePayload, FocusNodeMessage, GraphRenderer } from './types';
import type { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
/**
 * アプリケーションのグラフ状態を管理するクラス
 */
declare class GraphViewModel {
    data: GraphData;
    dataVersion: number | null;
    controls: Controls;
    ui: UIState;
    rotation: RotationState;
    private _graph;
    private _labelRenderer;
    private _currentRenderer;
    get graph(): GraphInstance | null;
    get labelRenderer(): CSS2DRenderer | null;
    setGraph(graph: GraphInstance): void;
    setLabelRenderer(renderer: CSS2DRenderer): void;
    getBackgroundColor(): string;
    updateData(data: GraphData, version?: number): void;
    private _buildNeighborRelations;
    updateControls(controls: Partial<Controls>): void;
    getNodeFilePath(node: GraphNode): string | undefined;
    private _normalizePath;
    private _pathsMatch;
    updateSliceHighlight(): void;
    updateHighlightedPath(nodeNames: string[]): void;
    clearHighlightedPath(): void;
    clearRenderer(): void;
    getRenderer(): GraphRenderer;
    initGraph(): boolean;
    updateGraph(options?: GraphUpdateOptions): void;
    updateVisuals(): void;
    handleGraphUpdate(payload?: GraphUpdatePayload): void;
    handleViewUpdate(payload?: ViewUpdatePayload): void;
    handleResize(): void;
    focusNodeByPath(filePath: string): void;
    focusNodeById(msg: FocusNodeMessage): void;
    clearFocus(): void;
}
declare const state: GraphViewModel;
export { GraphViewModel, state };
export default state;
//# sourceMappingURL=GraphViewModel.d.ts.map