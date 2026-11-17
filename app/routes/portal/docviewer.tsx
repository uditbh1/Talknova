// app/routes/admin/dashboard.jsx
import { Outlet } from "@remix-run/react";
import AdminLayout from "~/components/Layout";
import { redirect } from "@remix-run/node";
import { getUserFromSession } from "~/utils/auth.server";
import DocViewer, { DocViewerRenderers } from "@cyntler/react-doc-viewer";
import "@cyntler/react-doc-viewer/dist/index.css";

export async function loader({ request }) {
  let user = await getUserFromSession(request);
  if (!user) return redirect("/login");

  return { user };
}

const DocViewerPage = () => {
  const docs = [
    {
      uri: "https://klaspadai.klaspad.com/1722619957123-Culinary-Delight.docx",
    },
  ];
  return (
    <AdminLayout>
      <div className="row">
        <div className="col-xl-12 col-12 mb-5">
          {/* card */}
          <div className="card">
            {/* card header */}
            <div className="card-header">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h4 className="mb-0">Courses List</h4>
                </div>
              </div>
            </div>
            {/* card body */}
            <div className="card-body">
              <DocViewer
                documents={docs}
                pluginRenderers={DocViewerRenderers}
              />
            </div>
          </div>
        </div>
      </div>
      {/* Render nested routes if any */}
      <Outlet />
    </AdminLayout>
  );
};

export default DocViewerPage;
