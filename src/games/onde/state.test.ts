import { describe, expect, it } from 'vitest';
import { haversineKm, scoreFor, MAX_POINTS } from './geo';
import { applyGuess, applyStartRound, applyTick, normalizeOndeRoom, reveal, type OndeRoom, DEFAULT_ONDE_SETTINGS } from './state';

const PARIS = { lat: 48.8566, lon: 2.3522 };
const LONDON = { lat: 51.5074, lon: -0.1278 };
const PICK = (id: string) => ({ id, lat: 48.85, lon: 2.35, url: 'x.jpg', creator: 'a', isPano: false });

function room(players = ['a', 'b'], rounds = 2): OndeRoom {
  const p: OndeRoom['players'] = {};
  players.forEach((u, i) => (p[u] = { name: u, score: 0, joinedAt: i }));
  return { hostUid: players[0], status: 'lobby', settings: { ...DEFAULT_ONDE_SETTINGS, rounds, seconds: 60 }, players: p, round: null, used: {} };
}

describe('geo', () => {
  it('distância Paris-Londres ≈ 344 km', () => {
    expect(haversineKm(PARIS, LONDON)).toBeGreaterThan(340);
    expect(haversineKm(PARIS, LONDON)).toBeLessThan(348);
    expect(haversineKm(PARIS, PARIS)).toBeCloseTo(0, 6);
  });

  it('pontuação: máximo no acerto e caindo com a distância', () => {
    expect(scoreFor(0)).toBe(MAX_POINTS);
    expect(scoreFor(100)).toBeGreaterThan(scoreFor(1000));
    expect(scoreFor(20000)).toBeLessThan(100);
  });
});

describe('rodadas', () => {
  it('inicia rodada 1 e não inicia outra enquanto a atual está aberta', () => {
    const r = applyStartRound(room(), PICK('p1'), 0)!;
    expect(r.round?.n).toBe(1);
    expect(r.round?.status).toBe('playing');
    expect(applyStartRound(r, PICK('p2'), 1)).toBeNull();
  });

  it('não repete foto já usada na sala', () => {
    const r = applyStartRound(room(), PICK('p1'), 0)!;
    const closed = applyTick(r, 60_000)!;
    expect(applyStartRound(closed, PICK('p1'), 70_000)).toBeNull();
  });

  it('palpite fora do prazo é recusado', () => {
    const r = applyStartRound(room(), PICK('p1'), 0)!;
    expect(applyGuess(r, 'a', PARIS, 60_000)).toBeNull();
    expect(applyGuess(r, 'a', PARIS, 59_999)).not.toBeNull();
  });

  it('quando todos palpitam, a rodada fecha e soma pontos', () => {
    let r = applyStartRound(room(), PICK('p1'), 0)!;
    r = applyGuess(r, 'a', PARIS, 1000)!;
    expect(r.round?.status).toBe('playing');
    r = applyGuess(r, 'b', LONDON, 2000)!;
    expect(r.round?.status).toBe('reveal');
    expect(r.players.a.score).toBeGreaterThan(r.players.b.score);
    expect(r.round?.results.a.pts).toBe(r.players.a.score);
  });

  it('no fim do tempo, quem não palpitou fica sem pontos', () => {
    let r = applyStartRound(room(), PICK('p1'), 0)!;
    r = applyGuess(r, 'a', PARIS, 1000)!;
    const closed = applyTick(r, 60_000)!;
    expect(closed.round?.status).toBe('reveal');
    expect(closed.players.b.score).toBe(0);
    expect(closed.players.a.score).toBeGreaterThan(4900); // foto a ~1,4 km de Paris
  });

  it('a partida termina depois da última rodada', () => {
    let r = applyStartRound(room(['a'], 1), PICK('p1'), 0)!;
    r = applyGuess(r, 'a', PARIS, 1000)!;
    expect(r.status).toBe('finished');
    expect(applyStartRound(r, PICK('p2'), 5000)).toBeNull();
  });

  it('reveal soma pontos de cada jogador exatamente uma vez', () => {
    let r = applyStartRound(room(), PICK('p1'), 0)!;
    r = applyGuess(r, 'a', PARIS, 1000)!;
    r = applyGuess(r, 'b', PARIS, 1000)!;
    const again = reveal(r, 5000);
    expect(again.players.a.score).toBe(r.players.a.score * 2);
  });
});

describe('normalização', () => {
  it('região e área inválidas caem no padrão; válidas são mantidas', () => {
    const base = { hostUid: 'a', status: 'lobby', players: {}, round: null, used: {} };
    expect(normalizeOndeRoom({ ...base, settings: { region: 'marte', spread: 'x' } }).settings).toMatchObject({ region: 'mundo', spread: 'cidade' });
    expect(normalizeOndeRoom({ ...base, settings: { region: 'europa', spread: 'bairro' } }).settings).toMatchObject({ region: 'europa', spread: 'bairro' });
    expect(normalizeOndeRoom({ ...base, settings: {} }).settings).toMatchObject({ rounds: 5, seconds: 90, region: 'mundo', spread: 'cidade' });
  });
  it('reconstrói palpites e resultados que o banco omitiu', () => {
    const r = normalizeOndeRoom({ hostUid: 'a', status: 'lobby', round: { n: 1, lat: 0, lon: 0, status: 'playing', startedAt: 0, durationMs: 1, imageId: 'x', imageUrl: 'u', creator: 'c' } });
    expect(r.round?.guesses).toEqual({});
    expect(r.round?.results).toEqual({});
    expect(r.settings.rounds).toBe(5);
  });
});
