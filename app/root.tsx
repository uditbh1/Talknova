import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from '@remix-run/react';
import { getEnv } from './utils/env.server';
import { getUserFromSession } from '~/utils/auth.server';

export async function loader({ request }) {
  let user = await getUserFromSession(request);
  const ENV = await getEnv();

  return { user, ENV };
}

// No global CSS - load route-specific CSS via layout routes
// Frontend CSS: routes/_index.tsx or FrontLayout
// Dashboard CSS: routes/portal.tsx
export const links = () => [];

export function Layout({ children }: { children: React.ReactNode }) {
  /* const { ENV } = useLoaderData(); */

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />

        <Scripts />
        {/* <script dangerouslySetInnerHTML={{ __html: `window.ENV = ${JSON.stringify(ENV)};` }} /> */}
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
