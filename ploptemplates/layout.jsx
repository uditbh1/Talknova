import { Outlet, useActionData, useLoaderData } from "@remix-run/react";
import Layout from "~/components/navigation/Layout";
import { getUserFromSession, requireUserSession } from "~/utils/auth.server";

export async function loader({ request, params }) {
  await requireUserSession(request);
  let user = await getUserFromSession(request);

  return { user };
}

export default function Index() {
  const { user } = useLoaderData();

  return (
    <>
      <Layout>
        <div className="app-content-area">
          <div className="container-fluid">
            <Outlet />
          </div>
        </div>
      </Layout>
    </>
  );
}
