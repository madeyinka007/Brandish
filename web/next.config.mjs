/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the file-tracing root to web/ so Next doesn't infer the monorepo parent (which holds
  // other lockfiles) as the workspace root.
  outputFileTracingRoot: import.meta.dirname,
  images: {
    // Post cover images are served from S3/CloudFront (see docs/aws-infrastructure.md); editors
    // may also add media by URL. Allow the CDN + AWS hosts and the brand domain.
    remotePatterns: [
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "**.amazonaws.com" },
      // The live site is brandish.africa. This previously read brandish.com.ng, which matches
      // nothing we serve — any cover image hosted on our own domain was rejected by the
      // optimiser with a 400.
      { protocol: "https", hostname: "**.brandish.africa" },
      { protocol: "https", hostname: "brandish.africa" },
      // Placeholder covers for demo/seed posts (scripts/seedPosts.ts). Replace these with real
      // S3/CloudFront media as the newsroom publishes; the entry can go once none remain.
      { protocol: "https", hostname: "loremflickr.com" },
    ],
  },
};

export default nextConfig;
