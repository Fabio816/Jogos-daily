import { createRouter, createWebHistory } from 'vue-router';
import HubView from './views/HubView.vue';
import QuizView from './views/QuizView.vue';
import TermoView from './views/TermoView.vue';
import BombView from './views/BombView.vue';
import OndeEstouView from './views/OndeEstouView.vue';
import LoginView from './views/LoginView.vue';
import { isUnlocked } from './lib/gate';

// Os links antigos com ?sala=CODIGO continuam funcionando na rota do quiz.
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/entrar', name: 'login', component: LoginView },
    { path: '/', name: 'hub', component: HubView },
    { path: '/qual-e-a-obra', name: 'quiz', component: QuizView },
    { path: '/termo', name: 'termo', component: TermoView },
    { path: '/bomb-party', name: 'bomb', component: BombView },
    { path: '/onde-estou', name: 'onde', component: OndeEstouView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach((to) => {
  const unlocked = isUnlocked();
  if (!unlocked && to.name !== 'login') {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (unlocked && to.name === 'login') {
    return { name: 'hub' };
  }
  return true;
});
