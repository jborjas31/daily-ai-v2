"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/today", label: "Today" },
  { href: "/library", label: "Library" },
  { href: "/settings", label: "Settings" },
];

export default function AppNav() {
  const pathname = usePathname() || "/";
  return (
    <nav className="w-full border-b border-black/5 dark:border-white/10 bg-transparent">
      <div className="mx-auto max-w-6xl px-4">
        <ul className="flex gap-2 py-2">
          {links.map((l) => {
            const active = pathname.startsWith(l.href);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={
                    "px-3 py-1.5 rounded-md text-sm " +
                    (active
                      ? "bg-blue-600 text-white"
                      : "hover:bg-black/5 dark:hover:bg-white/10 text-black/80 dark:text-white/80")
                  }
                  aria-current={active ? "page" : undefined}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

