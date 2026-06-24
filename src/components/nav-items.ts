import {
  LayoutDashboard,
  FolderKanban,
  Building2,
  Boxes,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon; adminOnly?: boolean };

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Clients", href: "/clients", icon: Building2, adminOnly: true },
  { label: "Products", href: "/products", icon: Boxes, adminOnly: true },
  { label: "Users", href: "/users", icon: UsersRound, adminOnly: true },
];

/** Nav items visible to a user of the given admin status. */
export function visibleNavItems(isAdmin: boolean): NavItem[] {
  return navItems.filter((item) => !item.adminOnly || isAdmin);
}

export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}
