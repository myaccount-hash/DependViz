const { expect } = require('chai');
const path = require('path');
const fs = require('fs').promises;

describe('JavaAnalyzer - Class Discovery', () => {
    const sampleProjectPath = path.join(__dirname, '../sample');
    const EXPECTED_NODE_COUNT = 29;

    // ヘルパー関数
    async function findJavaFiles(dir) {
        const files = [];
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files.push(...await findJavaFiles(fullPath));
            } else if (entry.name.endsWith('.java')) {
                files.push(fullPath);
            }
        }

        return files;
    }

    async function findFileByName(dir, fileName) {
        const files = await findJavaFiles(dir);
        return files.find(f => path.basename(f) === fileName) || null;
    }

    describe('Java file enumeration in test/sample', () => {
        it(`should have exactly ${EXPECTED_NODE_COUNT} Java files (expected graph nodes)`, async () => {
            const javaFiles = await findJavaFiles(sampleProjectPath);
            expect(javaFiles).to.have.lengthOf(EXPECTED_NODE_COUNT,
                `JavaAnalyzer should discover ${EXPECTED_NODE_COUNT} nodes when analyzing test/sample`);

            // 期待されるファイルのリスト
            const expectedFiles = [
                'Main.java', 'Utils.java',
                'Session.java', 'MainSession.java', 'BattleSession.java',
                'BattleCommandSelectionSession.java', 'ItemCommandSession.java',
                'PlayerItemListSession.java', 'ShopSession.java',
                'Command.java', 'QuitCommand.java', 'NormalAttack.java',
                'Magic.java', 'FireBall.java', 'HpHeal.java',
                'Item.java', 'Weapon.java', 'Armor.java',
                'BronzeSword.java', 'IronSword.java', 'DragonSword.java',
                'LeatherArmor.java', 'IronArmor.java', 'HealPotion.java',
                'Entity.java', 'Player.java', 'Monster.java',
                'Dragon.java', 'ItemBox.java'
            ];

            const fileNames = javaFiles.map(f => path.basename(f));
            for (const expectedFile of expectedFiles) {
                expect(fileNames).to.include(expectedFile,
                    `File ${expectedFile} was not found`);
            }
        });

        it('should have correct package structure', async () => {
            const javaFiles = await findJavaFiles(sampleProjectPath);

            const packages = {
                'com/example/utils': 1,
                'com/example/sessions': 7,
                'com/example/commands': 6,
                'com/example/items': 9,
                'com/example/entities': 5
            };

            for (const [pkgPath, count] of Object.entries(packages)) {
                const filesInPackage = javaFiles.filter(f => {
                    const normalizedPath = f.replace(/\\/g, '/');
                    return normalizedPath.includes(`/${pkgPath}/`);
                });
                expect(filesInPackage).to.have.lengthOf(count,
                    `Package ${pkgPath} should have ${count} files`);
            }

            // Main.javaは com/example 直下（サブパッケージではない）
            const mainFile = javaFiles.filter(f => {
                const normalizedPath = f.replace(/\\/g, '/');
                return normalizedPath.match(/\/com\/example\/[^\/]+\.java$/);
            });
            expect(mainFile).to.have.lengthOf(1, 'Should have 1 file in com.example root');
        });

        it('should verify abstract classes by content', async () => {
            const abstractClasses = [
                'Session.java',
                'Command.java',
                'Magic.java',
                'Item.java',
                'Weapon.java',
                'Armor.java',
                'Entity.java'
            ];

            for (const abstractClass of abstractClasses) {
                const file = await findFileByName(sampleProjectPath, abstractClass);
                expect(file).to.not.equal(null, `${abstractClass} should exist`);

                const content = await fs.readFile(file, 'utf-8');
                expect(content).to.match(/abstract\s+class/,
                    `${abstractClass} should contain 'abstract class'`);
            }
        });

        it('should verify inheritance by file content', async () => {
            // いくつかの継承関係を確認
            const inheritances = [
                { file: 'MainSession.java', extends: 'Session' },
                { file: 'FireBall.java', extends: 'Magic' },
                { file: 'Dragon.java', extends: 'Monster' },
                { file: 'IronSword.java', extends: 'Weapon' }
            ];

            for (const { file: fileName, extends: parentClass } of inheritances) {
                const file = await findFileByName(sampleProjectPath, fileName);
                expect(file).to.not.equal(null, `${fileName} should exist`);

                const content = await fs.readFile(file, 'utf-8');
                expect(content).to.include(`extends ${parentClass}`,
                    `${fileName} should extend ${parentClass}`);
            }
        });
    });
});
