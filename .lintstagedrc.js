// Note: typed ESLint rules (strictTypeChecked) require a full TS build
// context and do not work reliably against individually staged files in
// git worktrees.  Run `pnpm lint` for a full typed check.  Pre-commit
// only enforces formatting so it stays fast and always succeeds.
export default {
  '*.{ts,tsx,js,jsx,mjs,cjs}': ['prettier --write'],
  '*.{json,md,yaml,yml}': ['prettier --write'],
};
