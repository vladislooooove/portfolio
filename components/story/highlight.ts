/**
 * A display-only tokenizer. It is not a TypeScript parser and does not try to
 * be one: the sample it colours is fixed, single file, and has no block
 * comments or multi-line template literals, so a per-line scan puts the right
 * colour under every character. Anything it cannot classify falls through to
 * plain text, which is what an editor does with an unknown grammar anyway.
 *
 * The colours are the real Dark+ values. That palette is most of what makes a
 * screen read as VS Code rather than as a generic dark code block, so it stays
 * authentic even though the chrome around it is tinted toward this page.
 *
 * Bracket pairs are coloured by depth, which VS Code has done by default since
 * 1.60. Depth carries across lines, so the scanner is a fold rather than a map.
 */

export const SYNTAX = {
  plain: "#d4d4d4",
  comment: "#6a9955",
  string: "#ce9178",
  number: "#b5cea8",
  /** import, export, return, from: the control-flow family. */
  control: "#c586c0",
  /** const, function, type, boolean literals: the declaration family. */
  declare: "#569cd6",
  type: "#4ec9b0",
  func: "#dcdcaa",
  variable: "#9cdcfe",
  punct: "#cdc9d8",
} as const;

/** VS Code's default bracket pair colours, cycled by nesting depth. */
const BRACKETS = ["#ffd700", "#da70d6", "#179fff"];

export type Token = { text: string; color: string };

const CONTROL = /^(?:import|from|export|return|if|else|await|async|for|of|in|as|default|new)\b/y;
const DECLARE =
  /^(?:const|let|var|function|type|interface|extends|null|undefined|true|false|void|string|number|boolean|readonly)\b/y;

const COMMENT = /^\/\/.*/y;
const STRING = /^(?:"[^"]*"|'[^']*'|`[^`]*`)/y;
const NUMBER = /^\d+(?:\.\d+)?/y;
const TAG = /^<\/?[A-Za-z][\w.]*/y;
const IDENT = /^[A-Za-z_$][\w$]*/y;
const SPACE = /^\s+/y;

const at = (re: RegExp, line: string, i: number) => {
  re.lastIndex = i;
  return re.exec(line);
};

/**
 * Tokenizes one line, returning the bracket depth the next line starts at.
 * Runs of the same colour are merged so the renderer makes one fillText call
 * per colour change rather than one per character.
 */
export function tokenize(line: string, depth = 0): { tokens: Token[]; depth: number } {
  const out: Token[] = [];
  let i = 0;
  let level = depth;

  const push = (text: string, color: string) => {
    const last = out[out.length - 1];
    if (last && last.color === color) last.text += text;
    else out.push({ text, color });
  };

  while (i < line.length) {
    const space = at(SPACE, line, i);
    if (space) {
      push(space[0], SYNTAX.plain);
      i += space[0].length;
      continue;
    }

    const comment = at(COMMENT, line, i);
    if (comment) {
      push(comment[0], SYNTAX.comment);
      break;
    }

    const string = at(STRING, line, i);
    if (string) {
      push(string[0], SYNTAX.string);
      i += string[0].length;
      continue;
    }

    const tag = at(TAG, line, i);
    if (tag) {
      // A capitalised tag is a component, a lowercase one is an intrinsic
      // element, and VS Code colours the two differently.
      const name = tag[0].replace(/[<\/]/g, "");
      push(tag[0], /^[A-Z]/.test(name) ? SYNTAX.type : SYNTAX.declare);
      i += tag[0].length;
      continue;
    }

    const number = at(NUMBER, line, i);
    if (number) {
      push(number[0], SYNTAX.number);
      i += number[0].length;
      continue;
    }

    const control = at(CONTROL, line, i);
    if (control) {
      push(control[0], SYNTAX.control);
      i += control[0].length;
      continue;
    }

    const declare = at(DECLARE, line, i);
    if (declare) {
      push(declare[0], SYNTAX.declare);
      i += declare[0].length;
      continue;
    }

    const ident = at(IDENT, line, i);
    if (ident) {
      const word = ident[0];
      const next = line[i + word.length];
      if (/^[A-Z]/.test(word)) push(word, SYNTAX.type);
      else if (next === "(") push(word, SYNTAX.func);
      else push(word, SYNTAX.variable);
      i += word.length;
      continue;
    }

    const ch = line[i];
    if (ch === "(" || ch === "[" || ch === "{") {
      push(ch, BRACKETS[level % BRACKETS.length]);
      level++;
    } else if (ch === ")" || ch === "]" || ch === "}") {
      level = Math.max(0, level - 1);
      push(ch, BRACKETS[level % BRACKETS.length]);
    } else {
      push(ch, SYNTAX.punct);
    }
    i++;
  }

  return { tokens: out, depth: level };
}
