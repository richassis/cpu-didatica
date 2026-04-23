import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Opções principais agora */
  allowedDevOrigins: ['local-origin.dev', '*.local-origin.dev', '192.168.0.12'],

  // Se houver outras opções experimentais, mantenha o bloco:
  // experimental: { ... }
};

export default nextConfig;
