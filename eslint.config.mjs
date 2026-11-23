import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'static/**/*', '.venv/**/*'],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];
