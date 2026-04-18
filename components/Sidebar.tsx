"use client";

import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";

const NAV_ITEMS = [
  { href: "/", icon: "🖥", label: "Simulator" },
  { href: "/config", icon: "⚙", label: "Configuration" },
];

export default function Sidebar() {
  const { pathname } = useLocation();

  // On desktop, open by default; on mobile, closed by default
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = (e: MediaQueryListEvent | MediaQueryList) => {
      const mobile = e.matches;
      setIsMobile(mobile);
      setIsOpen(!mobile); // open on desktop, closed on mobile
    };
    update(mq);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const toggle = () => setIsOpen((o) => !o);

  return (
    <>
      {/* Hamburger button — always visible, position adapts */}
      <button
        onClick={toggle}
        aria-label={isOpen ? "Close menu" : "Open menu"}
        className={`
          fixed top-3 z-50 w-9 h-9 flex flex-col items-center justify-center gap-1.5
          bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg shadow transition-all
          ${isOpen && !isMobile ? "left-[13.5rem]" : "left-3"}
        `}
      >
        {/* Animated hamburger → X */}
        <span
          className={`block h-0.5 w-5 bg-gray-300 rounded transition-all origin-center duration-200
            ${isOpen ? "rotate-45 translate-y-2" : ""}`}
        />
        <span
          className={`block h-0.5 w-5 bg-gray-300 rounded transition-all duration-200
            ${isOpen ? "opacity-0 scale-x-0" : ""}`}
        />
        <span
          className={`block h-0.5 w-5 bg-gray-300 rounded transition-all origin-center duration-200
            ${isOpen ? "-rotate-45 -translate-y-2" : ""}`}
        />
      </button>

      {/* Mobile backdrop */}
      {isOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-40 flex flex-col
          bg-gray-900 border-r border-gray-800 shadow-xl
          transition-all duration-300 ease-in-out overflow-hidden
          ${isOpen ? "w-52" : "w-0"}
          md:relative md:shrink-0
        `}
      >
        {/* Logo / title */}
        <div className="pt-4 pb-3 px-4 border-b border-gray-800 shrink-0">
          <span className="text-sm font-bold text-white tracking-wide whitespace-nowrap">
            CPU Simulator
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-hidden">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => isMobile && setIsOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg text-base whitespace-nowrap transition-colors
                  ${active
                    ? "bg-indigo-600 text-white font-semibold"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"}
                `}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
