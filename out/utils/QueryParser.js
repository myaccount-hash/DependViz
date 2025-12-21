"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryParser = void 0;
const utils_1 = require("./utils");
/**
 * クエリ文字列を解析し，ノードフィルタリングに使用するクラス
 */
class QueryParser {
    constructor(query) {
        this.query = query.trim();
        this.pos = 0;
        this.tokens = [];
    }
    parse() {
        if (!this.query)
            return null;
        this.tokenize();
        if (this.tokens.length === 0)
            return null;
        this.pos = 0;
        return this.parseOr();
    }
    tokenize() {
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
                    }
                    else {
                        pattern += this.query[i];
                        i++;
                    }
                }
                if (i < len) {
                    this.tokens.push({ type: 'REGEX', value: pattern });
                    i++;
                }
                else {
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
            }
            else {
                this.tokens.push({ type: 'STRING', value: word });
            }
        }
    }
    currentToken() {
        return this.pos < this.tokens.length ? this.tokens[this.pos] : null;
    }
    consume(type) {
        const token = this.currentToken();
        if (token && token.type === type) {
            this.pos++;
            return token;
        }
        return null;
    }
    parseOr() {
        let left = this.parseAnd();
        while (this.consume('OPERATOR')?.value === 'OR') {
            const right = this.parseAnd();
            left = { type: 'OR', left, right };
        }
        return left;
    }
    parseAnd() {
        let left = this.parseNot();
        while (this.currentToken()?.type === 'OPERATOR' && this.currentToken()?.value === 'AND') {
            this.pos++;
            const right = this.parseNot();
            left = { type: 'AND', left, right };
        }
        return left;
    }
    parseNot() {
        if (this.consume('OPERATOR')?.value === 'NOT') {
            return { type: 'NOT', operand: this.parseNot() };
        }
        return this.parseTerm();
    }
    parseTerm() {
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
        let value = null;
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
            }
            else if (valueToken.type === 'STRING') {
                value = valueToken.value;
            }
            else {
                throw new Error('Expected value after field:');
            }
            this.pos++;
        }
        else if (fieldToken.type === 'REGEX') {
            value = fieldToken.value;
            isRegex = true;
            this.pos++;
        }
        else if (fieldToken.type === 'STRING') {
            value = fieldToken.value;
            this.pos++;
        }
        else {
            throw new Error(`Unexpected token: ${fieldToken.type}`);
        }
        if (value === null) {
            throw new Error('Value cannot be null');
        }
        return { type: 'TERM', field, value, isRegex };
    }
    static evaluate(ast, node) {
        if (!ast)
            return true;
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
    static matchTerm(term, node) {
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
                text = (0, utils_1.getNodeFilePath)(node) || '';
                break;
            default:
                text = node.name || '';
        }
        if (term.isRegex) {
            try {
                const regex = new RegExp(term.value, 'i');
                return regex.test(text);
            }
            catch {
                return false;
            }
        }
        else {
            return text.toLowerCase().includes(term.value.toLowerCase());
        }
    }
    static filter(nodes, query) {
        if (!query || !query.trim())
            return nodes;
        try {
            const parser = new QueryParser(query);
            const ast = parser.parse();
            if (!ast)
                return nodes;
            return nodes.filter(node => QueryParser.evaluate(ast, node));
        }
        catch {
            return nodes;
        }
    }
}
exports.QueryParser = QueryParser;
exports.default = QueryParser;
//# sourceMappingURL=QueryParser.js.map