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
      // ImageKit — where the newsroom's real cover art now lives. Without this entry every
      // cover 400s through /_next/image while still displaying fine in the admin, because the
      // admin renders plain <img> (no optimiser, no allow-list) and the public site does not.
      // Scoped to our own ImageKit account so the optimiser can't be used as an open proxy for
      // arbitrary ImageKit content.
      { protocol: "https", hostname: "ik.imagekit.io", pathname: "/Brandish1305/**" },
      // Placeholder covers for demo/seed posts (scripts/seedPosts.ts). Remove once no seeded
      // post remains — real media belongs on ImageKit above.
      { protocol: "https", hostname: "loremflickr.com" },
    ],
  },
};

export default nextConfig;
