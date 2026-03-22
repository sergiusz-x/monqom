module.exports = {
    root: true,
    ignorePatterns: ['.eslintrc.cjs'],
    env: {
        node: true,
        jest: true,
    },
    overrides: [
        {
            files: ['**/*.ts'],
            parser: '@typescript-eslint/parser',
            parserOptions: {
                project: ['./tsconfig.json'],
                tsconfigRootDir: __dirname,
                sourceType: 'module',
            },
            plugins: ['@typescript-eslint/eslint-plugin'],
            extends: ['plugin:@typescript-eslint/recommended', 'prettier'],
            rules: {},
        },
    ],
}
