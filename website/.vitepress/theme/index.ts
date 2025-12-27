// Custom theme extending VitePress default theme
// https://vitepress.dev/guide/custom-theme

import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';

export default {
  extends: DefaultTheme,
  // Add custom enhancements here:
  // - Custom components: enhanceApp({ app }) { app.component('MyComponent', MyComponent) }
  // - Custom CSS: import './custom.css'
  // - Custom layout slots: Layout wrapper component
} satisfies Theme;
