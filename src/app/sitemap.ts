import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nadi-kelantan.app';
  const lastModified = new Date();

  return [
    {
      url: baseUrl,
      lastModified,
      changeFrequency: 'always',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/?tab=aduan`,
      lastModified,
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/?tab=bencana`,
      lastModified,
      changeFrequency: 'always',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/?tab=bantuan`,
      lastModified,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/?tab=komuniti`,
      lastModified,
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ];
}
