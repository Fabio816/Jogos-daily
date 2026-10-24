<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BrandLogo from '../components/BrandLogo.vue';
import { unlock } from '../lib/gate';

const route = useRoute();
const router = useRouter();
const password = ref('');
const error = ref('');
const input = ref<HTMLInputElement | null>(null);

function submit() {
  if (unlock(password.value)) {
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    router.replace(redirect.startsWith('/') ? redirect : '/');
    return;
  }
  error.value = 'Senha incorreta. Tente de novo.';
  password.value = '';
  input.value?.focus();
}
</script>

<template>
  <main class="app login">
    <header class="brand">
      <BrandLogo />
      <h1>Claudio Games</h1>
      <p class="sub">Área da turma. Digite a senha para entrar.</p>
    </header>

    <section class="card">
      <form class="login-form" @submit.prevent="submit">
        <label>
          Senha
          <input
            ref="input"
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            autofocus
          />
        </label>
        <p v-if="error" class="bad" role="alert">{{ error }}</p>
        <button type="submit">Entrar</button>
      </form>
    </section>
  </main>
</template>
