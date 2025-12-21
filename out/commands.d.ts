import * as vscode from 'vscode';
import { AnalyzerManager } from './AnalyzerManager';
import { GraphViewProvider } from './providers/GraphViewProvider';
import { GraphSettingsProvider } from './providers/GraphSettingsProvider';
import { FilterProvider } from './providers/FilterProvider';
import { CallStackProvider } from './providers/CallStackProvider';
interface Providers {
    settingsProvider: GraphSettingsProvider;
    filterProvider: FilterProvider;
    graphViewProvider: GraphViewProvider;
    callStackProvider: CallStackProvider;
    analyzerManager: AnalyzerManager;
}
/**
 * コマンドを登録する
 */
export declare function registerCommands(_context: vscode.ExtensionContext, providers: Providers): vscode.Disposable[];
export {};
//# sourceMappingURL=commands.d.ts.map