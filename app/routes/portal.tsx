import { Outlet, json, redirect } from '@remix-run/react';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { getUserFromSession } from '~/utils/auth.server';

// Export links to load dashboard CSS before render (prevents layout shifts and font loading issues)
export const links = () => [
  // Preconnect to Google Fonts for faster Inter font loading
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  // Dashboard CSS - load in order for proper cascade
  { rel: "stylesheet", href: "/assets/libs/bootstrap-icons/font/bootstrap-icons.css" },
  { rel: "stylesheet", href: "/assets/libs/@mdi/font/css/materialdesignicons.min.css" },
  { rel: "stylesheet", href: "https://cdn.jsdelivr.net/npm/simplebar@latest/dist/simplebar.min.css" },
  { rel: "stylesheet", href: "/assets/css/theme.min.css" }, // Contains @import for Inter font
  { rel: "stylesheet", href: "/assets/css/style.css" },
  { rel: "stylesheet", href: "/assets/libs/datatables.net-bs5/css/dataTables.bootstrap5.min.css" },
];

// Loader to provide user data to all portal routes (for Navbar component)
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await getUserFromSession(request);
  if (!user) return redirect('/login');
  
  return json({ user: JSON.parse(JSON.stringify(user)) });
};

export default function PortalLayout() {
  return <Outlet />;
}

