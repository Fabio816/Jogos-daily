import { describe, expect, it } from 'vitest';
import { parseInviteCode } from './invite';

describe('parseInviteCode', () => {
  it('lê o código do parâmetro sala e põe em maiúsculas', () => {
    expect(parseInviteCode('?sala=abc23')).toBe('ABC23');
  });

  it('limita a 5 caracteres e ignora outros parâmetros', () => {
    expect(parseInviteCode('?foo=1&sala=ABCDEFG')).toBe('ABCDE');
  });

  it('devolve vazio sem o parâmetro', () => {
    expect(parseInviteCode('')).toBe('');
    expect(parseInviteCode('?outro=x')).toBe('');
  });
});
