import createNextIntlPlugin from "next-intl/plugin";

const avecNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@navex/contracts"],
};

export default avecNextIntl(nextConfig);
