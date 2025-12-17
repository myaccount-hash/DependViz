const JavaAnalyzer = require('./JavaAnalyzer');
const JavaScriptAnalyzer = require('./JavaScriptAnalyzer');

const REGISTERED_ANALYZERS = [JavaAnalyzer, JavaScriptAnalyzer];

function getAnalyzerClassById(analyzerId) {
    return REGISTERED_ANALYZERS.find(analyzer => analyzer.analyzerId === analyzerId) || REGISTERED_ANALYZERS[0];
}

function getAnalyzerOptions() {
    return REGISTERED_ANALYZERS.map(analyzer => ({
        id: analyzer.analyzerId,
        label: analyzer.displayName
    }));
}

function getDefaultAnalyzerId() {
    const analyzer = REGISTERED_ANALYZERS[0];
    return analyzer ? analyzer.analyzerId : 'default';
}

module.exports = {
    getAnalyzerClassById,
    getAnalyzerOptions,
    getDefaultAnalyzerId
};
