import {defineConfig} from 'vite';

// The Studio UI. Started by server/index.ts in middleware mode.
// public/ is shared with Remotion, so staticFile() paths work in both.
export default defineConfig({
  publicDir: 'public',
  // Vite compiles JSX itself from tsconfig.json ("jsx": "react-jsx").
  server: {watch: {ignored: ['**/out/**', '**/storyboards/**', '**/public/voiceover/**']}},
});
