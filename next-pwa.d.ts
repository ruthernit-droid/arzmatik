declare module 'next-pwa' {
  import { NextConfig } from 'next';
  const NextPWA: (options: {
    dest?: string;
    register?: boolean;
    skipWaiting?: boolean;
    disable?: boolean;
    publicExports?: Record<string, boolean>;
    buildExcludes?: RegExp[];
    cacheOnFrontEndNav?: boolean;
    aggressiveFrontEndNavCaching?: boolean;
    reloadOnOnline?: boolean;
    swcMinify?: boolean;
    disableDevLogs?: boolean;
  }) => (nextConfig: NextConfig) => NextConfig;
  export default NextPWA;
}
