"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
      <div className="flex items-center gap-3">
        {/* Visual Brand Icon */}
        <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-md shadow-blue-100">
          in
        </div>
        <h1 className="text-xl font-normal text-gray-800 tracking-wide">
          <span className="font-semibold text-blue-600">LinkedIn</span> Career Suite
        </h1>
      </div>
      
      <nav className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto">
        <Link
          href="/"
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            pathname === "/"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-50/50"
          }`}
        >
          🤖 Bullshit Translator
        </Link>
        <Link
          href="/job-checker"
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            pathname === "/job-checker"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-50/50"
          }`}
        >
          🎯 Job Match Analyzer
        </Link>
        <Link
          href="/job-history"
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            pathname === "/job-history"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-50/50"
          }`}
        >
          History
        </Link>
      </nav>
    </header>
  );
}
