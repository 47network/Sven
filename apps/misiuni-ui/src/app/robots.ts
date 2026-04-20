import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin47', '/healthz', '/v1/'],
    },
    sitemap: 'https://misiuni.ro/sitemap.xml',
    host: 'https://misiuni.ro',
  };
}
