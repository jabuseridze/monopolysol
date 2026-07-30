/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Compile the shared workspace package (it ships raw TypeScript).
  transpilePackages: ["@monopoly-sol/shared"],
  webpack: (config) => {
    // Some Solana/wallet deps reference optional node modules; stub them for the browser.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
