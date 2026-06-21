const nextConfig = {
  serverExternalPackages: ["webtorrent"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "s4.anilist.co",
      },
      {
        protocol: "https",
        hostname: "img1.ak.crunchyroll.com",
      },
    ],
  },
};

export default nextConfig;
