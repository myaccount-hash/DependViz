const DEFAULT_CONTROLS = {
    search: '',
    nodeSizeByLoc: false,
    hideIsolatedNodes: false,
    showStackTrace: false,
    showNames: false,
    shortNames: false,
    nodeSize: 1.0,
    linkWidth: 1.0,
    nodeOpacity: 1.0,
    edgeOpacity: 1.0,
    linkDistance: 30,
    arrowSize: 5,
    focusDistance: 80,
    nameFontSize: 12,
    autoRotate: false,
    rotateSpeed: 0.1,
    sliceDepth: 3,
    enableForwardSlice: false,
    enableBackwardSlice: false,
    showClass: true,
    showAbstractClass: true,
    showInterface: true,
    showUnknown: true,
    showObjectCreate: true,
    showExtends: true,
    showImplements: true,
    showTypeUse: true,
    showMethodCall: true,
    colorClass: '#3b82f6',
    colorAbstractClass: '#a21caf',
    colorInterface: '#10b981',
    colorUnknown: '#6b7280',
    colorObjectCreate: '#facc15',
    colorExtends: '#a21caf',
    colorImplements: '#10b981',
    colorTypeUse: '#fb923c',
    colorMethodCall: '#fb923c'
};

const CDN_LIBS = {
    threeUri: 'https://esm.sh/three@0.177.0',
    fgUri: 'https://esm.sh/3d-force-graph@1.77.0',
    spriteUri: 'https://esm.sh/three-spritetext@1.10.0'
};


const COLORS = {
    STACK_TRACE: '#ff0000',
    STACK_TRACE_LINK: '#00ff00',
    BACKGROUND_DARK: '#000000',
    BACKGROUND_LIGHT: '#ffffff',
    NODE_DEFAULT: '#f59e42',
    EDGE_DEFAULT: '#6b7280'
};

const ICONS = {
    CAPTURED_SESSION: 'pass-filled',
    ACTIVE_SESSION: 'debug-alt',
    EMPTY_STATE: 'info',
    GRAPH_FILE: 'graph'
};

const SLIDER_RANGES = {
    rotateSpeed: { min: 0.01, max: 5, step: 0.1 },
    nodeSize: { min: 0.1, max: 5, step: 0.1 },
    linkWidth: { min: 0.1, max: 5, step: 0.1 },
    opacity: { min: 0.1, max: 1, step: 0.1 },
    linkDistance: { min: 10, max: 100, step: 5 },
    arrowSize: { min: 1, max: 20, step: 1 },
    sliceDepth: { min: 1, max: 10, step: 1 }
};

const DEBUG = {
    STACK_TRACE_LEVELS: 50,
    AUTO_ROTATE_DELAY: 1000
};

module.exports = { DEFAULT_CONTROLS, CDN_LIBS, COLORS, ICONS, SLIDER_RANGES, DEBUG };
