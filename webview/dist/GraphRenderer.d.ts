import type { GraphNode, GraphLink, GraphViewModel, NodeVisualProps, LinkVisualProps, GraphUpdateOptions, LabelRenderer, GraphInstance, NodeRule, LinkRule } from './types';
/**
 * グラフのレンダリングと視覚属性計算を管理する基底クラス
 * TODO: ExtensionBridgeの依存を解消
 */
declare abstract class GraphRenderer {
    state: GraphViewModel;
    is3D: boolean;
    nodeRules: NodeRule[];
    linkRules: LinkRule[];
    constructor(state: GraphViewModel);
    protected _computeNodeLabel(node: GraphNode): string;
    _getTypeColor(category: string, type?: string): string | null;
    protected _applyRules<T, R extends Record<string, any>>(item: T, rules: Array<(item: T, ctx: this) => Partial<R> | null>, defaults: R): R;
    getNodeVisualProps(node: GraphNode): NodeVisualProps;
    getLinkVisualProps(link: GraphLink): LinkVisualProps;
    protected _applyLabels(getNodeProps: (node: GraphNode) => NodeVisualProps | null): void;
    protected _applyColors(getNodeProps: (node: GraphNode) => NodeVisualProps | null, getLinkProps: (link: GraphLink) => LinkVisualProps | null): void;
    updateGraph(options?: GraphUpdateOptions): void;
    updateVisuals(): void;
    initGraph(): boolean;
    abstract createLabelRenderer(): LabelRenderer;
    abstract createGraph(container: HTMLElement): GraphInstance;
    abstract focusNode(node: GraphNode): void;
    abstract checkLibraryAvailability(): boolean;
    abstract getLibraryName(): string;
    abstract getModeName(): string;
    setupRenderer(_container: HTMLElement): void;
    setupEventListeners(_graph: GraphInstance): void;
    onGraphUpdated(): void;
}
export declare function applyOpacityToColor(color: string, opacity?: number): string;
export { GraphRenderer as default };
//# sourceMappingURL=GraphRenderer.d.ts.map