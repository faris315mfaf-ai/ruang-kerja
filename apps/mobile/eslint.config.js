// ESLint flat config — preset Expo (eslint-config-expo).
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  ...expoConfig,
  globalIgnores(['dist/', '.expo/', 'node_modules/']),
]);
