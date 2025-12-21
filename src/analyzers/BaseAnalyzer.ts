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

export abstract class BaseAnalyzer {
    analyzerId: string;
    private static _typeInfo?: TypeInfo[];
    private static _typeDefaults?: TypeDefaults;

    constructor() {
        this.analyzerId = (this.constructor as typeof BaseAnalyzer).analyzerId;
    }

    abstract analyze(): Promise<GraphData>;
    abstract analyzeFile(filePath: string): Promise<GraphData>;

    isFileSupported(_filePath: string): boolean {
        return true;
    }

    async stop(): Promise<void> {
        // Override in subclasses if needed
    }

    static get analyzerId(): string {
        throw new Error('analyzerId must be implemented');
    }

    static get displayName(): string {
        return this.analyzerId;
    }

    static getTypeDefinitions(): TypeDefinitions {
        return {
            node: [],
            edge: []
        };
    }

    static getTypeInfo(): TypeInfo[] {
        if (!this._typeInfo) {
            this._typeInfo = this._buildTypeInfo();
        }
        return this._typeInfo.map(info => ({ ...info }));
    }

    static getTypeDefaults(): TypeDefaults {
        if (!this._typeDefaults) {
            if (!this._typeInfo) {
                this._typeInfo = this._buildTypeInfo();
            }
            this._typeDefaults = this._buildTypeDefaults();
        }
        return JSON.parse(JSON.stringify(this._typeDefaults));
    }

    private static _buildTypeDefaults(): TypeDefaults {
        const defaults: TypeDefaults = {
            filters: { node: {}, edge: {} },
            colors: { node: {}, edge: {} }
        };
        this._typeInfo!.forEach(info => {
            defaults.filters[info.category][info.type] = info.defaultEnabled !== undefined ? !!info.defaultEnabled : true;
            defaults.colors[info.category][info.type] = info.defaultColor;
        });
        return defaults;
    }

    private static _buildTypeInfo(): TypeInfo[] {
        const definitions = this.getTypeDefinitions();
        const items: TypeInfo[] = [];
        for (const [category, defs] of Object.entries(definitions)) {
            defs.forEach((def: TypeDefinition) => {
                items.push({
                    category: category as 'node' | 'edge',
                    type: def.type,
                    defaultEnabled: def.defaultEnabled !== undefined ? !!def.defaultEnabled : true,
                    defaultColor: def.defaultColor,
                    filterKey: this._buildControlKey('show', def.type),
                    colorKey: this._buildControlKey('color', def.type)
                });
            });
        }
        return items;
    }

    private static _buildControlKey(prefix: string, type: string): string {
        return `${prefix}${type}`;
    }
}

export default BaseAnalyzer;
