import { describe, expect, test } from 'bun:test';
import { parseParagraphs, parseRichText } from '../src/model/rich-text';

describe('parseRichText', () => {
  test('plain text is one span', () => {
    expect(parseRichText('hello')).toEqual([{ text: 'hello' }]);
  });

  test('bold and italic markers', () => {
    expect(parseRichText('a **b** c *d*')).toEqual([
      { text: 'a ' },
      { text: 'b', bold: true },
      { text: ' c ' },
      { text: 'd', italic: true },
    ]);
  });

  test('unmatched markers stay literal', () => {
    expect(parseRichText('2 * 3')).toEqual([{ text: '2 * 3' }]);
  });

  test('paragraphs split on blank lines and join wrapped lines', () => {
    expect(parseParagraphs('one\ntwo\n\nthree')).toEqual([[{ text: 'one two' }], [{ text: 'three' }]]);
  });
});
