/// <reference types="vite/client" />

declare const __PFSF_LOCAL__: boolean;
declare const __PFSF_REPO__: string;
declare const __PFSF_REF__: string;

declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<object, object, unknown>;
  export default component;
}
