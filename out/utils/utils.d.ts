export interface GraphNode {
    id: string;
    type?: string;
    linesOfCode?: number;
    filePath?: string;
    file?: string;
    name?: string;
    [key: string]: any;
}
export interface GraphLink {
    source: string | GraphNode;
    target: string | GraphNode;
    type: string;
    [key: string]: any;
}
export interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}
export declare function validateGraphData(data: any): asserts data is GraphData;
export declare function getNodeFilePath(node: GraphNode): string | undefined;
/**
 * グラフデータをマージ（重複を排除）
 * Java側のCodeGraph.merge()ロジックと同等の処理
 * @param target - マージ先のグラフデータ
 * @param source - マージ元のグラフデータ
 */
export declare function mergeGraphData(target: GraphData, source: GraphData): void;
//# sourceMappingURL=utils.d.ts.map