const JavaAnalyzer = require('./analyzers/JavaAnalyzer');
const JavaScriptAnalyzer = require('./analyzers/JavaScriptAnalyzer');

const REGISTERED_ANALYZERS = [JavaAnalyzer, JavaScriptAnalyzer];

class AnalyzerManager {
    constructor(context, configManager) {
        this._configManager = configManager;
        this._analyzers = this._createAnalyzers(context);
    }

    _createAnalyzers(context) {
        const javaAnalyzer = new JavaAnalyzer(context);
        const javascriptAnalyzer = new JavaScriptAnalyzer();
        return {
            [JavaAnalyzer.analyzerId]: javaAnalyzer,
            [JavaScriptAnalyzer.analyzerId]: javascriptAnalyzer
        };
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

    getAnalyzerName(analyzer) {
        return analyzer?.constructor?.displayName || analyzer?.constructor?.name || 'Analyzer';
    }

    isFileSupported(analyzer, filePath) {
        if (!analyzer || typeof analyzer.isFileSupported !== 'function') {
            return true;
        }
        return analyzer.isFileSupported(filePath);
    }

    async stopAll() {
        const analyzers = Object.values(this._analyzers);
        for (const analyzer of analyzers) {
            if (typeof analyzer.stopLanguageClient === 'function') {
                await analyzer.stopLanguageClient();
            }
        }
    }
}

module.exports = AnalyzerManager;
