export interface ChangelogEntry {
  version: string;
  date: string;
  /** Agrupado por área (jogo ou geral). */
  sections: { title: string; items: string[] }[];
}

/** Mais recente primeiro. Ao lançar uma versão, adicione uma entrada aqui (ver AGENTS.md). */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: 'Claudio Games 1.1',
    date: '2026-10-26',
    sections: [
      {
        title: 'Bombsquads (prévia)',
        items: [
          'Ranking ao fim da partida: classificação por pontos (rodadas vencidas), quem está pronto e o vencedor em destaque.',
          'Jogar de novo com as mesmas configurações, ou ajustar as configurações antes. Cada jogador marca que está pronto e o anfitrião inicia.',
          'Avisos de "Preparar!", "Vitória da rodada" e fechamento maiores, com animação.',
          'Recarregar a página no meio da partida volta para a partida, em vez de cair na tela de entrada.',
          'Correção: os jogadores passam a andar e colocar bombas (o controle local estava desligado).',
          'Correção: o fogo das explosões volta a aparecer e a tela não trava mais depois de uma explosão.',
          'Correção: os itens das caixas aparecem com ícone.',
          'Correção: placar e botão Sair deixam de se sobrepor ao contador de rodada.',
        ],
      },
    ],
  },
  {
    version: 'Claudio Games 1.0',
    date: '2026-10-24',
    sections: [
      {
        title: 'Geral',
        items: [
          'Nome novo: Claudio Games, com um logo que é uma paródia (óculos e bigode).',
          'Convite por link em todos os jogos online: quem abre o link entra direto na sala.',
          'Lista de jogadores na sala, com presença (quem caiu aparece como desconectado).',
          'Aba de novidades (esta página).',
          'Aviso em vermelho durante partidas online quando alguém abre as ferramentas de desenvolvedor (F12). É um aviso, não uma prova de trapaça.',
          'Correção: o criador da sala às vezes não virava host quando a entrada era simultânea.',
        ],
      },
      {
        title: 'Bomb Party',
        items: [
          'Balão de fala: a última tentativa aparece ao lado do jogador, e o que está sendo digitado aparece ao vivo.',
          'Aceleração: cada acerto seguido encurta o tempo do turno (até 3 s). Configurável no lobby e pelo host depois da partida.',
          'Barra de escrita sempre visível. Fica habilitada e com foco na sua vez. Enter envia e limpa a caixa.',
          'Erro não passa a vez: você continua chutando até o tempo acabar.',
          'Tempo estourado tira uma vida e manda a mesma sílaba para o próximo jogador.',
        ],
      },
      {
        title: 'Qual é a Obra',
        items: [
          'Respostas aceitam "&" como "e" e o título principal antes de ":" ou traço.',
          'Sufixos de temporada, parte e ano são ignorados na comparação (ex.: "Final Season", "Parte 2", "(2010)").',
          'Capas nítidas em 761 das 800 obras; as demais continuam com fundo desfocado.',
          'Lista de jogadores e convite por link no lobby.',
        ],
      },
      {
        title: 'Termo',
        items: [
          'Backspace apaga a letra do cursor, não só a última.',
          'Lista de jogadores e convite por link no lobby.',
        ],
      },
      {
        title: 'Bombsquads (prévia)',
        items: [
          'Novo jogo: arena 3D de bombas para até 10 jogadores, com servidor dedicado (Cloudflare). Sala por código, configurações do anfitrião e fechamento da arena no fim de cada rodada.',
          'A rota é /bombsquads; o ícone aparece no hub.',
          'No lobby, quem cai continua no lugar por um minuto (aparece como desconectado) e volta recarregando a página.',
        ],
      },
      {
        title: 'Onde Estou?',
        items: [
          'Mapa com nomes em inglês (MapTiler), em vez do nome local (ex.: japonês).',
          'Região fotografada: escolha Brasil, Europa, Américas (sem Brasil), Ásia/Oceania/África ou o mundo inteiro.',
          'Área do sorteio: Cidade (~25 km do centro) ou Bairro (~3 km), para deixar a partida mais difícil.',
          'Lista de jogadores e convite por link no lobby.',
        ],
      },
    ],
  },
];
