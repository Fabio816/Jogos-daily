import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import { router } from './router';
import { initTheme } from './lib/theme';
import { unlockFromQuery } from './lib/gate';

initTheme();
if (import.meta.env.DEV) unlockFromQuery();
createApp(App).use(router).mount('#app');
