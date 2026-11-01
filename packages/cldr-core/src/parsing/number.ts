export const enum NumberField {
  MINUS = 0,
  PERCENT = 1,
  CURRENCY = 2,
  NUMBER = 3,
  EXPONENT = 4,
  PLUS = 5,
}

export interface NumberPattern {
  nodes: NumberNode[];
  minInt: number;
  maxFrac: number;
  minFrac: number;
  priGroup: number;
  secGroup: number;
}

export type NumberNode = string | NumberField;

const MINUS_NODE: NumberNode[] = [NumberField.MINUS];

const newPattern = (): NumberPattern => ({ nodes: [], minInt: 0, maxFrac: 0, minFrac: 0, priGroup: 0, secGroup: 0 });

/**
 * Parse a number pattern into its positive and negative forms.
 */
export const parseNumberPattern = (raw: string): NumberPattern[] => {
  let curr: NumberPattern = newPattern();
  let buf = '';
  let attached = false;

  const pushText = (): void => {
    if (buf.length > 0) {
      curr.nodes.push(buf);
      buf = '';
    }
  };

  const attach = (): void => {
    pushText();
    if (!attached) {
      curr.nodes.push(NumberField.NUMBER);
      attached = true;
    }
  };

  const len = raw.length;

  let save: NumberPattern | undefined;
  let ingroup = false;
  let indecimal = false;
  let i = 0;

  outer: while (i < len) {
    let ch = raw[i];
    switch (ch) {
      case "'":
        while (i++ < len) {
          ch = raw[i];
          if (ch === "'") {
            break;
          }
          buf += ch;
        }
        break;

      case ';':
        // If we encounter more than one pattern separator, bail out
        if (save) {
          break outer;
        }
        pushText();
        // Save current pattern and start parsing a new one
        save = curr;
        curr = newPattern();
        // Reset state for next parse
        indecimal = false;
        ingroup = false;
        attached = false;
        break;

      case '-':
        pushText();
        curr.nodes.push(NumberField.MINUS);
        break;

      case '%':
        pushText();
        curr.nodes.push(NumberField.PERCENT);
        break;

      case '\u00a4':
        pushText();
        curr.nodes.push(NumberField.CURRENCY);
        break;

      case 'E':
        pushText();
        curr.nodes.push(NumberField.EXPONENT);
        break;

      case '+':
        pushText();
        curr.nodes.push(NumberField.PLUS);
        break;

      case '#':
        attach();
        if (ingroup) {
          curr.priGroup++;
        } else if (indecimal) {
          curr.maxFrac++;
        }
        break;

      case ',':
        attach();
        if (ingroup) {
          curr.secGroup = curr.priGroup;
          curr.priGroup = 0;
        } else {
          ingroup = true;
        }
        break;

      case '.':
        ingroup = false;
        attach();
        indecimal = true;
        break;

      case '0':
        attach();
        if (ingroup) {
          curr.priGroup++;
        } else if (indecimal) {
          curr.maxFrac++;
          curr.minFrac++;
        }
        if (!indecimal) {
          curr.minInt++;
        }
        break;

      default:
        buf += ch;
        break;
    }

    i++;
  }
  pushText();
  if (save === undefined) {
    // Derive positive from negative by prepending a minus node
    const { nodes, minInt, maxFrac, minFrac, priGroup, secGroup } = curr;
    save = curr;
    curr = { nodes: MINUS_NODE.concat(nodes.slice(0)), minInt, maxFrac, minFrac, priGroup, secGroup };
  }
  return [save, curr];
};
