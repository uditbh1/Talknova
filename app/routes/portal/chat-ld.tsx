// app/routes/dashboard.jsx

import {
  useLoaderData,
  Await,
  useRouteError,
  isRouteErrorResponse,
  Link,
} from "@remix-run/react";
import { redirect, defer, json } from "@remix-run/node";
import { useEffect, useState } from "react";
import { getUserFromSession } from "~/utils/auth.server";
import { Course } from "~/models/course";
import { User } from "~/models/user";
import { getCurrentPlan } from "~/utils/plans";
import { PlanModel } from "~/models/plan";
import { UserCourse } from "~/models/userCourse";

import AdminLayout from "~/components/Layout";
//import RadialBarChart from '~/components/RadialBarChart';
import { Suspense } from "react";
import type { LoaderFunction } from "@remix-run/node";

interface DashboardData {
  currentPlan?: any;
  availablePlans?: any[];
  userId?: string;
  courses?: any[];
  providers?: any[];
  totalLearners?: number;
}

interface LoaderData {
  user: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  roles: string[];
  data: Promise<DashboardData>;
}

// Data fetching functions
async function fetchAdminData() {
  // Fetch data relevant to admin users
  const courses = await Course.find({ status: true }).populate("user").lean();
  const providers = await User.find({ roles: "COURSEPROVIDER" }).lean();

  return { courses, providers };
}

async function fetchTeacherData(user) {
  // Fetch data relevant to teacher users
  const courses = await Course.find({ user: user._id }).lean();

  //get total number of learners
  const coursesIds = courses.map((course) => course._id);
  const totalLearners = await Course.countDocuments({
    _id: { $in: coursesIds },
  });

  return { courses, totalLearners };
}

async function fetchClientData(user) {
  // Fetch data relevant to client users
  const userId = user._id;

  // Get current plan if exists
  const currentPlan = await getCurrentPlan(userId);

  // Get all available plans if no current plan
  const availablePlans = !currentPlan
    ? await PlanModel.find({
        isActive: true,
        isDeleted: false,
      }).sort({ price: 1 })
    : [];

  return { currentPlan, availablePlans, userId };
}

// Loader function
export const loader: LoaderFunction = async ({ request }) => {
  let user = await getUserFromSession(request);
  if (!user) return redirect("/login");
  const roles = user.roles || [];

  let dataPromise;

  try {
    if (roles.includes("SUPER_ADMIN")) {
      dataPromise = fetchAdminData();
    } else if (roles.includes("COURSEPROVIDER")) {
      dataPromise = fetchTeacherData(user);
    } else if (roles.includes("CLIENT")) {
      dataPromise = fetchClientData(user);
    } else {
      throw json({ message: "Unauthorized" }, { status: 401 });
    }

    return defer({ user, roles, data: dataPromise });
  } catch (error) {
    throw error;
  }
};

// Dashboard components
const AdminDashboard = ({ data, user }) => {
  const clients = data.clients || [];
  return (
    <>
      <div className="row "></div>
    </>
  );
};

