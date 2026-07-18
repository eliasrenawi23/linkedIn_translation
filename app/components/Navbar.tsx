"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();
  const links = [
    { href: "/", icon: "⌁", label: "Translator" },
    { href: "/job-checker", icon: "◎", label: "Job Match" },
    { href: "/model-review", icon: "◈", label: "Reviews" },
    { href: "/job-history", icon: "◷", label: "History" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 shadow-[0_1px_12px_rgba(15,23,42,0.04)] backdrop-blur-xl">
      <div className="app-container flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-lg font-extrabold text-white shadow-lg shadow-blue-200/60">
            in
          </div>
          <div className="min-w-0">
            <p className="truncate text-[0.65rem] font-extrabold uppercase tracking-[0.18em] text-blue-600">LinkedIn</p>
            <h1 className="truncate text-base font-bold tracking-tight text-slate-800 sm:text-lg">Career Suite</h1>
          </div>
        </div>
        <nav aria-label="Primary navigation" className="grid w-full grid-cols-4 gap-1 rounded-xl border border-slate-200/80 bg-slate-100/80 p-1 sm:w-auto">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold transition-all sm:px-4 sm:text-sm ${
                  active
                    ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200/70"
                    : "text-slate-500 hover:bg-white/60 hover:text-slate-800"
                }`}
              >
                <span aria-hidden="true" className="text-base leading-none">{link.icon}</span>
                <span className="truncate">{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
