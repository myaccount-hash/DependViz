class BaseAnalyzer {
    constructor() {
        this.analyzerId = this.constructor.analyzerId;
    }

    static get analyzerId() {
        throw new Error('analyzerId must be implemented');
    }

    static get displayName() {
        return this.analyzerId;
    }

    static getTypeDefinitions() {
        return {
            node: [],
            edge: []
        };
    }

    static getTypeInfo() {
        if (!this._typeInfo) {
            this._typeInfo = this._buildTypeInfo();
        }
        return this._typeInfo.map(info => ({ ...info }));
    }

    static getTypeDefaults() {
        if (!this._typeDefaults) {
            if (!this._typeInfo) {
                this._typeInfo = this._buildTypeInfo();
            }
            this._typeDefaults = this._buildTypeDefaults();
        }
        return JSON.parse(JSON.stringify(this._typeDefaults));
    }

    static _buildTypeDefaults() {
        const defaults = { filters: { node: {}, edge: {} }, colors: { node: {}, edge: {} } };
        this._typeInfo.forEach(info => {
            defaults.filters[info.category][info.type] = info.defaultEnabled !== undefined ? !!info.defaultEnabled : true;
            defaults.colors[info.category][info.type] = info.defaultColor;
        });
        return defaults;
    }

    static _buildTypeInfo() {
        const definitions = this.getTypeDefinitions();
        const items = [];
        for (const [category, defs] of Object.entries(definitions)) {
            defs.forEach((def) => {
                items.push({
                    category,
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

    static _buildControlKey(prefix, type) {
        return `${prefix}${type}`;
    }
}

module.exports = BaseAnalyzer;
