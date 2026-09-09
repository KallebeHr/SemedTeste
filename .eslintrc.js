module.exports = {
  root: true,
  env: { browser: true, node: true, es2022: true },
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  extends: ["plugin:vue/vue3-essential", "eslint:recommended"],
  rules: {
    "vue/multi-word-component-names": "off",
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }]
  }
};
