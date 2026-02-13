import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Broadcast - Ant Media POS",
};

export default function BroadcastLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
