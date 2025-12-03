const { validateGraphData } = require('../utils/utils');

/**
 * Analyzer から返却される JSON を正規化。
 * @param {string|Object} response
 * @returns {{ nodes: Array, links: Array }}
 */
function normalizeAnalyzerResponse(response) {
  let data = response;
  if (typeof response === 'string') {
    data = JSON.parse(response);
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Analyzer response must be an object');
  }

  validateGraphData(data);
  return {
    nodes: Array.isArray(data.nodes) ? data.nodes : [],
    links: Array.isArray(data.links) ? data.links : []
  };
}

module.exports = { normalizeAnalyzerResponse };
