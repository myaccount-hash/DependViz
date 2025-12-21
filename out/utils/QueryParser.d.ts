import { GraphNode } from './utils';
interface TermAST {
    type: 'TERM';
    field: string;
    value: string;
    isRegex: boolean;
}
interface NotAST {
    type: 'NOT';
    operand: AST;
}
interface AndAST {
    type: 'AND';
    left: AST;
    right: AST;
}
interface OrAST {
    type: 'OR';
    left: AST;
    right: AST;
}
type AST = TermAST | NotAST | AndAST | OrAST;
/**
 * クエリ文字列を解析し，ノードフィルタリングに使用するクラス
 */
export declare class QueryParser {
    private query;
    private pos;
    private tokens;
    constructor(query: string);
    parse(): AST | null;
    private tokenize;
    private currentToken;
    private consume;
    private parseOr;
    private parseAnd;
    private parseNot;
    private parseTerm;
    static evaluate(ast: AST | null, node: GraphNode): boolean;
    static matchTerm(term: TermAST, node: GraphNode): boolean;
    static filter(nodes: GraphNode[], query: string): GraphNode[];
}
export default QueryParser;
//# sourceMappingURL=QueryParser.d.ts.map