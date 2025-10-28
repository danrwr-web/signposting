/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@prisma/client', 'jsdom', 'jest-environment-jsdom'],
  webpack: (config, { isServer }) => {
    // Exclude jsdom from bundling completely
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
      jsdom: false,
      'parse5': false,
    };
    
    // Prevent jsdom from being imported
    config.externals = config.externals || [];
    if (!isServer) {
      // For client-side, mark as external or false
      config.externals.push({
        'jsdom': false,
        'jest-environment-jsdom': false,
        'parse5': false,
      });
    } else {
      // For server-side, mark as external
      config.externals.push({
        'jsdom': 'commonjs jsdom',
        'jest-environment-jsdom': 'commonjs jest-environment-jsdom',
      });
    }
    
    // Ignore jsdom completely during bundling
    config.module.rules.push({
      test: /node_modules\/jsdom/,
      use: 'null-loader',
    });
    
    return config;
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig
