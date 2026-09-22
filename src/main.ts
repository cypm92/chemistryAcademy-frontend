import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './assets/main.css'
import './assets/home-refinements.css'
import './assets/legal.css'
import './assets/form-consent.css'

createApp(App).use(router).mount('#app')
