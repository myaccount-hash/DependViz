# DependViz

![DependViz](images/DependViz.png)

DependViz is a VS Code extension that visualizes Java project dependencies using 3d-force-graph.

## Features

- Visualize Java project code dependencies in 3D graph
- Display relationships including classes, interfaces, and method calls
- Interactive graph operations (zoom, rotate, filtering)

## Requirements

- Node.js
- Java 21 or higher
- Maven 3.6 or higher

## Setup
Install dependencies
```bash
# Using brew
brew install node
brew install java
```
Install the extension from [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=myaccount-hash.vscode-force-graph-viewer)

## Usage

- Open a Java project
- Open Command Palette (Cmd+Shift+P / Ctrl+Shift+P)
- Execute "DependViz: Analyze Java Project"
	- By default, searches and analyzes Java source files from the workspace root.
- Execute "DependViz: Focus on Graph View"
- Click Refresh at the top right if the graph view is empty

### LSP Debug Session

To debug only the Java Language Server without launching VS Code, run:

```bash
npm run debug:lsp -- /path/to/java/project
```

The script launches `java-graph.jar`, performs an `initialize` handshake, and issues DependViz custom requests so you can inspect server logs and crashes directly from the terminal.

## Stack Trace Feature

When a VS Code debug session is active and stack trace mode is enabled, links between nodes are displayed based on the current stack trace, visualizing the execution path during debugging.

## Slicing Feature

When a node is focused, displays only dependencies related to that node. Forward slice shows dependencies going out from the selected node, backward slice shows dependencies coming into the selected node. When enabled in settings, slicing is automatically calculated on node focus.

## Settings

### Search & Filter

- `forceGraphViewer.search`: Search keyword
- `forceGraphViewer.hideIsolatedNodes`: Hide isolated nodes

### Display Mode

- `forceGraphViewer.darkMode`: Dark mode
- `forceGraphViewer.showNames`: Show names
- `forceGraphViewer.shortNames`: Show short names
- `forceGraphViewer.showStackTrace`: Show stack trace
- `forceGraphViewer.autoRotate`: Auto rotation
- `forceGraphViewer.rotateSpeed`: Rotation speed (range: 0.01-5.0)

### Node Display

- `forceGraphViewer.nodeSize`: Node size (range: 0.1-5.0)
- `forceGraphViewer.nodeSizeByLoc`: Determine node size by LOC
- `forceGraphViewer.nodeOpacity`: Node opacity (range: 0.1-1.0)
- `forceGraphViewer.nameFontSize`: Name font size (range: 6-32)

### Edge Display

- `forceGraphViewer.linkWidth`: Link width (range: 0.1-5.0)
- `forceGraphViewer.edgeOpacity`: Edge opacity (range: 0.1-1.0)
- `forceGraphViewer.linkDistance`: Link distance (range: 10-100)
- `forceGraphViewer.arrowSize`: Arrow size (range: 1-20)

### Node Type Filter

- `forceGraphViewer.showClass`: Show classes
- `forceGraphViewer.showAbstractClass`: Show abstract classes
- `forceGraphViewer.showInterface`: Show interfaces
- `forceGraphViewer.showUnknown`: Show unknown types

### Edge Type Filter

- `forceGraphViewer.showObjectCreate`: Show object creation edges
- `forceGraphViewer.showExtends`: Show inheritance edges
- `forceGraphViewer.showImplements`: Show implementation edges
- `forceGraphViewer.showTypeUse`: Show type usage edges
- `forceGraphViewer.showMethodCall`: Show method call edges

### Color Settings

- `forceGraphViewer.colorClass`: Class color
- `forceGraphViewer.colorAbstractClass`: Abstract class color
- `forceGraphViewer.colorInterface`: Interface color
- `forceGraphViewer.colorUnknown`: Unknown type color
- `forceGraphViewer.colorObjectCreate`: Object creation edge color
- `forceGraphViewer.colorExtends`: Inheritance edge color
- `forceGraphViewer.colorImplements`: Implementation edge color
- `forceGraphViewer.colorTypeUse`: Type usage edge color
- `forceGraphViewer.colorMethodCall`: Method call edge color

### Slice Feature

- `forceGraphViewer.sliceDepth`: Slice depth (range: 1-10)
- `forceGraphViewer.enableForwardSlice`: Enable forward slice
- `forceGraphViewer.enableBackwardSlice`: Enable backward slice

### Other

- `forceGraphViewer.focusDistance`: Camera distance on focus (range: 20-300)

## Build
```bash
npm install
npm run build
```

## License

MIT License
