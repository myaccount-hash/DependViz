/**
 * Shared type definitions for DependViz webview
 */
import type { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
export interface VsCodeApi {
    postMessage(message: unknown): void;
    getState(): unknown;
    setState(state: unknown): void;
}
export interface JsonRpcMessage {
    jsonrpc: '2.0';
    method: string;
    params?: unknown;
}
export interface GraphNode {
    id: string;
    name?: string;
    type?: string;
    file?: string;
    filePath?: string;
    linesOfCode?: number;
    x?: number;
    y?: number;
    z?: number;
    neighbors?: GraphNode[];
    links?: GraphLink[];
}
export interface GraphLink {
    source: string | GraphNode;
    target: string | GraphNode;
    type?: string;
}
export interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}
export interface NodeVisualProps {
    color?: string;
    sizeMultiplier: number;
    label: string;
    opacity: number;
    size: number;
}
export interface LinkVisualProps {
    color?: string;
    widthMultiplier: number;
    particles: number;
    opacity: number;
    arrowSize: number;
    width: number;
}
export interface ColorScheme {
    NODE_DEFAULT?: string;
    EDGE_DEFAULT?: string;
    PATH_LINK?: string;
    STACK_TRACE_LINK?: string;
    BACKGROUND_DARK?: string;
}
export interface TypeColorMap {
    [type: string]: string;
}
export interface TypeFilterMap {
    [type: string]: boolean;
}
export interface Controls {
    is3DMode?: boolean;
    nodeSizeByLoc?: boolean;
    hideIsolatedNodes?: boolean;
    showNames?: boolean;
    shortNames?: boolean;
    nodeSize: number;
    linkWidth: number;
    nodeOpacity: number;
    edgeOpacity: number;
    dimOpacity?: number;
    linkDistance: number;
    focusDistance?: number;
    arrowSize: number;
    textSize?: number;
    nameFontSize?: number;
    sliceDepth: number;
    enableForwardSlice?: boolean;
    enableBackwardSlice?: boolean;
    autoRotate?: boolean;
    rotateSpeed: number;
    search?: string;
    typeColors?: {
        node?: TypeColorMap;
        edge?: TypeColorMap;
    };
    typeFilters?: {
        node?: TypeFilterMap;
        edge?: TypeFilterMap;
    };
    COLORS?: ColorScheme;
    AUTO_ROTATE_DELAY?: number;
}
export interface HighlightedPath {
    nodes: Set<string>;
    pathLinks: Array<{
        source: string;
        target: string;
    }>;
}
export interface UIState {
    callStackLinks: Set<GraphLink>;
    sliceNodes: Set<string> | null;
    sliceLinks: Set<GraphLink> | null;
    focusedNode: GraphNode | null;
    highlightedPath: HighlightedPath | null;
    isUserInteracting: boolean;
}
export interface RotationState {
    frame: number | null;
    startTime: number | null;
    startAngle: number | null;
    timeout: NodeJS.Timeout | null;
}
export type MessageHandler = (params?: unknown) => void;
export interface MessageHandlers {
    [method: string]: MessageHandler;
}
export interface GraphUpdateOptions {
    reheatSimulation?: boolean;
}
export interface CallStackPath {
    link: GraphLink;
}
export interface GraphUpdatePayload {
    data?: GraphData;
    controls?: Partial<Controls>;
    callStackPaths?: CallStackPath[];
    dataVersion?: number;
}
export interface ViewUpdatePayload {
    controls?: Partial<Controls>;
    callStackPaths?: CallStackPath[];
}
export interface FocusNodeMessage {
    nodeId?: string;
    node?: {
        id: string;
        filePath?: string;
        name?: string;
    };
}
export type ForceGraph2DInstance = any;
export type ForceGraph3DInstance = any;
export type GraphInstance = ForceGraph2DInstance | ForceGraph3DInstance;
export interface LabelRenderer {
    apply(graph: GraphInstance, getNodeProps: (node: GraphNode) => NodeVisualProps | null): void;
    clear(graph: GraphInstance): void;
}
export type NodeRule = (node: GraphNode, ctx: {
    state: GraphViewModel;
    _getTypeColor: (category: string, type?: string) => string | null;
}) => Partial<NodeVisualProps> | null;
export type LinkRule = (link: GraphLink, ctx: {
    state: GraphViewModel;
    _getTypeColor: (category: string, type?: string) => string | null;
}) => Partial<LinkVisualProps> | null;
export interface SliceResult {
    sliceNodes: Set<string> | null;
    sliceLinks: Set<GraphLink> | null;
}
export interface GraphViewModel {
    data: GraphData;
    dataVersion: number | null;
    controls: Controls;
    ui: UIState;
    rotation: RotationState;
    graph: GraphInstance | null;
    labelRenderer: CSS2DRenderer | null;
    getBackgroundColor(): string;
    updateData(data: GraphData, version?: number): void;
    updateControls(controls: Partial<Controls>): void;
    getNodeFilePath(node: GraphNode): string | undefined;
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
    setGraph(graph: GraphInstance): void;
    setLabelRenderer(renderer: CSS2DRenderer): void;
}
export interface GraphRenderer {
    state: GraphViewModel;
    is3D: boolean;
    nodeRules: NodeRule[];
    linkRules: LinkRule[];
    getNodeVisualProps(node: GraphNode): NodeVisualProps;
    getLinkVisualProps(link: GraphLink): LinkVisualProps;
    updateGraph(options?: GraphUpdateOptions): void;
    updateVisuals(): void;
    initGraph(): boolean;
    createLabelRenderer(): LabelRenderer;
    createGraph(container: HTMLElement): GraphInstance;
    focusNode(node: GraphNode): void;
    checkLibraryAvailability(): boolean;
    getLibraryName(): string;
    getModeName(): string;
    setupRenderer?(container: HTMLElement): void;
    setupEventListeners?(graph: GraphInstance): void;
    onGraphUpdated?(): void;
}
//# sourceMappingURL=types.d.ts.map