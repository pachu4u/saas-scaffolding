/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'chore', 'ci', 'revert'],
    ],
    'scope-enum': [
      1,
      'always',
      [
        'web', 'workers', 'db', 'auth', 'authz', 'tenant', 'billing',
        'scim', 'notifications', 'logger', 'observability', 'config',
        'ui', 'infra', 'ci', 'deps',
      ],
    ],
  },
};
