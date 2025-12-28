const JavaAnalyzer = require('./JavaAnalyzer');
const JavaScriptAnalyzer = require('./JavaScriptAnalyzer');

const REGISTERED_ANALYZERS = [JavaAnalyzer, JavaScriptAnalyzer];

class AnalyzerContext {
    constructor(context, configManager) {
        this._configManager = configManager;
        const map = {};
        REGISTERED_ANALYZERS.forEach((Analyzer) => {
            const analyzer = new Analyzer(context);
            map[Analyzer.analyzerId] = analyzer;
        });
        this._analyzers = map;
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
        const analyzerId = controls.analyzerId || AnalyzerContext.getDefaultAnalyzerId();
        return this._analyzers[analyzerId] || this._analyzers[AnalyzerContext.getDefaultAnalyzerId()];
    }

    getActiveAnalyzerId() {
        const controls = this._configManager.loadControls();
        return controls.analyzerId || AnalyzerContext.getDefaultAnalyzerId();
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

    dispose() {
        return this.stopAll();
    }
}

module.exports = AnalyzerContext;
