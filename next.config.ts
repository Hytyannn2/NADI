import type { NextConfig } from "next";

const cspHeader = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://translate.google.com https://translate.googleapis.com",
  "style-src 'self' 'unsafe-inline' https://translate.googleapis.com https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://*.openstreetmap.org https://*.open-meteo.com https://*.supabase.co https://api.mapbox.com https://ui-avatars.com https://*.googleusercontent.com https://translate.google.com https://www.google.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.open-meteo.com https://publicinfobanjir.water.gov.my https://translate.googleapis.com",
  "frame-src 'self'",
].join('; ');

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: '/(favicon.ico|favicon.jpg|icon.jpg|logo.png|images/.*|manifest.json|llms.txt)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader,
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=(self)',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
