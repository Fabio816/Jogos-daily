import { describe, expect, it } from 'vitest';
import { applyStart, applySubmit, applyTimeout, currentUid, turnSeconds, type BombRoom } from './logic';

const SYL = ['ar', 'es', 'ou'];

function lobby(names: string[]): BombRoom {
  const players: BombRoom['players'] = {};
  names.forEach((n, i) => (players[n] = { name: n.toUpperCase(), lives: 0, joinedAt: i }));
  return { hostUid: names[0], status: 'lobby', players, order: [], turn: 0, turns: 0, syllable: '', deadline: 0, used: {} };
}

describe('turnSeconds', () => {
  it('começa em 12 s, diminui e para em 5 s', () => {
    expect(turnSeconds(0)).toBe(12);
    expect(turnSeconds(8)).toBe(11);
    expect(turnSeconds(1000)).toBe(5);
  });
});

describe('applyStart', () => {
  it('exige pelo menos 2 jogadores', () => {
    expect(applyStart(lobby(['a']), SYL, 0, () => 0)).toBeNull();
  });

  it('define ordem de entrada, vidas e primeira sílaba', () => {
    const r = applyStart(lobby(['a', 'b', 'c']), SYL, 1000, () => 0)!;
    expect(r.status).toBe('playing');
    expect(r.order).toEqual(['a', 'b', 'c']);
    expect(currentUid(r)).toBe('a');
    expect(r.players.b.lives).toBe(2);
    expect(r.syllable).toBe('ar');
    expect(r.deadline).toBe(1000 + 12000);
  });
});

describe('applySubmit', () => {
  const start = () => applyStart(lobby(['a', 'b']), SYL, 0, () => 0)!;

  it('aceita palavra válida com a sílaba e passa a vez', () => {
    const r = applySubmit(start(), 'a', 'arara', true, 1000, SYL, () => 0)!;
    expect(currentUid(r)).toBe('b');
    expect(r.used.arara).toBe(true);
    expect(r.turns).toBe(1);
  });

  it('rejeita: fora da vez, sem a sílaba, inválida, repetida ou depois do prazo', () => {
    const r = start();
    expect(applySubmit(r, 'b', 'arara', true, 1000, SYL)).toBeNull();
    expect(applySubmit(r, 'a', 'bola', true, 1000, SYL)).toBeNull();
    expect(applySubmit(r, 'a', 'arara', false, 1000, SYL)).toBeNull();
    expect(applySubmit(r, 'a', 'arara', true, 12000, SYL)).toBeNull();
    const once = applySubmit(r, 'a', 'arara', true, 1000, SYL, () => 0)!;
    const back = { ...once, turn: 0 }; // simula o mesmo jogador de novo
    expect(applySubmit(back, 'a', 'arara', true, 2000, SYL)).toBeNull();
  });
});

describe('applyTimeout', () => {
  it('só age depois do prazo e tira uma vida de quem estava na vez', () => {
    const r = applyStart(lobby(['a', 'b']), SYL, 0, () => 0)!;
    expect(applyTimeout(r, 11999, SYL)).toBeNull();
    const t = applyTimeout(r, 12000, SYL, () => 0)!;
    expect(t.players.a.lives).toBe(1);
    expect(currentUid(t)).toBe('b');
  });

  it('elimina quem zera as vidas e declara o último vivo como vencedor', () => {
    let r = applyStart(lobby(['a', 'b']), SYL, 0, () => 0)!;
    r = applyTimeout(r, 12000, SYL, () => 0)!; // a: 1 vida, vez de b
    r = applyTimeout(r, 24000, SYL, () => 0)!; // b: 1 vida, vez de a
    r = applyTimeout(r, 36000, SYL, () => 0)!; // a: 0 vidas
    expect(r.players.a.lives).toBe(0);
    expect(r.status).toBe('finished');
    expect(r.winnerUid).toBe('b');
  });
});