const ProviderDashboard = ({ data, user }) => {
  const [RadialBarChart, setRadialBarChart] = useState(null);
  const courses = data.courses || [];
  const totalLearners = data.totalLearners || 0;

  // Define your options and series data here
  const seriesData = [76, 32, 13];
  const labels = ["In Progress", "Completed", "Certified"];

  useEffect(() => {
    //import('../../components/RadialBarChart').then(module => {
    //  setRadialBarChart(() => module.default);
    // });
  }, []);

  return (
    <>
      <div className="row">
        <div className="col-xl-3 col-lg-6 col-md-12 col-12 mb-5">
          {/* card */}
          <div className="card h-100 card-lift">
            {/* card body */}
            <div className="card-body">
              {/* heading */}
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h4 className="mb-0">Active Courses</h4>
                </div>
                <div className="icon-shape icon-md bg-primary-soft text-primary rounded-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width={20}
                    height={20}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="feather feather-briefcase"
                  >
                    <rect x={2} y={7} width={20} height={14} rx={2} ry={2} />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
              </div>
              {/* project number */}
              <div className="lh-1">
                <h1 className=" mb-1 fw-bold">{courses.length || 0}</h1>
              </div>
            </div>
          </div>
        </div>
        <div className="col-xl-3 col-lg-6 col-md-12 col-12 mb-5">
          {/* card */}
          <div className="card h-100 card-lift">
            {/* card body */}
            <div className="card-body">
              {/* heading */}
              <div
                className="d-flex justify-content-between align-items-center
              mb-3"
              >
                <div>
                  <h4 className="mb-0">Inactive Courses</h4>
                </div>
                <div
                  className="icon-shape icon-md bg-primary-soft text-primary
                rounded-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width={20}
                    height={20}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="feather feather-list"
                  >
                    <line x1={8} y1={6} x2={21} y2={6} />
                    <line x1={8} y1={12} x2={21} y2={12} />
                    <line x1={8} y1={18} x2={21} y2={18} />
                    <line x1={3} y1={6} x2="3.01" y2={6} />
                    <line x1={3} y1={12} x2="3.01" y2={12} />
                    <line x1={3} y1={18} x2="3.01" y2={18} />
                  </svg>
                </div>
              </div>
              {/* project number */}
              <div className="lh-1">
                <h1 className="  mb-1 fw-bold">0</h1>
              </div>
            </div>
          </div>
        </div>
        <div className="col-xl-3 col-lg-6 col-md-12 col-12 mb-5">
          {/* card */}
          <div className="card h-100 card-lift">
            {/* card body */}
            <div className="card-body">
              {/* heading */}
              <div
                className="d-flex justify-content-between align-items-center
              mb-3"
              >
                <div>
                  <h4 className="mb-0">Registered Learners</h4>
                </div>
                <div
                  className="icon-shape icon-md bg-primary-soft text-primary
                rounded-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width={20}
                    height={20}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="feather feather-users"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx={9} cy={7} r={4} />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
              </div>
              {/* project number */}
              <div className="lh-1">
                <h1 className="  mb-1 fw-bold">
                  <Link to="/portal/learners">{totalLearners}</Link>
                </h1>
              </div>
            </div>
          </div>
        </div>
        <div className="col-xl-3 col-lg-6 col-md-12 col-12 mb-5">
          {/* card */}
          <div className="card h-100 card-lift">
            {/* card body */}
            <div className="card-body">
              {/* heading */}
              <div
                className="d-flex justify-content-between align-items-center
              mb-3"
              >
                <div>
                  <h4 className="mb-0">Amount Earned</h4>
                </div>
                <div
                  className="icon-shape icon-md bg-primary-soft text-primary
                rounded-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width={20}
                    height={20}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="feather feather-target"
                  >
                    <circle cx={12} cy={12} r={10} />
                    <circle cx={12} cy={12} r={6} />
                    <circle cx={12} cy={12} r={2} />
                  </svg>
                </div>
              </div>
              {/* project number */}
              <div className="lh-1">
                <h1 className="  mb-1 fw-bold">£ 0.00</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row ">
        <div className="col-xl-6 col-lg-12 col-md-12 col-12 mb-5 mb-xl-0">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h4 className="mb-0">Total Active Courses ({courses.length})</h4>
            </div>
            <div className="card-body">
              <div className="table-responsive table-card">
                <table className="table text-nowrap mb-0 table-centered table-hover">
                  <thead className="table-light">
                    <tr>
                      <th>Course Name</th>
                      <th>Date Added</th>
                      <th>Type</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((course) => (
                      <tr key={course._id}>
                        <td>
                          <Link to={`/portal/courses/${course._id}`}>
                            {course.name}
                          </Link>
                        </td>
                        <td>
                          {new Date(course.createdAt).toLocaleDateString()}
                        </td>
                        <td>{course.isPrivate ? "Private" : "Public"}</td>
                        <td>
                          {course.status ? (
                            <span className="badge badge-success-soft">
                              Active
                            </span>
                          ) : (
                            <span className="badge badge-danger-soft">
                              Inactive
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div className="col-xl-6 col-lg-12 col-md-12 col-12 mb-5 mb-xl-0">
          <div className="card h-100">
            {/* card body  */}
            <div
              className="card-header d-flex align-items-center
                          justify-content-between"
            >
              <div>
                <h4 className="mb-0">Tasks Performance </h4>
              </div>
              {/* dropdown  */}
              <div className="dropdown dropstart">
                <a
                  className="btn btn-icon btn-ghost btn-sm rounded-circle"
                  href="#!"
                  role="button"
                  id="dropdownTask"
                  data-bs-toggle="dropdown"
                  aria-haspopup="true"
                  aria-expanded="false"
                >
                  <i className="icon-xs" data-feather="more-vertical" />
                </a>
                <div className="dropdown-menu" aria-labelledby="dropdownTask">
                  <a
                    className="dropdown-item d-flex align-items-center"
                    href="#!"
                  >
                    Action
                  </a>
                  <a
                    className="dropdown-item d-flex align-items-center"
                    href="#!"
                  >
                    Another action
                  </a>
                  <a
                    className="dropdown-item d-flex align-items-center"
                    href="#!"
                  >
                    Something else here
                  </a>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div id="calendar" />
              {/* chart  */}

              {/* icon with content  */}
              <div className="d-flex align-items-center justify-content-around">
                <div className="text-center">
                  <i
                    className="icon-sm text-success"
                    data-feather="check-circle"
                  />
                  <h1 className="fs-2 mb-0 ">76%</h1>
                  <p>In Progress</p>
                </div>
                <div className="text-center">
                  <i
                    className="icon-sm text-warning"
                    data-feather="trending-up"
                  />
                  <h1 className="fs-2 mb-0 ">32%</h1>
                  <p>Completed</p>
                </div>
                <div className="text-center">
                  <i
                    className="icon-sm text-danger"
                    data-feather="trending-down"
                  />
                  <h1 className="fs-2 mb-0 ">13%</h1>
                  <p>Certified</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const LearnerDashboard = ({ data, user }) => {
  const courses = data.courses || [];
  const certificates = data.certificates || [];
  return (
    <>
      <div className="row ">
        {/* card  */}
        <div className="col-xl-6 col-lg-12 col-md-12 col-12 mb-5 mb-xl-0">
          <div className="card h-100">
            {/* card header  */}
            <div className="card-header d-flex justify-content-between align-items-center">
              <h4 className="mb-0">My Courses, Total: {courses.length}</h4>
            </div>
            {/* table  */}
            <div className="card-body">
              <div className="table-responsive table-card">
                <table className="table text-nowrap mb-0 table-centered table-hover">
                  <thead className="table-light">
                    <tr>
                      <th>Course Name</th>
                      <th>Provider</th>
                      <th>Date Joined</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((course) => (
                      <tr key={course._id}>
                        <td>
                          <Link to={`/portal/my-courses/${course._id}`}>
                            {course.name}
                          </Link>
                        </td>
                        <td>{`${course.user.firstName} ${course.user.lastName}`}</td>
                        <td>
                          {new Date(course.joinedDate).toLocaleDateString()}
                        </td>
                        <td>
                          <span className="badge badge-warning-soft">
                            In Progress
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        {/* card  */}
        <div className="col-xl-6 col-lg-12 col-md-12 col-12 mb-5 mb-xl-0">
          <div className="card h-100">
            {/* card header  */}
            <div className="card-header">
              <h4 className="mb-0">
                My certificates, Total: {certificates.length}
              </h4>
            </div>
            {/* table  */}
            <div className="card-body">
              <div
                className="table-responsive table-card"
                data-simplebar
                style={{ maxHeight: 380 }}
              >
                <table className="table text-nowrap mb-0 table-centered table-hover">
                  <thead className="table-light">
                    <tr>
                      <th>Course Name</th>
                      <th>Awarding Body</th>
                      <th>Date of Certification</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {certificates.map((certificate) => (
                      <tr key={certificate._id}>
                        <td>
                          <Link
                            to={`/portal/course-certificates/${certificate._id}`}
                          >{`${certificate.name}`}</Link>
                        </td>
                        <td>
                          {
                            courses.filter(
                              (course) => course.user._id === certificate._id,
                            ).length
                          }
                        </td>
                      </tr>
                    ))}
                    {certificates.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center">
                          No certificates found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const ClientDashboard = ({ data, user }) => {
  const { currentPlan, availablePlans } = data;

  if (currentPlan) {
    return (
      <>
        <div className="row">
          <div className="col-xl-12 col-lg-12 col-md-12 col-12 mb-5">
            <div className="card h-100 card-lift">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h4 className="mb-0">Current Plan</h4>
                  </div>
                  <div className="icon-shape icon-md bg-primary-soft text-primary rounded-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width={20}
                      height={20}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="feather feather-award"
                    >
                      <circle cx="12" cy="8" r="7"></circle>
                      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
                    </svg>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <tbody>
                      <tr>
                        <td>
                          <strong>Plan Name</strong>
                        </td>
                        <td>{currentPlan.planId.name}</td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Start Date</strong>
                        </td>
                        <td>
                          {new Date(currentPlan.startDate).toLocaleDateString()}
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Expiry Date</strong>
                        </td>
                        <td>
                          {new Date(
                            currentPlan.expiryDate,
                          ).toLocaleDateString()}
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Max Documents</strong>
                        </td>
                        <td>{currentPlan.planId.maxDocuments}</td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Max File Size</strong>
                        </td>
                        <td>{currentPlan.planId.maxFileSize}MB</td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Max URLs</strong>
                        </td>
                        <td>{currentPlan.planId.maxUrls}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="row">
        <div className="col-12 mb-4">
          <div className="alert alert-info">
            <h5>No Active Plan</h5>
            <p>
              You currently don't have any active plan. Choose from our
              available plans below to get started.
            </p>
          </div>
        </div>
      </div>

      <div className="row">
        {availablePlans.map((plan) => (
          <div
            key={plan._id}
            className="col-xl-4 col-lg-6 col-md-12 col-12 mb-4"
          >
            <div className="card h-100 card-lift">
              <div className="card-body">
                <h4 className="card-title">{plan.name}</h4>
                <div className="price mb-3">
                  <h3>
                    £{plan.price}
                    {plan.isMonthly && <small>/mo</small>}
                  </h3>
                </div>
                <ul className="list-unstyled mb-4">
                  <li className="mb-2">
                    <i className="fas fa-check text-success me-2"></i>
                    {plan.maxDocuments} Documents
                  </li>
                  <li className="mb-2">
                    <i className="fas fa-check text-success me-2"></i>
                    {plan.maxFileSize}MB File Size
                  </li>
                  <li className="mb-2">
                    <i className="fas fa-check text-success me-2"></i>
                    {plan.maxUrls} URLs
                  </li>
                </ul>
                <Link
                  to={`/buy-plan?plan=${plan._id.toString()}&period=monthly`}
                  className="btn btn-primary w-100"
                >
                  Subscribe Now
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

// Main component
const PortalDashboard = () => {
  const { user, roles, data } = useLoaderData<LoaderData>();
  console.log("user", user);

  return (
    <AdminLayout>
      <div className="row">
        <div className="col-lg-12 col-md-12 col-12">
          {/* Page header */}
          <div className="d-flex justify-content-between align-items-center mb-5"></div>
        </div>
      </div>

      <div className="row">
        <div className="col-xl-12 col-12 mb-5">
          <div className="card h-100">
            <div className="card-header">
              <h5 className="mb-0">Edit Chat Agent</h5>
            </div>

            <div className="card-body">
              <form>
                <div className="container-fluid">
                  <div className="row">
                    <div className="col-lg-4">
                      <div className="mb-3">
                        <label for="temperature" class="form-label">
                          Client
                        </label>
                        <select
                          class="form-select"
                          id="client"
                          name="client"
                          required=""
                        >
                          <option value="">Select Client</option>
                          <option value="67bf44407549bb8c945f51fb">
                            Akbar Akbar
                          </option>
                          <option value="67bf44597549bb8c945f5202">
                            Ashoka Ashoka
                          </option>
                          <option value="67ceba5ab86e930af7349578" selected="">
                            BSBC BSBC
                          </option>
                          <option value="67f532685e7812fb7e88a5ab">
                            Frozan Shaheer
                          </option>
                          <option value="67fc26c45e7812fb7e88a641">
                            Souleymane Sagnon{" "}
                          </option>
                          <option value="68072efa5e7812fb7e88a730">
                            Frederick Domingo
                          </option>
                          <option value="68072f695e7812fb7e88a75e">
                            Frederick Domingo
                          </option>
                          <option value="681da9dab746c912cfd3e125">
                            Ambrish Bansal
                          </option>
                        </select>
                      </div>
                    </div>

                    <div className="col-lg-4">
                      <div className="mb-3">
                        <label for="temperature" class="form-label">
                          Ai Chat Agent Name
                        </label>
                        <input
                          type="text"
                          class="form-control"
                          id="name"
                          name="name"
                          required=""
                          minlength="3"
                          value="BSBC 1"
                        />
                      </div>
                    </div>
                    <div className="col-lg-4">
                      <div className="mb-3">
                        <label for="temperature" class="form-label">
                          Temperature
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="0.9"
                          class="form-control"
                          id="temperature"
                          name="temperature"
                          required=""
                          value="0.5"
                        />
                      </div>
                    </div>

                    <div className="col-lg-12">
                      <div className="mb-3">
                        <label for="prompt" className="form-label">
                          Instructions for Chat Agent
                        </label>
                        <textarea
                          class="form-control"
                          id="prompt"
                          name="prompt"
                          rows="10"
                          required=""
                        >
                          When some one says Hi or Hello or any other greeting
                          Please introduce yourself as “BSBC AI Support”. Your
                          primary responsibility is to provide accurate and
                          reliable answers strictly based on the information
                          available in the provided knowledge documents. You
                          must not answer any question that falls outside the
                          scope of these documents. If someone asks a question
                          unrelated to the knowledge documents, politely respond
                          with: "This is outside the scope of this website," or
                          a similar phrase. You are permitted to answer basic
                          greetings in a friendly yet professional manner, such
                          as responding to "Hello" with "Hello! How can I assist
                          you?" or to "How are you?" with "I'm here and ready to
                          help with your queries!" Beyond this, avoid engaging
                          in any unrelated discussions or speculative responses.
                          Your focus should always remain on the knowledge
                          documents, ensuring your answers are precise and
                          grounded. If the information required to answer a
                          question is missing or unavailable in the documents,
                          clearly indicate this without attempting to guess or
                          infer. Always maintain a polite, concise, and
                          professional tone while interacting. Please do try to
                          get the user’s name and contact details by telling
                          them that you need these details to send more
                          information and connecting them to the right people in
                          the organisation in case they need more help. When
                          someone says Hi or Hello or any other greeting, please
                          introduce yourself as “BSBC AI Support”. Your primary
                          responsibility is to provide accurate and reliable
                          answers strictly based on the information available in
                          the provided knowledge documents. These documents
                          include detailed course information—such as course
                          names, descriptions, and fees—as well as additional
                          website details like the website address and related
                          data. You must not answer any question that falls
                          outside the scope of these documents. If a question is
                          unrelated to the knowledge base, respond politely
                          with: "This is outside the scope of this website," or
                          a similar phrase. For course-related queries: Course
                          Fees: When a question refers to a course or appears to
                          mention a course name, provide the course fee
                          information as listed in the knowledge documents.
                          Website Context: Bradford School of Business and Care
                          (BSBC) is a new campus of Klaspad, a reputable
                          organization with a proven track record in education
                          and training. We have partnered with the University of
                          Bolton to deliver their MBA programme in Malaysia and
                          Bahrain and are accredited by several OFQUAL-approved
                          awarding organizations to offer a variety of online,
                          blended, and face-to-face courses from Level 2 to
                          Level 7. BSBC has already opened admissions for the
                          Dental Nursing Diploma, with the first batch of
                          students starting on June 5, 2024. Several courses in
                          Health &amp; Social Care are also being introduced,
                          leveraging Klaspad’s strong connections in the sector.
                          Furthermore, BSBC is in the process of becoming an
                          examination centre for IELTS and other English
                          language tests required by the UKVI and universities,
                          with a campus visit planned in June by the appropriate
                          authorities. Additionally, AI-based online learning
                          will be introduced by October 2024.
                        </textarea>
                      </div>
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-lg-12">
                      <div className="card mb-4">
                        <div className="card-header">
                          <h5>Documents</h5>
                        </div>

                        <div className="card-body">
                          <div className="mt-1">
                            <h6>
                              Knowledge Base Documents:{" "}
                              <small>
                                (These documents will be used by your Chat Agent
                                as its knowledge Base)
                              </small>
                            </h6>
                            <table className="table table-bordered">
                              <thead>
                                <tr>
                                  <th>File Name</th>
                                  <th>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td>
                                    <a
                                      href="https://klaspadai.klaspad.com/1741603476944-BSBC-short-summary.docx"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      1741603476944-BSBC-short-summary.docx
                                    </a>
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      className="btn btn-danger btn-sm"
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                                <tr>
                                  <td>
                                    <a
                                      href="https://klaspadai.klaspad.com/1741959685214-List-of-Available-Courses-and-Fees.docx"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      1741959685214-List-of-Available-Courses-and-Fees.docx
                                    </a>
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      className="btn btn-danger btn-sm"
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          <button
                            type="button"
                            className="btn btn-primary mt-2"
                          >
                            Add another file
                          </button>
                          <input
                            type="hidden"
                            name="existingDocuments"
                            value="1741603476944-BSBC-short-summary.docx"
                          />
                          <input
                            type="hidden"
                            name="existingDocuments"
                            value="1741959685214-List-of-Available-Courses-and-Fees.docx"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-lg-12">
                      <div className="card mb-4">
                        <div className="card-header">
                          <h5>Chat Box Theme Setting</h5>
                        </div>

                        <div className="card-body">
                          <div className="row">
                            <div className="col-lg-8">
                              <div className="row">
                                <h5 className="mb-3">Chat Box Header</h5>
                                <br />
                                <div className="col-md-6">
                                  <div className="mb-3">
                                    <label className="form-label">
                                      Chat Box Title
                                    </label>
                                    <input
                                      type="text"
                                      className="form-control"
                                      name="theme[chatWindow][title]"
                                      value="Ai Support"
                                    ></input>
                                  </div>
                                </div>

                                <div className="col-md-6">
                                  <div className="mb-3">
                                    <label className="form-label">
                                      Greeting
                                    </label>
                                    <input
                                      type="text"
                                      className="form-control"
                                      name="theme[tooltip][tooltipMessage]"
                                      value="Hi There 👋!"
                                    />
                                  </div>
                                </div>

                                <div className="col-md-12">
                                  <div className="mb-3">
                                    <label className="form-label">
                                      Welcome Message
                                    </label>
                                    <textarea
                                      className="form-control"
                                      name="theme[chatWindow][welcomeMessage]"
                                    >
                                      Hello! You are chatting with Ai Support.
                                      How can I help you today?
                                    </textarea>
                                  </div>
                                </div>

                                <div className="col-md-4">
                                  <div className="mb-3">
                                    <label className="form-label">
                                      Background Color
                                    </label>
                                    <input
                                      type="color"
                                      className="form-control form-control-color"
                                      name="theme[chatWindow][backgroundColor]"
                                      value="#ffffff"
                                    />
                                  </div>
                                </div>

                                <div className="col-md-4">
                                  <div className="mb-3">
                                    <label className="form-label">
                                      Text Color
                                    </label>
                                    <input
                                      type="color"
                                      className="form-control form-control-color"
                                      name="theme[chatWindow][textColor]"
                                      value="#000000"
                                    />
                                  </div>
                                </div>

                                <div className="col-md-4">
                                  <div className="mb-3">
                                    <label className="form-label">
                                      Message Background Color
                                    </label>
                                    <input
                                      type="color"
                                      className="form-control form-control-color"
                                      name="theme[tooltip][tooltipBackgroundColor]"
                                      value="#002045"
                                    />
                                  </div>
                                </div>

                                <div className="col-md-4">
                                  <div className="mb-3">
                                    <label className="form-label">
                                      Header Color
                                    </label>
                                    <input
                                      type="color"
                                      className="form-control form-control-color"
                                      name="theme[chatWindow][headerColor]"
                                      value="#002045"
                                    />
                                  </div>
                                </div>

                                <div className="col-md-12">
                                  <h5>Chat Button On Your Website</h5>
                                </div>

                                <div className="col-md-4">
                                  <div className="mb-3">
                                    <label className="form-label">
                                      Background Color
                                    </label>
                                    <input
                                      type="color"
                                      className="form-control form-control-color"
                                      name="theme[button][backgroundColor]"
                                      value="#002045"
                                    />
                                  </div>
                                </div>

                                <div className="col-md-4">
                                  <div className="mb-3">
                                    <label className="form-label">
                                      Icon Color
                                    </label>
                                    <input
                                      type="color"
                                      className="form-control form-control-color"
                                      name="theme[button][iconColor]"
                                      value="#ffffff"
                                    />
                                  </div>
                                </div>

                                <div className="col-md-4">
                                  <div className="mb-3">
                                    <label className="form-label">Size</label>
                                    <input
                                      type="number"
                                      className="form-control"
                                      name="theme[button][size]"
                                      value="68"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="col-lg-4">
                              <div className="card-body">
                                <h4 className="chart-header">
                                  Ai Support{" "}
                                  <span>
                                    <i
                                      data-feather="refresh-ccw"
                                      className="icon-xs me-2"
                                    ></i>{" "}
                                    <i data-feather="x" className="icon-xs"></i>
                                  </span>
                                </h4>
                                <div className="ai-chat-area">
                                  <div className="chat-msg">
                                    Hello! You are chatting with Ai Support. How
                                    can I help you today?
                                  </div>
                                  <div className="type-msg">
                                    <div className="input-group">
                                      <input
                                        type="text"
                                        placeholder="Type a message"
                                        aria-describedby="button-addon2"
                                        className="form-control rounded-0 border-0 py-4 bg-light"
                                      />
                                      <div className="input-group-append">
                                        <button
                                          id="button-addon2"
                                          type="submit"
                                          className="btn btn-link"
                                        >
                                          {" "}
                                          <i
                                            data-feather="send"
                                            className="icon-sm"
                                          ></i>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="chat-button">
                                  <i
                                    data-feather="message-circle"
                                    className="icon-md"
                                  ></i>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default PortalDashboard;

// Error handling component
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <AdminLayout>
        <div className="error-container">
          <h1>Error {error.status}</h1>
          <p>{error.data || error.statusText}</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="error-container">
        <h1>An unexpected error occurred</h1>
        <p>{error instanceof Error ? error.message : "Unknown error"}</p>
      </div>
    </AdminLayout>
  );
}
