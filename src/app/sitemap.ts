import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

/** Páginas de la plataforma. (Fase 2: incluir catálogos publicados.) */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: env.siteUrl, changeFrequency: 'weekly', priority: 1 },
    { url: `${env.siteUrl}/demo`, changeFrequency: 'monthly', priority: 0.6 },
  ];
}
