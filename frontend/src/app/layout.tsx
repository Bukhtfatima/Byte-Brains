import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import { WebSocketProvider } from "@/lib/useWebSocket";
import RealtimeToastListener from "@/components/RealtimeToastListener";
import "./globals.css";

export const metadata: Metadata = {
  title: "BloodBridge — AI-Powered Blood Inventory & Emergency Coordination",
  description:
    "An intelligent blood inventory, prediction, and emergency coordination platform that helps blood banks and hospitals monitor supply, predict demand, identify shortage risks, and respond to urgent requests.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col antialiased">
        <WebSocketProvider>
          <Navbar />
          <main className="flex-1 bg-slate-100 dark:bg-slate-950">{children}</main>
          <RealtimeToastListener />
        </WebSocketProvider>
      </body>
    </html>
  );
}
