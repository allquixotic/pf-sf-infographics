import { createApp } from 'vue';
import App from './App.vue';
import './style.css';

// The UI uses the same typefaces as the infographic, served from the content folder.
const fonts: [string, string, string][] = [
  ['Ultra', 'content/shared/fonts/Ultra-Regular.ttf', '400'],
  ['Lexend', 'content/shared/fonts/Lexend-Regular.ttf', '400'],
  ['Lexend', 'content/shared/fonts/Lexend-Bold.ttf', '700'],
];
for (const [family, path, weight] of fonts) {
  const face = new FontFace(family, `url(${import.meta.env.BASE_URL}${path})`, { weight, display: 'swap' });
  face.load().then(
    (f) => document.fonts.add(f),
    () => {},
  );
}

createApp(App).mount('#app');
