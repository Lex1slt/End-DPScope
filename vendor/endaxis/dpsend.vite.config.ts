// DPS-END 计算专用 Vite 配置。
//
// 模拟器 harness 只跑 TS 逻辑（不渲染 Vue 组件），所以这里刻意不引入
// @vitejs/plugin-vue / vue-devtools，使运行依赖从 299MB 降到 ~23MB。
// 与上游 vite.config.ts 保持一致的只有 `@` -> ./src 别名。
import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [],
  resolve: {
    alias: [
      // element-plus 只提供界面组件，计算流程用不到；它只是被 i18n 引用链捎带进来的。
      {
        find: /^element-plus\/es\/locale\/lang\/.*$/,
        replacement: fileURLToPath(
          new URL('./dpsend-elementplus-locale-stub.ts', import.meta.url),
        ),
      },
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url)),
      },
    ],
  },
  // 内联 TS 编译选项，避免去读上游 tsconfig.app.json（它 extends @vue/tsconfig，
  // 而计算场景用不到 Vue 的那套配置）。
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        target: 'es2022',
        module: 'esnext',
        moduleResolution: 'bundler',
        useDefineForClassFields: true,
        verbatimModuleSyntax: false,
      },
    },
  },
});
