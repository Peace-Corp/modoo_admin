import type { Metadata } from "next";
import "./globals.css";
import AdminLayout from "@/components/AdminLayout";
import SWRProvider from "@/components/SWRProvider";

export const metadata: Metadata = {
  title: "모두의 유니폼 | 관리자 페이지",
  description: "모두 앱 관리자 페이지",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SWRProvider>
          <AdminLayout>{children}</AdminLayout>
        </SWRProvider>
      </body>
    </html>
  );
}
