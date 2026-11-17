import { Outlet, useLoaderData } from "@remix-run/react";
import Layout from "~/components/Layout";
import { getUserFromSession, requireUserSession } from "~/utils/auth.server";

export async function loader({ request }) {
  await requireUserSession(request);
  let user = await getUserFromSession(request);
  return { user };
}

export default function Reviews() {
  const { user } = useLoaderData();

  return (
    <Layout>
      <div className="app-content-area p-0">
        <div className="container-fluid">
          <Outlet />
        </div>
      </div>
    </Layout>
  );
}