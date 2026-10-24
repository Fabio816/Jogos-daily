<script setup lang="ts">
import { RouterLink } from 'vue-router';
import BrandLogo from '../components/BrandLogo.vue';
import RankingPanel from '../components/RankingPanel.vue';

interface GameCard {
  title: string;
  desc: string;
  icon: string;
  color: string;
  to?: string;
  href?: string;
}

const GAMES: GameCard[] = [
  {
    to: '/qual-e-a-obra',
    title: 'Qual é a Obra?',
    desc: 'Capas, frases e emojis. Filme, série, jogo, anime e elenco.',
    icon: '🎬',
    color: 'yellow',
  },
  {
    to: '/termo',
    title: 'Termo',
    desc: 'Palavras de 5 letras. Solo, sala e ranking.',
    icon: '🟩',
    color: 'pink',
  },
  {
    to: '/bomb-party',
    title: 'Bomb Party',
    desc: 'Sílabas, vidas e uma bomba com tempo.',
    icon: '💣',
    color: 'lilac',
  },
  {
    to: '/onde-estou',
    title: 'Onde Estou?',
    desc: 'Foto de rua, mapa e um palpite no lugar certo.',
    icon: '🌍',
    color: 'cyan',
  },
  {
    href: 'https://connectthestars.xyz/',
    title: 'Connect the Stars',
    desc: 'Ligue as estrelas e descubra o desenho escondido.',
    icon: '✨',
    color: 'sand',
  },
  {
    href: 'https://stopots.com/pt',
    title: 'Stop',
    desc: 'Adedonha online: categorias, letras e rapidez.',
    icon: '🛑',
    color: 'rose',
  },
  {
    href: 'https://gartic.io/',
    title: 'Gartic',
    desc: 'Desenhe e adivinhe com a galera em salas online.',
    icon: '🎨',
    color: 'sage',
  },
  {
    href: 'https://garticphone.com/pt',
    title: 'Gartic Phone',
    desc: 'Telefone sem fio com desenhos e muita risada.',
    icon: '📞',
    color: 'orange',
  },
  {
    href: 'https://toontone.games/',
    title: 'Acertar a Cor',
    desc: 'Acerte a cor do desenho. Um desafio novo por dia.',
    icon: '🌈',
    color: 'rose',
  },
  {
    href: 'https://play.bomberman.fans/hub.html',
    title: 'Bomberman',
    desc: 'Arena online de Bomberman com salas e partidas.',
    icon: '💥',
    color: 'orange',
  },
];
</script>

<template>
  <main class="app hub">
    <header class="brand">
      <BrandLogo />
      <h1>Claudio Games</h1>
      <p class="sub">Escolha um jogo e divirta-se com a galera.</p>
      <RouterLink class="changelog-link" to="/novidades">Novidades da versão →</RouterLink>
    </header>

    <section class="window">
      <div class="window-grid">
        <div class="panel">
          <h2>Jogue agora</h2>
          <div class="play-buttons">
            <component
              :is="game.to ? RouterLink : 'a'"
              v-for="game in GAMES"
              :key="game.title"
              :to="game.to"
              :href="game.href"
              :target="game.href ? '_blank' : undefined"
              :rel="game.href ? 'noopener noreferrer' : undefined"
              :title="game.href ? 'Abre em nova aba' : undefined"
              class="play-btn"
              :class="[game.color, { external: !!game.href }]"
            >
              <span class="icon" aria-hidden="true">{{ game.icon }}</span>
              <span>
                <span class="title">{{ game.title }}</span>
                <span class="desc">{{ game.desc }}</span>
              </span>
            </component>
          </div>
        </div>

        <div class="panel">
          <RankingPanel title="Ranking geral" />
        </div>
      </div>
    </section>

    <p class="foot">Pontos dos jogos da turma contam no ranking geral. Os cards com ↗ abrem outro site.</p>
  </main>
</template>
