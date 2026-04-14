import type { Route } from "next";
import Link from "next/link";
import { productRoutes } from "@/lib/navigation";
import type { Viewer } from "@/lib/auth/viewer";
import { SignOutButton } from "@/components/auth/sign-out-button";

interface ProductShellProps {
  children: React.ReactNode;
  viewer: Viewer;
}

export function ProductShell({ children, viewer }: ProductShellProps) {
  return (
    <div className="product-shell">
      <div className="product-frame">
        <aside className="product-sidebar">
          <div className="eyebrow">Trust-first build</div>
          <h2>ResumeEvolver</h2>
          <p className="muted">
            {viewer.displayName}
            {viewer.email ? ` · ${viewer.email}` : ""}
          </p>
          <p className="muted">
            GitHub identity linked: {viewer.githubConnected ? "Yes" : "Not yet"}
          </p>

          <SignOutButton />

          <ul className="nav-list">
            {productRoutes.map((route) => (
              <li key={route.href}>
                <Link href={route.href as Route} className="nav-link">
                  <span className="nav-label">{route.label}</span>
                  <span className="nav-summary">{route.summary}</span>
                  <span className="status-pill">{route.milestone}</span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <div>{children}</div>
      </div>
    </div>
  );
}
