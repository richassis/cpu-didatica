/**
 * editorFlag.ts
 *
 * The one place that answers "does this build carry the authoring surface?".
 *
 * Edit mode is a developer tool: positioning components, wiring them, and
 * configuring each block. The published app is only the simulator, so every
 * authoring affordance hangs off this constant.
 *
 * `next.config.ts` sets NEXT_PUBLIC_ENABLE_EDITOR, which Next inlines at build
 * time — so this folds to a literal and the guarded branches are dead code the
 * bundler can drop. It is written as a comparison rather than a hardcoded
 * `false` on purpose: a literal would narrow every guarded branch to `never`
 * and stop TypeScript from checking the code inside it.
 */
export const EDITOR_ENABLED = process.env.NEXT_PUBLIC_ENABLE_EDITOR === "1";
