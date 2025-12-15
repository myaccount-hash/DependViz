const DEFAULT_CONTROLS = {
    search: '',
    is3DMode: false,
    nodeSizeByLoc: false,
    hideIsolatedNodes: false,
    showStackTrace: true,
    showNames: true,
    shortNames: true,
    autoRotate: false,
    rotateSpeed: 0.3,
    nameFontSize: 12,
    focusDistance: 200,
    nodeSize: 3.0,
    linkWidth: 0.5,
    nodeOpacity: 1.0,
    edgeOpacity: 0.6,
    linkDistance: 50,
    arrowSize: 3,
    textSize: 12,
    sliceDepth: 3,
    enableForwardSlice: true,
    enableBackwardSlice: true,
    showClass: true,
    showAbstractClass: true,
    showInterface: true,
    showUnknown: true,
    showObjectCreate: true,
    showExtends: true,
    showImplements: true,
    showTypeUse: true,
    showMethodCall: true,
    colorClass: '#93c5fd',
    colorAbstractClass: '#d8b4fe',
    colorInterface: '#6ee7b7',
    colorUnknown: '#9ca3af',
    colorObjectCreate: '#fde047',
    colorExtends: '#d8b4fe',
    colorImplements: '#6ee7b7',
    colorTypeUse: '#fdba74',
    colorMethodCall: '#fda4af'
};

const CDN_LIBS = {
    fgUri: 'https://esm.sh/force-graph@1.44.0',
    fg3dUri: 'https://esm.sh/3d-force-graph@1.73.6'
};


const COLORS = {
    STACK_TRACE_LINK: '#51cf66',
    BACKGROUND_DARK: '#1a1a1a',
    NODE_DEFAULT: '#93c5fd',
    EDGE_DEFAULT: '#4b5563'
};

const ICONS = {
    CAPTURED_SESSION: 'pass-filled',
    ACTIVE_SESSION: 'debug-alt',
    EMPTY_STATE: 'info',
    GRAPH_FILE: 'graph'
};

const SLIDER_RANGES = {
    nodeSize: { min: 0.1, max: 20, step: 0.1 },
    linkWidth: { min: 0.1, max: 5, step: 0.1 },
    opacity: { min: 0.1, max: 1, step: 0.1 },
    linkDistance: { min: 10, max: 200, step: 5 },
    arrowSize: { min: 1, max: 20, step: 1 },
    textSize: { min: 8, max: 24, step: 1 },
    sliceDepth: { min: 1, max: 10, step: 1 }
};

const AUTO_ROTATE_DELAY = 1000;

module.exports = { DEFAULT_CONTROLS, CDN_LIBS, COLORS, ICONS, SLIDER_RANGES, AUTO_ROTATE_DELAY };
