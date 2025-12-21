import { GraphData } from '../utils/utils';
export interface TypeDefinition {
    type: string;
    defaultEnabled?: boolean;
    defaultColor: string;
}
export interface TypeDefinitions {
    node: TypeDefinition[];
    edge: TypeDefinition[];
}
export interface TypeInfo {
    category: 'node' | 'edge';
    type: string;
    defaultEnabled: boolean;
    defaultColor: string;
    filterKey: string;
    colorKey: string;
}
export interface TypeDefaults {
    filters: {
        node: Record<string, boolean>;
        edge: Record<string, boolean>;
    };
    colors: {
        node: Record<string, string>;
        edge: Record<string, string>;
    };
}
export declare abstract class BaseAnalyzer {
    analyzerId: string;
    private static _typeInfo?;
    private static _typeDefaults?;
    constructor();
    abstract analyze(): Promise<GraphData>;
    abstract analyzeFile(filePath: string): Promise<GraphData>;
    isFileSupported(filePath: string): boolean;
    stop(): Promise<void>;
    static get analyzerId(): string;
    static get displayName(): string;
    static getTypeDefinitions(): TypeDefinitions;
    static getTypeInfo(): TypeInfo[];
    static getTypeDefaults(): TypeDefaults;
    private static _buildTypeDefaults;
    private static _buildTypeInfo;
    private static _buildControlKey;
}
export default BaseAnalyzer;
//# sourceMappingURL=BaseAnalyzer.d.ts.map