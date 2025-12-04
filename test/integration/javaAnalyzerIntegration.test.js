const { expect } = require('chai');
const path = require('path');
const vscode = require('vscode');

describe('JavaAnalyzer Integration - Graph Node Count', function() {
    // 統合テストは時間がかかるのでタイムアウトを長めに設定
    this.timeout(60000);

    const sampleProjectPath = path.join(__dirname, '../sample');

    it('should discover exactly 29 nodes in the generated graph', async () => {
        // DependViz拡張機能を取得
        const extension = vscode.extensions.getExtension('myaccount-hash.vscode-force-graph-viewer');
        expect(extension).to.exist;

        if (!extension.isActive) {
            await extension.activate();
        }

        // test/sampleフォルダをワークスペースとして開く
        const sampleUri = vscode.Uri.file(sampleProjectPath);

        // コマンドを実行してグラフを生成
        await vscode.commands.executeCommand('forceGraphViewer.analyzeWorkspace');

        // グラフデータを取得（拡張機能のAPIを使用）
        const graphViewProvider = extension.exports?.graphViewProvider;
        expect(graphViewProvider).to.exist;

        const graphData = graphViewProvider._currentData;
        expect(graphData).to.exist;
        expect(graphData.nodes).to.be.an('array');

        // ノード数の確認
        expect(graphData.nodes.length).to.equal(29,
            `Expected 29 nodes but found ${graphData.nodes.length}`);

        // 期待されるクラス名のリスト
        const expectedClasses = [
            'com.example.Main',
            'com.example.utils.Utils',
            'com.example.sessions.Session',
            'com.example.sessions.MainSession',
            'com.example.sessions.BattleSession',
            'com.example.sessions.BattleCommandSelectionSession',
            'com.example.sessions.ItemCommandSession',
            'com.example.sessions.PlayerItemListSession',
            'com.example.sessions.ShopSession',
            'com.example.commands.Command',
            'com.example.commands.QuitCommand',
            'com.example.commands.NormalAttack',
            'com.example.commands.Magic',
            'com.example.commands.FireBall',
            'com.example.commands.HpHeal',
            'com.example.items.Item',
            'com.example.items.Weapon',
            'com.example.items.Armor',
            'com.example.items.BronzeSword',
            'com.example.items.IronSword',
            'com.example.items.DragonSword',
            'com.example.items.LeatherArmor',
            'com.example.items.IronArmor',
            'com.example.items.HealPotion',
            'com.example.entities.Entity',
            'com.example.entities.Player',
            'com.example.entities.Monster',
            'com.example.entities.Dragon',
            'com.example.entities.ItemBox'
        ];

        // 全ての期待されるクラスが存在することを確認
        const foundClassNames = graphData.nodes.map(node => node.name);
        for (const expectedClass of expectedClasses) {
            expect(foundClassNames).to.include(expectedClass,
                `Class ${expectedClass} was not found in graph nodes`);
        }

        // 逆に、予期しないノードがないことも確認
        for (const foundClass of foundClassNames) {
            expect(expectedClasses).to.include(foundClass,
                `Unexpected class ${foundClass} found in graph nodes`);
        }
    });

    it('should have correct node types in the graph', async () => {
        const extension = vscode.extensions.getExtension('myaccount-hash.vscode-force-graph-viewer');
        const graphViewProvider = extension.exports?.graphViewProvider;
        const graphData = graphViewProvider._currentData;

        // 抽象クラスの確認
        const abstractClasses = graphData.nodes.filter(node => node.type === 'AbstractClass');
        const abstractClassNames = abstractClasses.map(n => n.name);

        const expectedAbstractClasses = [
            'com.example.sessions.Session',
            'com.example.commands.Command',
            'com.example.commands.Magic',
            'com.example.items.Item',
            'com.example.items.Weapon',
            'com.example.items.Armor',
            'com.example.entities.Entity'
        ];

        expect(abstractClasses.length).to.equal(expectedAbstractClasses.length,
            'Number of abstract classes should match');

        for (const abstractClass of expectedAbstractClasses) {
            expect(abstractClassNames).to.include(abstractClass,
                `${abstractClass} should be identified as AbstractClass`);
        }
    });

    it('should have correct inheritance relationships in the graph', async () => {
        const extension = vscode.extensions.getExtension('myaccount-hash.vscode-force-graph-viewer');
        const graphViewProvider = extension.exports?.graphViewProvider;
        const graphData = graphViewProvider._currentData;

        expect(graphData.links).to.be.an('array');

        // Extendsリンクを確認
        const extendsLinks = graphData.links.filter(link => link.type === 'Extends');

        // 少なくとも23個の継承関係があるはず
        expect(extendsLinks.length).to.be.at.least(23,
            'Should have at least 23 inheritance relationships');

        // いくつかの主要な継承関係を確認
        const keyInheritances = [
            { child: 'com.example.sessions.MainSession', parent: 'com.example.sessions.Session' },
            { child: 'com.example.commands.FireBall', parent: 'com.example.commands.Magic' },
            { child: 'com.example.entities.Dragon', parent: 'com.example.entities.Monster' },
            { child: 'com.example.items.IronSword', parent: 'com.example.items.Weapon' }
        ];

        for (const expected of keyInheritances) {
            const found = extendsLinks.some(link =>
                link.source === expected.child && link.target === expected.parent
            );
            expect(found).to.be.true(
                `Expected inheritance: ${expected.child} extends ${expected.parent}`
            );
        }
    });
});
