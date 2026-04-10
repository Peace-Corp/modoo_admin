import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  /**
   * Vercel/서버리스에서 파일 추적 시 @sparticuz/chromium 의 brotli 바이너리가
   * 람다 패키지에 빠지면 executablePath 가 실패하고 PDF 첨부가 조용히 누락됩니다.
   */
  outputFileTracingIncludes: {
    "/api/admin/invoices": [
      "./node_modules/@sparticuz/chromium/**/*",
      "./node_modules/@fontsource/noto-sans-kr/**/*",
    ],
    "/api/admin/invoices/[id]/resend": [
      "./node_modules/@sparticuz/chromium/**/*",
      "./node_modules/@fontsource/noto-sans-kr/**/*",
    ],
  },
};

export default nextConfig;
