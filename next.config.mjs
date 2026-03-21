const isGithubPages = process.env.GITHUB_ACTIONS === 'true';
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  basePath: isGithubPages && repoName ? `/${repoName}` : '',
  assetPrefix: isGithubPages && repoName ? `/${repoName}/` : ''
};

export default nextConfig;
