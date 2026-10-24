import { describe, expect, it } from 'vitest';
import {
  attemptProblem,
  applySettings,
  applyStart,
  applySubmit,
  applyTimeout,
  currentUid,
  turnMsFor,
  turnSeconds,
  type BombRoom,
} from './logic';

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

describe('aceleração por acerto seguido', () => {
  const started = (accel?: number) => {
    const r = applyStart(lobby(['a', 'b']), SYL, 0, () => 0)!;
    return accel === undefined ? r : { ...r, settings: { accel } };
  };

  it('sem configuração, o turno segue o tempo base', () => {
    const r = { ...started(), players: { ...started().players, a: { ...started().players.a, streak: 5 } } };
    expect(turnMsFor(r, 'a')).toBe(12000);
  });

  it('com aceleração leve, cada acerto seguido tira 1 s do próximo turno', () => {
    const r = started(1);
    r.players.a = { ...r.players.a, streak: 3 };
    expect(turnMsFor(r, 'a')).toBe(9000);
    expect(turnMsFor(r, 'b')).toBe(12000);
  });

  it('aceleração forte tira 2 s por acerto e nunca passa do mínimo de 3 s', () => {
    const r = started(2);
    r.players.a = { ...r.players.a, streak: 2 };
    expect(turnMsFor(r, 'a')).toBe(8000);
    r.players.a = { ...r.players.a, streak: 9 };
    expect(turnMsFor(r, 'a')).toBe(3000);
  });

  it('acerto soma na sequência e o prazo do próximo jogador usa a sequência dele', () => {
    const r0 = started(1);
    r0.players.b = { ...r0.players.b, streak: 2 };
    const r1 = applySubmit(r0, 'a', 'arara', true, 1000, SYL, () => 0)!;
    expect(r1.players.a.streak).toBe(1);
    expect(currentUid(r1)).toBe('b');
    expect(r1.turnMs).toBe(10000);
    expect(r1.deadline).toBe(1000 + 10000);
  });

  it('estourar o tempo zera a sequência de quem estava na vez', () => {
    const r0 = started(1);
    r0.players.a = { ...r0.players.a, streak: 4 };
    const t = applyTimeout(r0, 12000, SYL, () => 0)!;
    expect(t.players.a.streak).toBe(0);
  });

  it('início da partida zera as sequências', () => {
    const lobbyRoom = lobby(['a', 'b']);
    lobbyRoom.players.a.streak = 7;
    expect(applyStart(lobbyRoom, SYL, 0, () => 0)!.players.a.streak).toBe(0);
  });
});

describe('applySettings', () => {
  const room = (): BombRoom => ({ ...lobby(['a', 'b']), status: 'lobby' });

  it('só o host configura, e só com valor permitido', () => {
    expect(applySettings(room(), 'b', 1)).toBeNull();
    expect(applySettings(room(), 'a', 5)).toBeNull();
    expect(applySettings(room(), 'a', 2)!.settings).toEqual({ accel: 2 });
  });

  it('não muda durante a partida', () => {
    const playing = applyStart(room(), SYL, 0, () => 0)!;
    expect(applySettings(playing, 'a', 1)).toBeNull();
  });

  it('é permitido depois da partida, para o próximo jogo', () => {
    const finished: BombRoom = { ...room(), status: 'finished' };
    expect(applySettings(finished, 'a', 1)!.settings).toEqual({ accel: 1 });
  });
});

describe('digitação', () => {
  it('é apagada quando a vez passa', () => {
    const r0 = { ...applyStart(lobby(['a', 'b']), SYL, 0, () => 0)!, typing: { uid: 'a', text: 'ara', turn: 0 } };
    const r1 = applySubmit(r0, 'a', 'arara', true, 1000, SYL, () => 0)!;
    expect(r1.typing).toBeUndefined();
  });
});

describe('attemptProblem', () => {
  const room = { ...applyStart(lobby(['a', 'b']), SYL, 0, () => 0)!, used: { arara: true } };

  it('explica o motivo da recusa na ordem: sílaba, dicionário, repetida', () => {
    expect(attemptProblem(room, 'bola', true)).toContain('AR');
    expect(attemptProblem(room, 'arzzz', false)).toContain('dicionário');
    expect(attemptProblem(room, 'arara', true)).toContain('já foi usada');
  });

  it('aceita quando a palavra serve', () => {
    expect(attemptProblem(room, 'arvore', true)).toBeNull();
  });
});

describe('sílaba ao trocar a vez', () => {
  const start = () => applyStart(lobby(['a', 'b']), SYL, 0, () => 0)!;

  it('tempo estourado manda a mesma sílaba para o próximo jogador', () => {
    const r0 = start();
    const t = applyTimeout(r0, 12000, SYL, () => 0.99)!;
    expect(currentUid(t)).toBe('b');
    expect(t.syllable).toBe(r0.syllable);
  });

  it('acerto sorteia sílaba nova', () => {
    const r0 = start();
    const r = applySubmit(r0, 'a', 'arara', true, 1000, SYL, () => 0.99)!;
    expect(r.syllable).toBe('ou');
  });
});
