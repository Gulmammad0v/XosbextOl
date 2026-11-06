// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
    rules: {
      // Initial API requests intentionally populate local screen state after awaiting the backend.
      "react-hooks/set-state-in-effect": "off",
    },
  }
]);
