"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { nav } from "@/lib/site";

const navIcons = {
  "/legis": "m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7",
  "/legis/proposicoes":
    "M8 3H5v18h14V3h-3M9 3h6v4H9zM8 11h8M8 15h8M8 19h5",
  "/legis/partidos":
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  "/legis/agenda":
    "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2z",
  "/radar":
    "M12 2v2M12 20v2M2 12h2M20 12h2M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z",
} satisfies Record<(typeof nav)[number]["href"], string>;

export function SiteNavigation() {
  const pathname = usePathname();

  return (
    <nav className="site-nav" aria-label="Principal">
      {nav.map((item) => {
        const ativo =
          pathname === item.href ||
          (item.href !== "/legis" && pathname.startsWith(`${item.href}/`));

        return (
          <Link key={item.href} href={item.href} aria-current={ativo ? "page" : undefined}>
            <svg
              className="site-nav-icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={navIcons[item.href]} />
            </svg>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
