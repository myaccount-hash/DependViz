const FILE_PATHS = {
   JAR_FILE: 'java-graph.jar',
   DATA_DIR: 'data',
   TEMP_OUTPUT: 'sample.json',
   GRAPH_OUTPUT: 'graph.json'
};

const TYPE_CONTROL_MAP = {
   node: {
      'Class': 'showClass',
      'AbstractClass': 'showAbstractClass',
      'Interface': 'showInterface',
      'Unknown': 'showUnknown'
   },
   edge: {
      'ObjectCreate': 'showObjectCreate',
      'Extends': 'showExtends',
      'Implements': 'showImplements',
      'TypeUse': 'showTypeUse',
      'MethodCall': 'showMethodCall'
   }
};

module.exports = {
   ...FILE_PATHS,
   TYPE_CONTROL_MAP
};

