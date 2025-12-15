/**
 * Validates graph data structure
 * @param {Object} data - Graph data with nodes and links
 */
function validateGraphData(data) {
    if (!data || typeof data !== 'object') throw new Error('data must be an object');
    if (!Array.isArray(data.nodes)) throw new Error('data.nodes must be an array');
    if (!Array.isArray(data.links)) throw new Error('data.links must be an array');
}

/**
 * Message creators for webview communication
 */
const messageCreators = {
    update: (payload) => {
        if (!payload || typeof payload !== 'object') {
            throw new Error('update: payload must be an object');
        }
        const { controls, data, stackTracePaths = [] } = payload;
        if (!controls || typeof controls !== 'object') {
            throw new Error('update: controls must be provided');
        }
        validateGraphData(data);
        return {
            type: 'update',
            controls,
            data,
            stackTracePaths: Array.isArray(stackTracePaths) ? stackTracePaths : []
        };
    },

    focusNodeById: (nodeId) => {
        if (nodeId === undefined || nodeId === null) {
            throw new Error('focusNodeById: nodeId is required');
        }
        return { type: 'focusNodeById', nodeId };
    },

    toggle3DMode: () => {
        return { type: 'toggle3DMode' };
    },

    stackTrace: (paths) => {
        if (!Array.isArray(paths)) {
            throw new Error('stackTrace: paths must be an array');
        }
        return { type: 'stackTrace', paths };
    }
};

/**
 * Bridge for sending messages from VSCode Extension to Webview
 * Handles message queueing and webview ready state
 */
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

    send(type, ...args) {
        const creator = messageCreators[type];
        if (!creator) {
            throw new Error(`Unknown message type: ${type}`);
        }
        this._dispatch(creator(...args));
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

module.exports = { WebviewBridge, messageCreators };
