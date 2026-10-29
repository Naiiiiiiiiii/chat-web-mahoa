import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../context/auth.context";

export const metadata: Metadata = {
  title: "Secure Chat - Ứng dụng nhắn tin bảo mật",
  description: "Ứng dụng nhắn tin bảo vệ quyền riêng tư và mã hóa đầu-cuối",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased bg-slate-950 text-slate-100 min-h-screen">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
