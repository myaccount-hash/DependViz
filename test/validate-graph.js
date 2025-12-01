#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const graphPath = process.argv[2] || path.join(__dirname, 'graph.json');

if (!fs.existsSync(graphPath)) {
    console.error(`Error: File not found: ${graphPath}`);
    process.exit(1);
}

console.log(`=== Validating ${graphPath} ===\n`);

try {
    const data = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));

    // 基本統計
    console.log('=== Basic Statistics ===');
    console.log(`Nodes: ${data.nodes?.length || 0}`);
    console.log(`Links: ${data.links?.length || 0}`);
    console.log();

    // ノードの種類別集計
    console.log('=== Node Types ===');
    const nodeTypes = {};
    (data.nodes || []).forEach(node => {
        const type = node.type || 'Unknown';
        nodeTypes[type] = (nodeTypes[type] || 0) + 1;
    });
    Object.entries(nodeTypes).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
    });
    console.log();

    // エッジの種類別集計
    console.log('=== Link Types ===');
    const linkTypes = {};
    (data.links || []).forEach(link => {
        const type = link.type || 'Unknown';
        linkTypes[type] = (linkTypes[type] || 0) + 1;
    });
    Object.entries(linkTypes).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
    });
    console.log();

    // MethodCallのエッジを詳細表示
    console.log('=== MethodCall Edges (first 10) ===');
    const methodCalls = (data.links || []).filter(link => link.type === 'MethodCall');
    methodCalls.slice(0, 10).forEach((link, i) => {
        const sourceNode = data.nodes.find(n => n.id === link.source);
        const targetNode = data.nodes.find(n => n.id === link.target);
        console.log(`  ${i + 1}. ${sourceNode?.id || link.source} -> ${targetNode?.id || link.target}`);
    });
    if (methodCalls.length > 10) {
        console.log(`  ... and ${methodCalls.length - 10} more`);
    }
    if (methodCalls.length === 0) {
        console.log('  No MethodCall edges found!');
    }
    console.log();

    // 静的メソッド呼び出しの可能性があるパターンを検索
    console.log('=== Static Method Call Analysis ===');
    const utilityClassCalls = methodCalls.filter(link => {
        const target = data.nodes.find(n => n.id === link.target);
        return target?.id.includes('UtilityClass') || target?.id.includes('Math') || target?.id.includes('String');
    });
    console.log(`UtilityClass/Math/String calls: ${utilityClassCalls.length}`);
    utilityClassCalls.slice(0, 5).forEach((link, i) => {
        const sourceNode = data.nodes.find(n => n.id === link.source);
        const targetNode = data.nodes.find(n => n.id === link.target);
        console.log(`  ${i + 1}. ${sourceNode?.id || link.source} -> ${targetNode?.id || link.target}`);
    });
    console.log();

    // ノード一覧
    console.log('=== All Nodes ===');
    (data.nodes || []).forEach((node, i) => {
        console.log(`  ${i + 1}. [${node.type || 'Unknown'}] ${node.id} (${node.filePath || 'no path'})`);
    });
    console.log();

    console.log('✓ Validation completed successfully');

} catch (error) {
    console.error(`Error: Failed to parse or validate graph: ${error.message}`);
    process.exit(1);
}
