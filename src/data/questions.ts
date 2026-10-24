export type WorkType = 'movie' | 'series' | 'game' | 'anime';
/** 'character': mostra o nome do personagem. 'actor': mostra o nome do ator. */
export type ClueType = 'phrase' | 'emoji' | 'image' | 'character' | 'actor';
export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
/** 'work': adivinhar a obra. 'actor': dado um personagem e a obra, adivinhar o ator. 'character': dado um ator e a obra, adivinhar o personagem. */
export type QuestionKind = 'work' | 'actor' | 'character';

export interface Question {
  id: string;
  kind?: QuestionKind; // ausente = 'work'
  type: WorkType;
  difficulty: Difficulty;
  clueType: ClueType;
  /** Texto da pista (frase, emoji ou nome do personagem). */
  clue: string;
  /** Nome da obra exibido junto com o personagem (perguntas de ator). */
  workTitle?: string;
  /** Caminho da imagem quando clueType === 'image' (gerado pelo script do TMDB/IGDB). */
  imageUrl?: string;
  /** Versão sem o título impresso, usada na capa nítida quando disponível. */
  clearImageUrl?: string;
  /** Primeiro item é o título oficial (ou nome do ator); os demais são aliases aceitos. */
  answers: string[];
  year?: number;
}

export const QUESTIONS: Question[] = [
  // ---------- Filmes ----------
  { id: 'm01', type: 'movie', difficulty: 'easy', clueType: 'phrase', clue: 'Vou fazer uma oferta que ele não pode recusar.', answers: ['O Poderoso Chefão', 'The Godfather', 'Poderoso Chefão'], year: 1972 },
  { id: 'm02', type: 'movie', difficulty: 'easy', clueType: 'phrase', clue: 'Houston, temos um problema.', answers: ['Apollo 13', 'Apollo Treze'], year: 1995 },
  { id: 'm03', type: 'movie', difficulty: 'easy', clueType: 'phrase', clue: 'Que a força esteja com você.', answers: ['Star Wars', 'Guerra nas Estrelas', 'Star Wars: Uma Nova Esperança'], year: 1977 },
  { id: 'm04', type: 'movie', difficulty: 'easy', clueType: 'phrase', clue: 'Eu sou o rei do mundo!', answers: ['Titanic'], year: 1997 },
  { id: 'm05', type: 'movie', difficulty: 'hard', clueType: 'phrase', clue: 'Eu vi coisas que vocês não acreditariam.', answers: ['Blade Runner', 'Blade Runner: O Caçador de Androides', 'Blade Runner O Cacador de Androides'], year: 1982 },
  { id: 'm06', type: 'movie', difficulty: 'easy', clueType: 'phrase', clue: 'Com grandes poderes vêm grandes responsabilidades.', answers: ['Homem-Aranha', 'Spider-Man', 'Spiderman', 'Homem Aranha'], year: 2002 },
  { id: 'm07', type: 'movie', difficulty: 'easy', clueType: 'phrase', clue: 'Até o infinito e além!', answers: ['Toy Story', 'Toy Story: Um Mundo de Aventuras'], year: 1995 },
  { id: 'm08', type: 'movie', difficulty: 'easy', clueType: 'emoji', clue: '🦖🏝️', answers: ['Jurassic Park', 'Parque dos Dinossauros', 'Jurassic'], year: 1993 },
  { id: 'm09', type: 'movie', difficulty: 'easy', clueType: 'emoji', clue: '🚢🧊💔', answers: ['Titanic'], year: 1997 },
  { id: 'm10', type: 'movie', difficulty: 'easy', clueType: 'emoji', clue: '🦈🚤', answers: ['Tubarão', 'Jaws'], year: 1975 },
  { id: 'm11', type: 'movie', difficulty: 'easy', clueType: 'emoji', clue: '❄️👸⛄', answers: ['Frozen', 'Frozen: Uma Aventura Congelante', 'Frozen Uma Aventura Congelante'], year: 2013 },
  { id: 'm12', type: 'movie', difficulty: 'easy', clueType: 'emoji', clue: '🚀🕳️⏳', answers: ['Interestelar', 'Interstellar'], year: 2014 },
  { id: 'm13', type: 'movie', difficulty: 'hard', clueType: 'emoji', clue: '🦸🛡️👊', answers: ['Os Vingadores', 'Vingadores', 'The Avengers'], year: 2012 },
  { id: 'm14', type: 'movie', difficulty: 'easy', clueType: 'emoji', clue: '🧙⚡🦉', answers: ['Harry Potter e a Pedra Filosofal', 'Harry Potter', 'Harry Potter 1', 'HP1', 'Pedra Filosofal'], year: 2001 },
  { id: 'm15', type: 'movie', difficulty: 'hard', clueType: 'emoji', clue: '🟢🧅👑', answers: ['Shrek'], year: 2001 },

  // ---------- Séries ----------
  { id: 's01', type: 'series', difficulty: 'easy', clueType: 'phrase', clue: 'O inverno está chegando.', answers: ['Game of Thrones', 'A Guerra dos Tronos', 'GOT'], year: 2011 },
  { id: 's02', type: 'series', difficulty: 'easy', clueType: 'emoji', clue: '🔦🧇👾', answers: ['Stranger Things', 'Coisas Estranhas'], year: 2016 },
  { id: 's03', type: 'series', difficulty: 'easy', clueType: 'emoji', clue: '🎭🔫💰', answers: ['La Casa de Papel', 'Casa de Papel', 'Money Heist'], year: 2017 },
  { id: 's04', type: 'series', difficulty: 'easy', clueType: 'emoji', clue: '☕🛋️🍕', answers: ['Friends', 'Friends Série'], year: 1994 },
  { id: 's05', type: 'series', difficulty: 'hard', clueType: 'emoji', clue: '🧪🚐', answers: ['Breaking Bad'], year: 2008 },

  // ---------- Jogos ----------
  { id: 'g01', type: 'game', difficulty: 'easy', clueType: 'emoji', clue: '⛏️🟩🟫', answers: ['Minecraft'], year: 2011 },
  { id: 'g02', type: 'game', difficulty: 'easy', clueType: 'emoji', clue: '👻🟡🍒', answers: ['Pac-Man', 'Pacman', 'Pac Man'], year: 1980 },
  { id: 'g03', type: 'game', difficulty: 'easy', clueType: 'emoji', clue: '🟦🟥🟨', answers: ['Tetris'], year: 1984 },
  { id: 'g04', type: 'game', difficulty: 'easy', clueType: 'emoji', clue: '🏎️🍄🐢', answers: ['Mario Kart', 'Mario Kart 8 Deluxe', 'Mario Kart 8'], year: 1992 },
  { id: 'g05', type: 'game', difficulty: 'easy', clueType: 'emoji', clue: '🦔💍', answers: ['Sonic', 'Sonic the Hedgehog', 'Sonic o Ouriço'], year: 1991 },
  { id: 'g06', type: 'game', difficulty: 'hard', clueType: 'emoji', clue: '🔴🚀🔧', answers: ['Among Us'], year: 2018 },
  { id: 'g07', type: 'game', difficulty: 'easy', clueType: 'phrase', clue: 'Victory Royale!', answers: ['Fortnite'], year: 2017 },

  // ---------- Animes ----------
  { id: 'a01', type: 'anime', difficulty: 'easy', clueType: 'emoji', clue: '🍥🍜🦊', answers: ['Naruto', 'Naruto Shippuden'], year: 2002 },
  { id: 'a02', type: 'anime', difficulty: 'easy', clueType: 'emoji', clue: '🐉⭐🟠', answers: ['Dragon Ball', 'Dragon Ball Z', 'DBZ'], year: 1986 },
  { id: 'a03', type: 'anime', difficulty: 'easy', clueType: 'emoji', clue: '🧱👣', answers: ['Attack on Titan', 'Shingeki no Kyojin', 'Ataque dos Titãs'], year: 2013 },
  { id: 'a04', type: 'anime', difficulty: 'easy', clueType: 'emoji', clue: '📓🍎', answers: ['Death Note', 'Caderno da Morte'], year: 2006 },
];
