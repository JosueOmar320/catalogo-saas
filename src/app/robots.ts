import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/dashboard', '/admin', '/cuenta', '/preview', '/api'] },
    sitemap: `${env.siteUrl}/sitemap.xml`,
  };
}
