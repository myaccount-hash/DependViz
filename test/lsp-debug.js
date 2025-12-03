#!/usr/bin/env node

/**
 * Simple standalone client that speaks LSP with the DependViz Java server.
 * Useful for debugging server crashes without launching the VS Code extension.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const {
    StreamMessageReader,
    StreamMessageWriter,
    createMessageConnection
} = require('vscode-jsonrpc/node');

const workspaceRoot = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const repoRoot = path.resolve(__dirname, '..');
const jarPath = path.join(repoRoot, 'java-graph.jar');
const loggingConfig = path.join(repoRoot, 'logging.properties');

if (!fs.existsSync(jarPath)) {
    console.error(`[DependViz LSP Debug] Missing ${jarPath}. Run "npm run build:java" first.`);
    process.exit(1);
}

if (!fs.existsSync(loggingConfig)) {
    console.warn(`[DependViz LSP Debug] logging.properties not found at ${loggingConfig}`);
}

console.log(`[DependViz LSP Debug] workspace: ${workspaceRoot}`);
console.log(`[DependViz LSP Debug] jar: ${jarPath}`);

const serverProcess = spawn('java', [
    `-Djava.util.logging.config.file=${loggingConfig}`,
    '-jar',
    jarPath
], {
    cwd: workspaceRoot,
    stdio: ['pipe', 'pipe', 'pipe']
});

serverProcess.stderr.on('data', (data) => {
    process.stderr.write(`[server stderr] ${data}`);
});

serverProcess.on('exit', (code, signal) => {
    console.log(`[DependViz LSP Debug] server exited with code ${code} signal ${signal ?? 'none'}`);
});

serverProcess.on('error', (error) => {
    console.error('[DependViz LSP Debug] failed to spawn server process:', error);
});

const connection = createMessageConnection(
    new StreamMessageReader(serverProcess.stdout),
    new StreamMessageWriter(serverProcess.stdin),
    {
        error: (msg) => console.error('[client error]', msg),
        warn: (msg) => console.warn('[client warn]', msg),
        info: (msg) => console.info('[client info]', msg),
        log: (msg) => console.log('[client log]', msg)
    }
);

connection.onNotification('window/logMessage', (params) => {
    console.log(`[server log] ${params.type}: ${params.message}`);
});

connection.listen();

async function run() {
    const rootUri = pathToFileURL(workspaceRoot).toString();
    try {
        const initializeResult = await connection.sendRequest('initialize', {
            processId: process.pid,
            clientInfo: { name: 'DependViz LSP Debug Client', version: '1.0.0' },
            rootUri,
            capabilities: {},
            workspaceFolders: [{ uri: rootUri, name: path.basename(workspaceRoot) }]
        });

        console.log('[DependViz LSP Debug] initialize result:', initializeResult);

        connection.sendNotification('initialized', {});

        // Try issuing custom requests to verify they succeed.
        const graph = await connection.sendRequest('dependviz/getDependencyGraph');
        try {
            const parsed = JSON.parse(graph);
            console.log('[DependViz LSP Debug] dependency graph nodes:', parsed.nodes?.length || 0);
            console.log('[DependViz LSP Debug] dependency graph links:', parsed.links?.length || 0);
        } catch (parseError) {
            console.warn('[DependViz LSP Debug] failed to parse graph response:', parseError);
            console.log(graph);
        }

        // Clean shutdown
        await connection.sendRequest('shutdown');
        connection.sendNotification('exit');
    } catch (error) {
        console.error('[DependViz LSP Debug] client error:', error);
    } finally {
        connection.dispose();
        serverProcess.kill();
    }
}

run();
