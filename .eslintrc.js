// eslint-disable-next-line no-undef
module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        // eslint-disable-next-line no-undef,  @typescript-eslint/no-unsafe-assignment
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.json'],
    },
    plugins: ['@typescript-eslint'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
        'prettier/@typescript-eslint',
    ],
    rules: {
        '@typescript-eslint/array-type': ['error', {default: 'array-simple'}],
        '@typescript-eslint/consistent-type-assertions': [
            'error',
            {assertionStyle: 'angle-bracket', objectLiteralTypeAssertions: 'allow-as-parameter'},
        ],
        '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
        '@typescript-eslint/explicit-function-return-type': ['error'],
        '@typescript-eslint/explicit-member-accessibility': [
            'error',
            {
                accessibility: 'explicit',
                overrides: {
                    constructors: 'no-public',
                },
            },
        ],
        '@typescript-eslint/method-signature-style': ['error'],
        camelcase: 'off',
        '@typescript-eslint/naming-convention': [
            'error',
            {
                selector: 'typeParameter',
                format: ['PascalCase'],
                prefix: ['T'],
            },
            {
                selector: 'interface',
                format: ['PascalCase'],
                custom: {
                    regex: '^I[A-Z].+',
                    match: true,
                },
            },
        ],
        '@typescript-eslint/no-base-to-string': ['error'],
        '@typescript-eslint/prefer-for-of': ['error'],
        '@typescript-eslint/type-annotation-spacing': ['error'],
    },
};
