// element-plus 语言包的占位实现。
//
// Endaxis 的 src/i18n/elementPlusLocale.ts 会 import element-plus 的 locale JSON，
// 而 element-plus 只用于界面组件（57MB），计算 harness 完全用不到 —— 它只是顺着
// `@/data/*` -> `@/i18n` 的引用链被捎带进来。这里用一个空壳替换掉，
// 使运行依赖从 299MB 降到约 43MB。
export default {
  name: 'dpsend-stub',
  el: {},
};
