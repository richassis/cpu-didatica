import type { NextConfig } from "next";

/**
 * The authoring surface is on for `next dev` and off for `next build`.
 *
 * Set NEXT_PUBLIC_ENABLE_EDITOR=1 explicitly to get a production build that
 * still carries it — that is how you exercise the published bundle without
 * giving up the editor.
 *
 * This lives here rather than in a .env file because `.env*` is gitignored: a
 * flag that decides what ships to students has to be versioned with the code.
 */
const editorEnabled =
  process.env.NEXT_PUBLIC_ENABLE_EDITOR === "1" || process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_ENABLE_EDITOR: editorEnabled ? "1" : "0",
  },
};

export default nextConfig;
