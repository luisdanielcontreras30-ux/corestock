import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Comodín genérico, no un proyecto específico: cada negocio que usa
    // CoreStock corre su propio proyecto de Supabase (NEXT_PUBLIC_SUPABASE_URL
    // en su .env.local), así que las imágenes que suben (logo, fotos de
    // producto) siempre viven en *.supabase.co pero con un subdominio
    // distinto por cuenta.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
