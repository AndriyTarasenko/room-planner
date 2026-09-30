import { describe, expect, it } from 'vitest';
import { parseNumberInput } from './parseNumber';

describe('parseNumberInput', () => {
  it('parses plain numbers, decimal commas and units', () => {
    expect(parseNumberInput('180')).toBe(180);
    expect(parseNumberInput(' 72,5 ')).toBe(72.5);
    expect(parseNumberInput('.5')).toBe(0.5);
    expect(parseNumberInput('160 cm')).toBe(160);
    expect(parseNumberInput('-20')).toBe(-20);
  });

  it('evaluates simple arithmetic', () => {
    expect(parseNumberInput('180+20')).toBe(200);
    expect(parseNumberInput('2*80')).toBe(160);
    expect(parseNumberInput('(380-180)/2')).toBe(100);
    expect(parseNumberInput('10+2*3')).toBe(16);
  });

  it('rejects invalid input', () => {
    expect(parseNumberInput('')).toBeNaN();
    expect(parseNumberInput('abc')).toBeNaN();
    expect(parseNumberInput('1/0')).toBeNaN();
    expect(parseNumberInput('(1+2')).toBeNaN();
    expect(parseNumberInput('alert(1)')).toBeNaN();
  });
});
