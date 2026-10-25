"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  IconAlert,
  IconBook,
  IconBookmark,
  IconCards,
  IconChart,
  IconClose,
  IconGlobe,
  IconHome,
  IconMenu,
  IconMic,
  IconPath,
  IconPen,
  IconSettings,
} from "@/components/ui/icons";

export interface NavCounts {
  dueReviews: number;
  activeMistakes: number;
}

const PRIMARY = [
  { href: "/", label: "Home", icon: IconHome },
  { href: "/path", label: "Learning Path", icon: IconPath },
  { href: "/speaking", label: "Speaking Studio", icon: IconMic },
  { href: "/writing", label: "Writing Workshop", icon: IconPen },
  { href: "/vocabulary", label: "Vocabulary Lab", icon: IconCards },
  { href: "/grammar", label: "Grammar Lab", icon: IconBook },
  { href: "/real-english", label: "Real English", icon: IconGlobe },
  { href: "/progress", label: "My Progress", icon: IconChart },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppShell({ children, counts, learnerName }: { children: ReactNode; counts: NavCounts; learnerName: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);

  // Close the drawer on navigation (state adjusted during render, as React recommends).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    sidebar.current?.querySelector<HTMLElement>("a")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const utility = [
    { href: "/vocabulary/collection", label: "Saved expressions", icon: IconBookmark, count: counts.dueReviews, countLabel: "due" },
    { href: "/mistakes", label: "Mistake tracker", icon: IconAlert, count: counts.activeMistakes, countLabel: "active" },
    { href: "/settings", label: "Settings", icon: IconSettings },
  ];

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="mobile-bar">
        <Link href="/" className="brand">
          <span className="brand-mark">E</span> My English Studio
        </Link>
        <button
          ref={menuButton}
          className="btn btn-ghost btn-icon"
          aria-expanded={open}
          aria-controls="sidebar"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <IconClose size={22} /> : <IconMenu size={22} />}
        </button>
      </div>
      {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <nav id="sidebar" ref={sidebar} className="sidebar" data-open={open} aria-label="Main">
        <Link href="/" className="brand">
          <span className="brand-mark">E</span>
          My English Studio
        </Link>
        <ul className="nav-list">
          {PRIMARY.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="nav-link" aria-current={isActive(pathname, href) ? "page" : undefined}>
                <Icon />
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="nav-section-label">Your studio</div>
        <ul className="nav-list">
          {utility.map(({ href, label, icon: Icon, count, countLabel }) => (
            <li key={href}>
              <Link href={href} className="nav-link" aria-current={isActive(pathname, href) ? "page" : undefined}>
                <Icon />
                {label}
                {count ? (
                  <span className="nav-count" aria-label={`${count} ${countLabel}`}>
                    {count}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
        <div className="sidebar-footer">
          {learnerName ? <>Signed in as {learnerName}</> : <>Your personal studio</>}
          <br />
          Understand less passively. Use more actively.
        </div>
      </nav>
      <main id="main" className="main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
