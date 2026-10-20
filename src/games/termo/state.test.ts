import { describe, expect, it } from 'vitest';
import { applyGuess, applyNewRound, isEveryoneDone, normalizeTermoRoom, pointsOf, type TermoRoom } from './state';
import { clampSettings } from './state';

const DICT = new Set(['fazer', 'gatos', 'tosco', 'cacho', 'carro']);
const TARGETS = ['fazer', 'cacho', 'carro'];

function room(): TermoRoom {
  return normalizeTermoRoom({
    hostUid: 'ana',
    status: 'lobby',
    players: { ana: { name: 'Ana' }, bia: { name: 'Bia' } },
  });
}

describe('applyNewRound', () => {
  it('inicia a rodada 1 com palavra não usada e zera palpites', () => {
    const r = applyNewRound(room(), TARGETS, () => 0)!;
    expect(r.status).toBe('playing');
    expect(r.round?.n).toBe(1);
    expect(r.round?.words).toEqual(['fazer']);
    expect(r.used.fazer).toBe(true);
    expect(r.players.ana.guesses).toEqual([]);
  });

  it('não começa outra rodada enquanto a atual está aberta', () => {
    const r = applyNewRound(room(), TARGETS, () => 0)!;
    expect(applyNewRound(r, TARGETS, () => 0)).toBeNull();
  });

  it('não repete palavras da sala', () => {
    let r = applyNewRound(room(), TARGETS, () => 0)!;
    r = applyGuess(r, 'ana', 'fazer', DICT)!; // ana acerta e encerra
    const next = applyNewRound(r, TARGETS, () => 0)!;
    expect(next.round?.words).toEqual(['cacho']);
  });
});

describe('applyGuess', () => {
  it('o primeiro a acertar encerra a rodada e vence', () => {
    let r = applyNewRound(room(), TARGETS, () => 0)!;
    r = applyGuess(r, 'bia', 'gatos', DICT)!;
    r = applyGuess(r, 'bia', 'fazer', DICT)!;
    expect(r.round?.status).toBe('done');
    expect(r.round?.winnerUid).toBe('bia');
    expect(pointsOf(r.players.bia)).toBe(50); // 2 tentativas
    expect(applyGuess(r, 'ana', 'fazer', DICT)).toBeNull(); // rodada já encerrada
  });

  it('soma os pontos da rodada no placar do vencedor', () => {
    let r = applyNewRound(room(), TARGETS, () => 0)!;
    r = applyGuess(r, 'bia', 'fazer', DICT)!; // 1 tentativa = 60 pontos
    expect(r.players.bia.score).toBe(60);
    expect(r.players.ana.score).toBe(0);
  });

  it('encerra a partida depois do número de palavras configurado', () => {
    let r: TermoRoom = { ...room(), settings: clampSettings({ words: 2, tries: 6 }) };
    r = applyNewRound(r, TARGETS, () => 0)!;
    r = applyGuess(r, 'ana', 'fazer', DICT)!;
    r = applyNewRound(r, TARGETS, () => 0)!; // 2ª palavra
    expect(r.round?.n).toBe(2);
    r = applyGuess(r, 'ana', 'cacho', DICT)!;
    const end = applyNewRound(r, TARGETS, () => 0)!;
    expect(end.status).toBe('finished');
  });

  it('respeita o número de tentativas configurado', () => {
    let r: TermoRoom = { ...room(), settings: clampSettings({ words: 1, tries: 3 }) };
    r = applyNewRound(r, TARGETS, () => 0)!;
    for (const g of ['gatos', 'tosco', 'cacho']) {
      r = applyGuess(r, 'ana', g, DICT)!;
      r = applyGuess(r, 'bia', g, DICT)!;
    }
    expect(r.round?.status).toBe('done');
    expect(applyGuess(r, 'ana', 'carro', DICT)).toBeNull();
  });

  it('clampSettings limita palavras e tentativas', () => {
    expect(clampSettings({ words: 99, tries: 99 })).toEqual({ words: 10, tries: 6, boards: 1 });
    expect(clampSettings({ words: 0, tries: 1 })).toEqual({ words: 1, tries: 3, boards: 1 });
    expect(clampSettings({ boards: 3 })).toEqual({ words: 3, tries: 6, boards: 2 }); // 3 não existe: vai para o mais próximo
    expect(clampSettings({ boards: 4, tries: 99 })).toEqual({ words: 3, tries: 9, boards: 4 }); // quarteto: até 9 tentativas
  });

  it('rejeita palavra fora do dicionário e palpite de quem não está na sala', () => {
    const r = applyNewRound(room(), TARGETS, () => 0)!;
    expect(applyGuess(r, 'ana', 'zzzzz', DICT)).toBeNull();
    expect(applyGuess(r, 'intruso', 'fazer', DICT)).toBeNull();
  });

  it('a rodada termina quando todos esgotam as tentativas', () => {
    let r = applyNewRound(room(), TARGETS, () => 0)!;
    const wrong = ['gatos', 'tosco', 'cacho', 'carro', 'gatos', 'tosco'];
    for (const g of wrong) {
      r = applyGuess(r, 'ana', g, DICT)!;
      r = applyGuess(r, 'bia', g, DICT)!;
    }
    expect(r.round?.status).toBe('done');
    expect(r.round?.winnerUid).toBeUndefined();
    expect(isEveryoneDone(r)).toBe(true);
  });

  it('quem já acertou não pode palpitar de novo na mesma rodada', () => {
    let r = applyNewRound(room(), TARGETS, () => 0)!;
    r = applyGuess(r, 'ana', 'fazer', DICT)!;
    expect(applyGuess(r, 'ana', 'gatos', DICT)).toBeNull();
  });
});

describe('tabuleiros múltiplos', () => {
  const TW = ['fazer', 'cacho', 'carro', 'gatos'];
  it('quarteto: uma rodada tem 4 palavras e só acaba quando todas forem resolvidas', () => {
    let r: TermoRoom = { ...room(), settings: clampSettings({ words: 1, boards: 4 }) };
    r = applyNewRound(r, TW, () => 0)!;
    expect(r.round?.words.length).toBe(4);
    for (const w of ['fazer', 'cacho', 'carro']) r = applyGuess(r, 'ana', w, DICT)!;
    expect(r.round?.status).toBe('playing'); // falta uma palavra
    r = applyGuess(r, 'ana', 'gatos', DICT)!;
    expect(r.round?.status).toBe('done');
    expect(r.round?.winnerUid).toBe('ana');
  });

  it('pontos são multiplicados pelo número de tabuleiros', () => {
    const p = { name: 'x', guesses: ['fazer'], solved: true, score: 0 };
    expect(pointsOf(p, 6, 1)).toBe(60);
    expect(pointsOf(p, 6, 4)).toBe(240);
  });

  it('não repete palavras usadas entre rodadas', () => {
    let r: TermoRoom = { ...room(), settings: clampSettings({ words: 3, boards: 2 }) };
    r = applyNewRound(r, TW, () => 0)!;
    const first = r.round!.words;
    r = applyGuess(r, 'ana', first[0], DICT)!;
    r = applyGuess(r, 'ana', first[1], DICT)!;
    r = applyNewRound(r, TW, () => 0)!;
    expect(r.round!.words.some((w) => first.includes(w))).toBe(false);
  });
});
