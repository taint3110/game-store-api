module.exports = {
  extends: '@loopback/eslint-config',
  rules: {
    'array-callback-return': 'error',
    'consistent-return': 'error',
    'no-else-return': ['error', { allowElseIf: false }],
    'no-return-assign': ['error', 'always'],
    'no-shadow': 'off',
    '@typescript-eslint/no-shadow': ['error', { builtinGlobals: false, hoist: 'all', allow: [] }],
    eqeqeq: 'error',
    'no-floating-decimal': 'error',
    'no-multi-spaces': 'error',
    'no-return-await': 'error',
    'no-self-compare': 'error',
    'no-throw-literal': 'error',
    'no-useless-return': 'error',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars-experimental': 'error',
    '@typescript-eslint/naming-convention': 'off'
  },
  parserOptions: {
    project: './tsconfig.eslint.json'
  }
}
