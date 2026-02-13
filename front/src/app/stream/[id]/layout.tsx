import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stream Details - Ant Media POS",
};

export default function StreamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
