/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@prisma/client'],
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
    // Alias to false on both client and server to prevent runtime requires
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      jsdom: false,
      'jest-environment-jsdom': false,
      'parse5': false,
    }
    
    // Rely on alias/fallback instead of null-loader to avoid runtime type errors
    
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
