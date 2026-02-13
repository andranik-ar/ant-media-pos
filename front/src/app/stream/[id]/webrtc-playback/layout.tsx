import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Watch Stream - Ant Media POS",
};

export default function PlaybackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
