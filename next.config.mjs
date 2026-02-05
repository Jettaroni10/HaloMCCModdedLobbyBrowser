/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Allow Firebase Storage + Google-hosted avatars in both local and Netlify.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
