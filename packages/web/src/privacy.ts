import { loadJson } from './state/persist';
import './style.css';
import './privacy.css';
import './fonts';

document.documentElement.dataset.theme =
  loadJson('pfsf:site-theme', { value: 'dark' }).value === 'light' ? 'light' : 'dark';
