/// <reference types="vite/client" />

// Allow glob imports of markdown files as raw strings
declare module '*.md' {
  const content: string;
  export default content;
}
