import { fileURLToPath } from "node:url";

const nextConfig = {
  turbopack: {
    root: fileURLToPath(new URL(".", import.meta.url))
  },
  reactStrictMode: true
};

export default nextConfig;
