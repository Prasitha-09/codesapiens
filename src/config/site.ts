export const siteConfig = {
  name: "Code Sapiens",
  product: "The Challenge Arena",
  tagline: "Take on challenges. Earn coins. Climb the leaderboard.",
  description:
    "The Challenge Arena is the Code Sapiens event platform: take on challenges, submit your work, earn coins for approved submissions and climb the leaderboard.",
} as const;

export type NavItem = { href: string; label: string };

/*
 * URLs are unchanged from earlier versions; only the visible labels follow the
 * event's naming (Tasks → Challenges, Dashboard → My Arena, …).
 */

/** Links shown to everyone. Challenges needs a sign-in; the page redirects to log in. */
export const primaryNav: NavItem[] = [
  { href: "/tasks", label: "Challenges" },
  { href: "/challenge-leaderboard", label: "Leaderboard" },
];

/** Links for signed-in participants. */
export const memberNav: NavItem[] = [
  { href: "/dashboard", label: "My Arena" },
  { href: "/submissions", label: "My Attempts" },
  { href: "/wallet", label: "My Coins" },
  { href: "/profile", label: "My Profile" },
];

/** Extra links for admins. Visibility only — the admin pages enforce access on the server. */
export const adminNav: NavItem[] = [{ href: "/admin", label: "Admin" }];
