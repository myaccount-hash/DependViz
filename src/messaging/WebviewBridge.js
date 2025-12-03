const { validateGraphData } = require('../utils/utils');

/**
 * @typedef {Object} GraphNode
 * @property {string|number} id
 * @property {string} [name]
 * @property {string} [type]
 * @property {string} [filePath]
 */

/**
 * @typedef {Object} GraphLink
 * @property {string|number|GraphNode} source
 * @property {string|number|GraphNode} target
 * @property {string} type
 */

/**
 * @typedef {Object} GraphData
 * @property {GraphNode[]} nodes
 * @property {GraphLink[]} links
 */

/**
 * 共有の webview メッセージ型。必要になったら追加する。
 * @typedef {(
 *  { type: 'update', controls: object, data: GraphData, stackTracePaths: Array } |
 *  { type: 'focusNodeById', nodeId: string|number }
 * )} WebviewMessage
 */

function createUpdateMessage(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('createUpdateMessage: payload must be an object');
  }
  const { controls, data, stackTracePaths = [] } = payload;
  if (!controls || typeof controls !== 'object') {
    throw new Error('createUpdateMessage: controls must be provided');
  }
  validateGraphData(data);
  return {
    type: 'update',
    controls,
    data,
    stackTracePaths: Array.isArray(stackTracePaths) ? stackTracePaths : []
  };
}

function createFocusNodeByIdMessage(nodeId) {
  if (nodeId === undefined || nodeId === null) {
    throw new Error('createFocusNodeByIdMessage: nodeId is required');
  }
  return { type: 'focusNodeById', nodeId };
}

class WebviewBridge {
  constructor() {
    this._webview = null;
    this._ready = false;
    this._queue = [];
  }

  attach(webview) {
    this._webview = webview;
    this._ready = false;
    this._queue = [];
  }

  detach() {
    this._webview = null;
    this._ready = false;
    this._queue = [];
  }

  markReady() {
    this._ready = true;
    this._flush();
  }

  sendUpdate(payload) {
    this._dispatch(createUpdateMessage(payload));
  }

  sendFocusNodeById(nodeId) {
    this._dispatch(createFocusNodeByIdMessage(nodeId));
  }

  _dispatch(message) {
    if (!message || typeof message.type !== 'string') {
      throw new Error('Invalid webview message payload');
    }
    if (!this._webview) {
      return false;
    }
    if (this._ready) {
      this._webview.postMessage(message);
      return true;
    }
    this._queue.push(message);
    return false;
  }

  _flush() {
    if (!this._webview || !this._ready) return;
    while (this._queue.length > 0) {
      const message = this._queue.shift();
      this._webview.postMessage(message);
    }
  }
}

module.exports = {
  WebviewBridge,
  createUpdateMessage,
  createFocusNodeByIdMessage
};
