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
      { protocol: "https", hostname: "**.brandish.com.ng" },
      { protocol: "https", hostname: "brandish.com.ng" },
      { protocol: "https", hostname: "picsum.photos" }, // placeholder cover images (seed data)
    ],
  },
};

export default nextConfig;
