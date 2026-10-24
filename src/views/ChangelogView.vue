<script setup lang="ts">
import { RouterLink } from 'vue-router';
import BrandLogo from '../components/BrandLogo.vue';
import { CHANGELOG } from '../data/changelog';
</script>

<template>
  <main class="app">
    <header class="brand">
      <BrandLogo />
      <h1>Novidades</h1>
    </header>

    <RouterLink class="back" to="/">← Hub de jogos</RouterLink>

    <section class="card changelog">
      <article v-for="entry in CHANGELOG" :key="entry.version">
        <h2>{{ entry.version }}</h2>
        <p class="muted small">{{ entry.date }}</p>
        <div v-for="section in entry.sections" :key="section.title">
          <h3>{{ section.title }}</h3>
          <ul>
            <li v-for="item in section.items" :key="item">{{ item }}</li>
          </ul>
        </div>
      </article>
    </section>
  </main>
</template>
