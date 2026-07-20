/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the file-tracing root to web/ so Next doesn't infer the monorepo parent (which holds
  // other lockfiles) as the workspace root.
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
