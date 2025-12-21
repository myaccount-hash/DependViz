"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyzerManager = void 0;
const JavaAnalyzer_1 = require("./analyzers/JavaAnalyzer");
const JavaScriptAnalyzer_1 = require("./analyzers/JavaScriptAnalyzer");
const REGISTERED_ANALYZERS = [JavaAnalyzer_1.JavaAnalyzer, JavaScriptAnalyzer_1.JavaScriptAnalyzer];
class AnalyzerManager {
    constructor(context, configManager) {
        this._configManager = configManager;
        this._analyzers = this._createAnalyzers(context, REGISTERED_ANALYZERS);
    }
    _createAnalyzers(context, list) {
        const map = {};
        list.forEach((AnalyzerConstructor) => {
            const analyzer = new AnalyzerConstructor(context);
            map[AnalyzerConstructor.analyzerId] = analyzer;
        });
        return map;
    }
    static getAnalyzerClassById(analyzerId) {
        return REGISTERED_ANALYZERS.find(analyzer => analyzer.analyzerId === analyzerId) || REGISTERED_ANALYZERS[0];
    }
    static getAnalyzerOptions() {
        return REGISTERED_ANALYZERS.map(analyzer => ({
            id: analyzer.analyzerId,
            label: analyzer.displayName
        }));
    }
    static getDefaultAnalyzerId() {
        const analyzer = REGISTERED_ANALYZERS[0];
        return analyzer ? analyzer.analyzerId : 'default';
    }
    getActiveAnalyzer() {
        const controls = this._configManager.loadControls();
        const analyzerId = controls.analyzerId || AnalyzerManager.getDefaultAnalyzerId();
        return this._analyzers[analyzerId] || this._analyzers[AnalyzerManager.getDefaultAnalyzerId()];
    }
    getActiveAnalyzerId() {
        const controls = this._configManager.loadControls();
        return controls.analyzerId || AnalyzerManager.getDefaultAnalyzerId();
    }
    getActiveAnalyzerName() {
        const analyzer = this.getActiveAnalyzer();
        return this.getAnalyzerName(analyzer);
    }
    getAnalyzerName(analyzer) {
        return analyzer?.constructor?.displayName || analyzer?.constructor?.name || 'Analyzer';
    }
    isFileSupported(filePath) {
        const analyzer = this.getActiveAnalyzer();
        if (!analyzer || typeof analyzer.isFileSupported !== 'function') {
            return true;
        }
        return analyzer.isFileSupported(filePath);
    }
    async analyzeProject() {
        const analyzer = this.getActiveAnalyzer();
        if (!analyzer || typeof analyzer.analyze !== 'function') {
            return null;
        }
        return analyzer.analyze();
    }
    async analyzeFile(filePath) {
        const analyzer = this.getActiveAnalyzer();
        if (!analyzer || typeof analyzer.analyzeFile !== 'function') {
            return null;
        }
        return analyzer.analyzeFile(filePath);
    }
    async stopAll() {
        const analyzers = Object.values(this._analyzers);
        for (const analyzer of analyzers) {
            if (typeof analyzer.stop === 'function') {
                await analyzer.stop();
            }
        }
    }
}
exports.AnalyzerManager = AnalyzerManager;
//# sourceMappingURL=AnalyzerManager.js.map