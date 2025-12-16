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
    'graph:update': payload => {
        if (!payload || typeof payload !== 'object') {
            throw new Error('graph:update: payload must be an object');
        }
        const { controls, data, stackTracePaths = [], dataVersion } = payload;
        if (!controls || typeof controls !== 'object') {
            throw new Error('graph:update: controls must be provided');
        }
        validateGraphData(data);
        const message = {
            type: 'graph:update',
            payload: {
                controls,
                data,
                stackTracePaths: Array.isArray(stackTracePaths) ? stackTracePaths : []
            }
        };
        if (typeof dataVersion === 'number') {
            message.payload.dataVersion = dataVersion;
        }
        return message;
    },

    'view:update': payload => {
        const validPayload = payload && typeof payload === 'object' ? payload : null;
        if (!validPayload) {
            throw new Error('view:update: payload must be an object');
        }
        const message = { type: 'view:update', payload: {} };

        if (validPayload.controls && typeof validPayload.controls === 'object') {
            message.payload.controls = validPayload.controls;
        }
        if (Array.isArray(validPayload.stackTracePaths)) {
            message.payload.stackTracePaths = validPayload.stackTracePaths;
        }
        return message;
    },

    'node:focus': nodeId => {
        if (nodeId === undefined || nodeId === null) {
            throw new Error('node:focus: nodeId is required');
        }
        return { type: 'node:focus', payload: { nodeId } };
    },

    'mode:toggle': () => {
        return { type: 'mode:toggle', payload: {} };
    },

    'focus:clear': () => {
        return { type: 'focus:clear', payload: {} };
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

    send(type, payload) {
        const creator = messageCreators[type];
        if (!creator) {
            throw new Error(`Unknown message type: ${type}`);
        }
        this._dispatch(creator(payload));
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
