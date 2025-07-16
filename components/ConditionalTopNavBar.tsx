"use client";
import { usePathname } from "next/navigation";
import TopNavBar from "./TopNavBar";

export default function ConditionalTopNavBar() {
  const pathname = usePathname();
  if (pathname.startsWith("/login")) return null;
  return <TopNavBar />;
} 