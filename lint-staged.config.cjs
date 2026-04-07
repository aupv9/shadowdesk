// lint-staged configuration
//
// We can't run `tsc -p tsconfig.*.json` against individual staged files because
// `tsc` rejects extra positional args when `-p` is used. Instead, when any TS
// file is staged we trigger the full project-wide typecheck. The function form
// returns the command string so lint-staged does NOT auto-inject the file list.
//
// This still satisfies the spirit of the rule: typecheck blocks the commit if
// the staged TS changes break either subproject.
module.exports = {
  '*.{ts,tsx}': () => 'npm run typecheck'
}
