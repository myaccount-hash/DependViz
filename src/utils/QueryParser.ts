import { getNodeFilePath, GraphNode } from './utils';

interface Token {
    type: 'LPAREN' | 'RPAREN' | 'REGEX' | 'COLON' | 'OPERATOR' | 'STRING';
    value: string;
}

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
export class QueryParser {
    private query: string;
    private pos: number;
    private tokens: Token[];

    constructor(query: string) {
        this.query = query.trim();
        this.pos = 0;
        this.tokens = [];
    }

    parse(): AST | null {
        if (!this.query) return null;
        this.tokenize();
        if (this.tokens.length === 0) return null;
        this.pos = 0;
        return this.parseOr();
    }

    private tokenize(): void {
        this.tokens = [];
        let i = 0;
        const len = this.query.length;

        while (i < len) {
            const ch = this.query[i];

            if (/\s/.test(ch)) {
                i++;
                continue;
            }

            if (ch === '(') {
                this.tokens.push({ type: 'LPAREN', value: '(' });
                i++;
                continue;
            }

            if (ch === ')') {
                this.tokens.push({ type: 'RPAREN', value: ')' });
                i++;
                continue;
            }

            if (ch === '/') {
                const start = i;
                i++;
                let pattern = '';
                while (i < len && this.query[i] !== '/') {
                    if (this.query[i] === '\\' && i + 1 < len) {
                        pattern += this.query[i] + this.query[i + 1];
                        i += 2;
                    } else {
                        pattern += this.query[i];
                        i++;
                    }
                }
                if (i < len) {
                    this.tokens.push({ type: 'REGEX', value: pattern });
                    i++;
                } else {
                    this.tokens.push({ type: 'STRING', value: this.query.substring(start) });
                }
                continue;
            }

            if (ch === ':') {
                this.tokens.push({ type: 'COLON', value: ':' });
                i++;
                continue;
            }

            const wordStart = i;
            while (i < len && !/\s|[():]/.test(this.query[i])) {
                i++;
            }
            const word = this.query.substring(wordStart, i);
            const upperWord = word.toUpperCase();

            if (upperWord === 'AND' || upperWord === 'OR' || upperWord === 'NOT') {
                this.tokens.push({ type: 'OPERATOR', value: upperWord });
            } else {
                this.tokens.push({ type: 'STRING', value: word });
            }
        }
    }

    private currentToken(): Token | null {
        return this.pos < this.tokens.length ? this.tokens[this.pos] : null;
    }

    private consume(type: Token['type']): Token | null {
        const token = this.currentToken();
        if (token && token.type === type) {
            this.pos++;
            return token;
        }
        return null;
    }

    private parseOr(): AST {
        let left = this.parseAnd();
        while (this.consume('OPERATOR')?.value === 'OR') {
            const right = this.parseAnd();
            left = { type: 'OR', left, right };
        }
        return left;
    }

    private parseAnd(): AST {
        let left = this.parseNot();
        while (this.currentToken()?.type === 'OPERATOR' && this.currentToken()?.value === 'AND') {
            this.pos++;
            const right = this.parseNot();
            left = { type: 'AND', left, right };
        }
        return left;
    }

    private parseNot(): AST {
        if (this.consume('OPERATOR')?.value === 'NOT') {
            return { type: 'NOT', operand: this.parseNot() };
        }
        return this.parseTerm();
    }

    private parseTerm(): AST {
        if (this.consume('LPAREN')) {
            const expr = this.parseOr();
            if (!this.consume('RPAREN')) {
                throw new Error('Unclosed parenthesis');
            }
            return expr;
        }

        const fieldToken = this.currentToken();
        if (!fieldToken) {
            throw new Error('Unexpected end of query');
        }

        let field = 'name';
        let value: string | null = null;
        let isRegex = false;

        if (fieldToken.type === 'STRING' && this.tokens[this.pos + 1]?.type === 'COLON') {
            field = fieldToken.value.toLowerCase();
            this.pos += 2;
            const valueToken = this.currentToken();
            if (!valueToken) {
                throw new Error('Expected value after field:');
            }
            if (valueToken.type === 'REGEX') {
                value = valueToken.value;
                isRegex = true;
            } else if (valueToken.type === 'STRING') {
                value = valueToken.value;
            } else {
                throw new Error('Expected value after field:');
            }
            this.pos++;
        } else if (fieldToken.type === 'REGEX') {
            value = fieldToken.value;
            isRegex = true;
            this.pos++;
        } else if (fieldToken.type === 'STRING') {
            value = fieldToken.value;
            this.pos++;
        } else {
            throw new Error(`Unexpected token: ${fieldToken.type}`);
        }

        if (value === null) {
            throw new Error('Value cannot be null');
        }

        return { type: 'TERM', field, value, isRegex };
    }

    static evaluate(ast: AST | null, node: GraphNode): boolean {
        if (!ast) return true;

        switch (ast.type) {
            case 'TERM':
                return QueryParser.matchTerm(ast, node);
            case 'NOT':
                return !QueryParser.evaluate(ast.operand, node);
            case 'AND':
                return QueryParser.evaluate(ast.left, node) && QueryParser.evaluate(ast.right, node);
            case 'OR':
                return QueryParser.evaluate(ast.left, node) || QueryParser.evaluate(ast.right, node);
            default:
                return true;
        }
    }

    static matchTerm(term: TermAST, node: GraphNode): boolean {
        let text = '';

        switch (term.field) {
            case 'name':
                text = node.name || '';
                break;
            case 'type':
                text = node.type || '';
                break;
            case 'path':
            case 'filepath':
                text = getNodeFilePath(node) || '';
                break;
            default:
                text = node.name || '';
        }

        if (term.isRegex) {
            try {
                const regex = new RegExp(term.value, 'i');
                return regex.test(text);
            } catch {
                return false;
            }
        } else {
            return text.toLowerCase().includes(term.value.toLowerCase());
        }
    }

    static filter(nodes: GraphNode[], query: string): GraphNode[] {
        if (!query || !query.trim()) return nodes;

        try {
            const parser = new QueryParser(query);
            const ast = parser.parse();
            if (!ast) return nodes;

            return nodes.filter(node => QueryParser.evaluate(ast, node));
        } catch {
            return nodes;
        }
    }
}

export default QueryParser;
