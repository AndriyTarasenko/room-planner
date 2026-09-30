/**
 * Parses user input for numeric fields. Accepts decimal commas and simple arithmetic
 * ("180+20", "2*80", "(380-180)/2") like design tools do. Returns NaN when invalid.
 */
export function parseNumberInput(input: string): number {
  const src = input.replace(/,/g, '.').replace(/\s+/g, '').replace(/cm$/i, '');
  if (src === '') return NaN;
  let pos = 0;

  const peek = () => src[pos];
  const expr = (): number => {
    let value = term();
    while (peek() === '+' || peek() === '-') {
      const op = src[pos++];
      const rhs = term();
      value = op === '+' ? value + rhs : value - rhs;
    }
    return value;
  };
  const term = (): number => {
    let value = factor();
    while (peek() === '*' || peek() === '/' || peek() === 'x') {
      const op = src[pos++];
      const rhs = factor();
      value = op === '/' ? value / rhs : value * rhs;
    }
    return value;
  };
  const factor = (): number => {
    if (peek() === '-') {
      pos++;
      return -factor();
    }
    if (peek() === '+') {
      pos++;
      return factor();
    }
    if (peek() === '(') {
      pos++;
      const value = expr();
      if (peek() !== ')') return NaN;
      pos++;
      return value;
    }
    const match = /^\d*\.?\d+|^\d+\./.exec(src.slice(pos));
    if (!match) return NaN;
    pos += match[0].length;
    return parseFloat(match[0]);
  };

  const result = expr();
  return pos === src.length && Number.isFinite(result) ? result : NaN;
}
