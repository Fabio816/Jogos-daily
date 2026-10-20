import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import { router } from './router';
import { initTheme } from './lib/theme';

initTheme();
createApp(App).use(router).mount('#app');
