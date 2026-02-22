import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RondaFlow",
    short_name: "RondaFlow",
    description: "Checklist de ronda TI com fotos, auditoria e localização",
    start_url: "/login",
    display: "standalone",
    background_color: "#090d19",
    theme_color: "#0b1020",
    lang: "pt-BR",
    icons: [
      {
        src: "/icon?size=192",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/icon?size=512",
        sizes: "512x512",
        type: "image/png"
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png"
      }
    ]
  };
}
