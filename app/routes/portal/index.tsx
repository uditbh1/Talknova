// app/routes/dashboard.jsx

import {
  useLoaderData,
  Await,
  useRouteError,
  isRouteErrorResponse,
  Link,
  useFetcher,
} from "@remix-run/react";
import { redirect, defer, json } from "@remix-run/node";
import { useEffect, useState } from "react";
import { getUserFromSession, getSessionStorage } from "~/utils/auth.server";
import { Course } from "~/models/course";
import { User } from "~/models/user";
import { getCurrentPlan, checkPlanExpiringSoon } from "~/utils/plans";
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
  expiryWarning?: {
    isExpiringSoon: boolean;
    daysRemaining: number | null;
    expiryDate: Date | null;
  };
}

interface LoaderData {
  user: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  roles: string[];
  data: Promise<DashboardData>;
  showWelcomePopup?: boolean;
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

  // Check and process expired plans (this will deactivate, send email, and revoke services)
  const { checkAndProcessExpiredPlan } = await import("~/utils/plans");
  const { UserPlanModel } = await import("~/models/userplan");

  // First, check and process any newly expired plans
  const expiredPlan = await checkAndProcessExpiredPlan(userId, user);

  // Get current plan if exists
  const currentPlan = await getCurrentPlan(userId, user);

  // Also check for recently expired plans (within last 7 days) even if already deactivated
  // This ensures we show the popup even if the plan was expired before
  let recentlyExpiredPlan = null;
  if (!currentPlan) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    recentlyExpiredPlan = await UserPlanModel.findOne({
      clientId: userId,
      isDeleted: false,
      expiryDate: {
        $gte: sevenDaysAgo,
        $lt: new Date(),
      },
    })
      .populate("planId")
      .sort({ expiryDate: -1 }) // Get most recent expired plan
      .lean();
  }

  // Use the newly expired plan or the recently expired plan
  const expiredPlanToShow = expiredPlan || recentlyExpiredPlan;

  // Check if plan is expiring soon (within 5 days)
  const expiryWarning = currentPlan
    ? checkPlanExpiringSoon(currentPlan, 5)
    : null;

  // Check if user has an expired plan (recently expired within 7 days)
  const hasExpiredPlan = expiredPlanToShow !== null;

  // Debug logging
  console.log("fetchClientData - Expired plan check:", {
    userId,
    hasCurrentPlan: !!currentPlan,
    hasExpiredPlan,
    expiredPlanFound: !!expiredPlan,
    recentlyExpiredPlanFound: !!recentlyExpiredPlan,
    expiredPlanToShow: expiredPlanToShow
      ? {
          planName: expiredPlanToShow.planId?.name,
          expiryDate: expiredPlanToShow.expiryDate,
        }
      : null,
  });

  // Get all available plans for the Available Plans section (exclude FREE plan)
  const availablePlans = await PlanModel.find({
    isActive: true,
    isDeleted: false,
    defaultPlanType: { $ne: "FREE" }, // Exclude FREE plan
  }).sort({ price: 1 });

  return {
    currentPlan,
    availablePlans,
    userId,
    expiryWarning,
    hasExpiredPlan,
    expiredPlanInfo: expiredPlanToShow
      ? {
          planName: expiredPlanToShow.planId?.name || "Plan",
          expiryDate: expiredPlanToShow.expiryDate,
        }
      : null,
  };
}

// Loader function
export const loader: LoaderFunction = async ({ request }) => {
  let user = await getUserFromSession(request);
  if (!user) return redirect("/login");
  const roles = user.roles || [];

  // Check if we should show welcome popup (from session)
  const sessionStorage = await getSessionStorage();
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );
  const showWelcomePopup = session.get("showWelcomePopup") || false;

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

    // If showing welcome popup, clear the session flag
    if (showWelcomePopup) {
      session.unset("showWelcomePopup");
    }

    return defer(
      {
        user,
        roles,
        data: dataPromise,
        showWelcomePopup,
      },
      {
        headers: showWelcomePopup
          ? {
              "Set-Cookie": await sessionStorage.commitSession(session),
            }
          : undefined,
      }
    );
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
                              (course) => course.user._id === certificate._id
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
  const {
    currentPlan,
    availablePlans,
    expiryWarning,
    hasExpiredPlan,
    expiredPlanInfo,
  } = data;
  const [billingPeriod, setBillingPeriod] = useState("monthly");
  const [showExpiryAlert, setShowExpiryAlert] = useState(false);
  const [showExpiredPopup, setShowExpiredPopup] = useState(false);

  // Show expiry alert on mount if plan is expiring soon
  useEffect(() => {
    if (expiryWarning?.isExpiringSoon) {
      setShowExpiryAlert(true);
    }
  }, [expiryWarning]);

  // Show expired plan popup on mount if plan has expired
  useEffect(() => {
    console.log("Expired plan check:", { hasExpiredPlan, expiredPlanInfo });
    if (hasExpiredPlan) {
      console.log("Showing expired plan popup");
      setShowExpiredPopup(true);
    }
  }, [hasExpiredPlan, expiredPlanInfo]);

  // Remove duplicates by using plan name as unique identifier
  const allPlans = availablePlans || [];

  const toggleBilling = () =>
    setBillingPeriod((prev) => (prev === "monthly" ? "yearly" : "monthly"));

  if (currentPlan) {
    return (
      <>
        {/* Expired Plan Popup */}
        {hasExpiredPlan && showExpiredPopup && (
          <div
            className="modal fade show"
            style={{
              display: "block",
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              zIndex: 1050,
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backdropFilter: "blur(2px)",
            }}
            tabIndex={-1}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowExpiredPopup(false);
              }
            }}
          >
            <div
              className="modal-dialog modal-dialog-centered"
              style={{ maxWidth: "500px" }}
            >
              <div
                className="modal-content"
                style={{
                  border: "none",
                  borderRadius: "16px",
                  boxShadow: "0 10px 40px rgba(220, 53, 69, 0.3)",
                  backgroundColor: "#fff",
                  overflow: "hidden",
                }}
              >
                {/* Header with gradient */}
                <div
                  style={{
                    background:
                      "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)",
                    color: "white",
                    padding: "24px 30px",
                    textAlign: "center",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: "-50px",
                      right: "-50px",
                      width: "150px",
                      height: "150px",
                      background: "rgba(255, 255, 255, 0.1)",
                      borderRadius: "50%",
                    }}
                  ></div>
                  <div
                    style={{
                      position: "absolute",
                      bottom: "-30px",
                      left: "-30px",
                      width: "100px",
                      height: "100px",
                      background: "rgba(255, 255, 255, 0.1)",
                      borderRadius: "50%",
                    }}
                  ></div>
                  <div style={{ position: "relative", zIndex: 1 }}>
                    <div
                      style={{
                        fontSize: "48px",
                        marginBottom: "12px",
                        animation: "pulse 2s ease-in-out infinite",
                      }}
                    >
                      <i
                        className="fas fa-clock"
                        style={{
                          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
                        }}
                      ></i>
                    </div>
                    <h4
                      style={{
                        margin: 0,
                        fontWeight: "600",
                        fontSize: "22px",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Subscription Expired
                    </h4>
                    <p
                      style={{
                        margin: "8px 0 0 0",
                        opacity: 0.95,
                        fontSize: "14px",
                        fontWeight: "300",
                      }}
                    >
                      A gentle reminder
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setShowExpiredPopup(false)}
                    aria-label="Close"
                    style={{
                      position: "absolute",
                      top: "16px",
                      right: "16px",
                      opacity: 0.9,
                    }}
                  ></button>
                </div>

                {/* Body */}
                <div style={{ padding: "32px 30px", backgroundColor: "#fff" }}>
                  {/* Main message */}
                  <div
                    style={{
                      textAlign: "center",
                      marginBottom: "24px",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "16px",
                        color: "#495057",
                        lineHeight: "1.6",
                        margin: 0,
                      }}
                    >
                      Your{" "}
                      <strong style={{ color: "#ee5a6f" }}>
                        {expiredPlanInfo?.planName || "Plan"}
                      </strong>{" "}
                      subscription expired on
                    </p>
                    <div
                      style={{
                        marginTop: "12px",
                        padding: "12px 20px",
                        backgroundColor: "#fff5f5",
                        borderRadius: "8px",
                        display: "inline-block",
                      }}
                    >
                      <strong
                        style={{
                          color: "#ee5a6f",
                          fontSize: "16px",
                        }}
                      >
                        {expiredPlanInfo?.expiryDate
                          ? new Date(
                              expiredPlanInfo.expiryDate
                            ).toLocaleDateString("en-GB", {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })
                          : "recently"}
                      </strong>
                    </div>
                  </div>

                  {/* Services info */}
                  <div
                    style={{
                      backgroundColor: "#f8f9fa",
                      borderRadius: "12px",
                      padding: "20px",
                      marginBottom: "24px",
                      border: "1px solid #e9ecef",
                    }}
                  >
                    <h6
                      style={{
                        color: "#495057",
                        fontSize: "14px",
                        fontWeight: "600",
                        marginBottom: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      <i
                        className="fas fa-info-circle me-2"
                        style={{ color: "#ee5a6f" }}
                      ></i>
                      Services Temporarily Unavailable
                    </h6>
                    <ul
                      style={{
                        listStyle: "none",
                        padding: 0,
                        margin: 0,
                      }}
                    >
                      {[
                        "AI chatbots and agents",
                        "Document uploads",
                        "Website URL crawling",
                        "Chatbot interactions",
                      ].map((service, idx) => (
                        <li
                          key={idx}
                          style={{
                            padding: "8px 0",
                            color: "#6c757d",
                            fontSize: "14px",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <i
                            className="fas fa-times-circle me-2"
                            style={{ color: "#ee5a6f", fontSize: "12px" }}
                          ></i>
                          {service}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Action buttons */}
                  <div className="d-grid gap-2">
                    <Link
                      to="/portal"
                      className="btn btn-lg"
                      onClick={() => setShowExpiredPopup(false)}
                      style={{
                        background:
                          "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)",
                        border: "none",
                        color: "white",
                        fontWeight: "600",
                        borderRadius: "10px",
                        padding: "14px",
                        boxShadow: "0 4px 15px rgba(238, 90, 111, 0.4)",
                        transition: "all 0.3s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow =
                          "0 6px 20px rgba(238, 90, 111, 0.5)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow =
                          "0 4px 15px rgba(238, 90, 111, 0.4)";
                      }}
                    >
                      <i className="fas fa-sync-alt me-2"></i>
                      Renew Subscription
                    </Link>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setShowExpiredPopup(false)}
                      style={{
                        borderRadius: "10px",
                        padding: "10px",
                        fontWeight: "500",
                        borderColor: "#dee2e6",
                        color: "#6c757d",
                      }}
                    >
                      I'll do this later
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <style>{`
              @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
              }
            `}</style>
          </div>
        )}

        {/* Subscription Expiry Warning Alert */}
        {expiryWarning?.isExpiringSoon && showExpiryAlert && (
          <div className="row mb-4">
            <div className="col-12">
              <div
                className="alert alert-warning alert-dismissible fade show"
                role="alert"
                style={{ borderLeft: "4px solid #ffc107" }}
              >
                <div className="d-flex align-items-center">
                  <i className="fas fa-exclamation-triangle fa-2x me-3 text-warning"></i>
                  <div className="flex-grow-1">
                    <h5 className="alert-heading mb-2">
                      {expiryWarning.daysRemaining === 1
                        ? "Your subscription expires tomorrow!"
                        : `Your subscription expires in ${expiryWarning.daysRemaining} days!`}
                    </h5>
                    <p className="mb-2">
                      Your <strong>{currentPlan.planId.name}</strong> plan will
                      expire on{" "}
                      <strong>
                        {new Date(expiryWarning.expiryDate).toLocaleDateString(
                          "en-GB",
                          {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }
                        )}
                      </strong>
                      .
                    </p>
                    <p className="mb-0">
                      To avoid service interruption, please renew your
                      subscription or upgrade to a different plan.
                    </p>
                    <div className="mt-3">
                      <Link
                        to="/portal/my-subscription"
                        className="btn btn-warning me-2"
                      >
                        <i className="fas fa-sync-alt me-2"></i>Renew
                        Subscription
                      </Link>
                      <Link to="/buy-plan" className="btn btn-primary">
                        <i className="fas fa-arrow-up me-2"></i>Upgrade Plan
                      </Link>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowExpiryAlert(false)}
                  aria-label="Close"
                ></button>
              </div>
            </div>
          </div>
        )}

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
                            currentPlan.expiryDate
                          ).toLocaleDateString()}
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Billing Period</strong>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              currentPlan.period === "yearly"
                                ? "badge-success-soft"
                                : "badge-primary-soft"
                            }`}
                          >
                            {currentPlan.period === "yearly"
                              ? "Yearly"
                              : "Monthly"}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Next Billing Date</strong>
                        </td>
                        <td>
                          {new Date(
                            currentPlan.expiryDate
                          ).toLocaleDateString()}
                          {new Date(currentPlan.expiryDate) > new Date() ? (
                            <span className="text-success ms-2">(Active)</span>
                          ) : (
                            <span className="text-danger ms-2">(Expired)</span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Max Documents</strong>
                        </td>
                        <td>
                          {currentPlan.period === "yearly"
                            ? currentPlan.planId.maxDocuments * 2
                            : currentPlan.planId.maxDocuments}
                          {currentPlan.period === "yearly" && (
                            <span className="text-success ms-1">
                              (2x yearly bonus)
                            </span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Max File Size</strong>
                        </td>
                        <td>
                          {currentPlan.period === "yearly"
                            ? currentPlan.planId.maxFileSize * 2
                            : currentPlan.planId.maxFileSize}
                          MB
                          {currentPlan.period === "yearly" && (
                            <span className="text-success ms-1">
                              (2x yearly bonus)
                            </span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Max URLs</strong>
                        </td>
                        <td>
                          {currentPlan.period === "yearly"
                            ? currentPlan.planId.maxUrls * 2
                            : currentPlan.planId.maxUrls}
                          {currentPlan.period === "yearly" && (
                            <span className="text-success ms-1">
                              (2x yearly bonus)
                            </span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Available Plans Section */}
        <div className="row">
          <div className="col-12 mb-3">
            <div className="d-flex justify-content-between align-items-center">
              <h4>Available Plans</h4>
              {/* Billing toggle */}
              <div
                className="form-check form-switch"
                style={{ userSelect: "none", cursor: "pointer" }}
              >
                <input
                  id="billingToggle"
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  onChange={toggleBilling}
                  checked={billingPeriod === "yearly"}
                />
                <label className="form-check-label" htmlFor="billingToggle">
                  {billingPeriod === "monthly" ? "Monthly" : "Yearly"}
                </label>
              </div>
            </div>
          </div>
          {allPlans &&
            allPlans.map((plan) => {
              const isYearly = billingPeriod === "yearly";
              const rawPrice = isYearly
                ? plan.yearlyPrice ?? plan.price * 12
                : plan.price;
              const price = rawPrice > 0 ? `£${rawPrice.toFixed(2)}` : "FREE";
              const isCurrentPlan = currentPlan?.planId?.name === plan.name;

              return (
                <div
                  key={plan._id}
                  className="col-xl-4 col-lg-6 col-md-12 col-12 mb-4"
                >
                  <div className="card h-100 card-lift">
                    <div
                      className={`card-body ${isCurrentPlan ? "active" : ""}`}
                    >
                      <h4 className="card-title">{plan.name}</h4>
                      <div className="price mb-3">
                        <h3>
                          {price}
                          {rawPrice > 0 && (
                            <small>/{isYearly ? "Year" : "Month"}</small>
                          )}
                        </h3>
                      </div>
                      <ul className="list-unstyled mb-4">
                        <li className="mb-2">
                          <i className="fas fa-check text-success me-2"></i>
                          {isYearly
                            ? plan.maxDocuments * 2
                            : plan.maxDocuments}{" "}
                          Documents
                          {isYearly && (
                            <span className="text-success ms-1">(2x)</span>
                          )}
                        </li>
                        <li className="mb-2">
                          <i className="fas fa-check text-success me-2"></i>
                          {isYearly ? plan.maxFileSize * 2 : plan.maxFileSize}MB
                          File Size
                          {isYearly && (
                            <span className="text-success ms-1">(2x)</span>
                          )}
                        </li>
                        <li className="mb-2">
                          <i className="fas fa-check text-success me-2"></i>
                          {isYearly ? plan.maxUrls * 2 : plan.maxUrls} URLs
                          {isYearly && (
                            <span className="text-success ms-1">(2x)</span>
                          )}
                        </li>
                      </ul>
                      {isCurrentPlan ? (
                        <div className="btn btn-success w-100 disabled">
                          Current Plan
                        </div>
                      ) : (
                        <Link
                          to={`/buy-plan?plan=${plan._id.toString()}&period=${billingPeriod}`}
                          className="btn btn-primary w-100"
                        >
                          Subscribe Now
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </>
    );
  }

  return (
    <>
      {/* Expired Plan Popup - shown when no active plan due to expiry */}
      {hasExpiredPlan && showExpiredPopup && (
        <div
          className="modal fade show"
          style={{
            display: "block",
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            zIndex: 1050,
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backdropFilter: "blur(2px)",
          }}
          tabIndex={-1}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowExpiredPopup(false);
            }
          }}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            style={{ maxWidth: "500px" }}
          >
            <div
              className="modal-content"
              style={{
                border: "none",
                borderRadius: "16px",
                boxShadow: "0 10px 40px rgba(220, 53, 69, 0.3)",
                backgroundColor: "#fff",
                overflow: "hidden",
              }}
            >
              {/* Header with gradient */}
              <div
                style={{
                  background:
                    "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)",
                  color: "white",
                  padding: "24px 30px",
                  textAlign: "center",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "-50px",
                    right: "-50px",
                    width: "150px",
                    height: "150px",
                    background: "rgba(255, 255, 255, 0.1)",
                    borderRadius: "50%",
                  }}
                ></div>
                <div
                  style={{
                    position: "absolute",
                    bottom: "-30px",
                    left: "-30px",
                    width: "100px",
                    height: "100px",
                    background: "rgba(255, 255, 255, 0.1)",
                    borderRadius: "50%",
                  }}
                ></div>
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div
                    style={{
                      fontSize: "48px",
                      marginBottom: "12px",
                      animation: "pulse 2s ease-in-out infinite",
                    }}
                  >
                    <i
                      className="fas fa-clock"
                      style={{
                        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
                      }}
                    ></i>
                  </div>
                  <h4
                    style={{
                      margin: 0,
                      fontWeight: "600",
                      fontSize: "22px",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Subscription Expired
                  </h4>
                  <p
                    style={{
                      margin: "8px 0 0 0",
                      opacity: 0.95,
                      fontSize: "14px",
                      fontWeight: "300",
                    }}
                  >
                    A gentle reminder
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowExpiredPopup(false)}
                  aria-label="Close"
                  style={{
                    position: "absolute",
                    top: "16px",
                    right: "16px",
                    opacity: 0.9,
                  }}
                ></button>
              </div>

              {/* Body */}
              <div style={{ padding: "32px 30px", backgroundColor: "#fff" }}>
                {/* Main message */}
                <div
                  style={{
                    textAlign: "center",
                    marginBottom: "24px",
                  }}
                >
                  <p
                    style={{
                      fontSize: "16px",
                      color: "#495057",
                      lineHeight: "1.6",
                      margin: 0,
                    }}
                  >
                    Your{" "}
                    <strong style={{ color: "#ee5a6f" }}>
                      {expiredPlanInfo?.planName || "Plan"}
                    </strong>{" "}
                    subscription expired on
                  </p>
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "12px 20px",
                      backgroundColor: "#fff5f5",
                      borderRadius: "8px",
                      display: "inline-block",
                    }}
                  >
                    <strong
                      style={{
                        color: "#ee5a6f",
                        fontSize: "16px",
                      }}
                    >
                      {expiredPlanInfo?.expiryDate
                        ? new Date(
                            expiredPlanInfo.expiryDate
                          ).toLocaleDateString("en-GB", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })
                        : "recently"}
                    </strong>
                  </div>
                </div>

                {/* Services info */}
                <div
                  style={{
                    backgroundColor: "#f8f9fa",
                    borderRadius: "12px",
                    padding: "20px",
                    marginBottom: "24px",
                    border: "1px solid #e9ecef",
                  }}
                >
                  <h6
                    style={{
                      color: "#495057",
                      fontSize: "14px",
                      fontWeight: "600",
                      marginBottom: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    <i
                      className="fas fa-info-circle me-2"
                      style={{ color: "#ee5a6f" }}
                    ></i>
                    Services Temporarily Unavailable
                  </h6>
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: 0,
                    }}
                  >
                    {[
                      "AI chatbots and agents",
                      "Document uploads",
                      "Website URL crawling",
                      "Chatbot interactions",
                    ].map((service, idx) => (
                      <li
                        key={idx}
                        style={{
                          padding: "8px 0",
                          color: "#6c757d",
                          fontSize: "14px",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <i
                          className="fas fa-times-circle me-2"
                          style={{ color: "#ee5a6f", fontSize: "12px" }}
                        ></i>
                        {service}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action buttons */}
                <div className="d-grid gap-2">
                  <Link
                    to="/portal"
                    className="btn btn-lg"
                    onClick={() => setShowExpiredPopup(false)}
                    style={{
                      background:
                        "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)",
                      border: "none",
                      color: "white",
                      fontWeight: "600",
                      borderRadius: "10px",
                      padding: "14px",
                      boxShadow: "0 4px 15px rgba(238, 90, 111, 0.4)",
                      transition: "all 0.3s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow =
                        "0 6px 20px rgba(238, 90, 111, 0.5)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow =
                        "0 4px 15px rgba(238, 90, 111, 0.4)";
                    }}
                  >
                    <i className="fas fa-sync-alt me-2"></i>
                    View Plans & Renew
                  </Link>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowExpiredPopup(false)}
                    style={{
                      borderRadius: "10px",
                      padding: "10px",
                      fontWeight: "500",
                      borderColor: "#dee2e6",
                      color: "#6c757d",
                    }}
                  >
                    I'll do this later
                  </button>
                </div>
              </div>
            </div>
          </div>
          <style>{`
            @keyframes pulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.05); }
            }
          `}</style>
        </div>
      )}

      <div className="row">
        <div className="col-12 mb-4">
          <div
            className={`alert ${
              hasExpiredPlan ? "alert-danger" : "alert-info"
            }`}
          >
            <h5>
              {hasExpiredPlan
                ? "Plan Expired - Services Revoked"
                : "No Active Plan"}
            </h5>
            <p>
              {hasExpiredPlan
                ? "Your subscription has expired and all services have been revoked. Please renew or upgrade to restore access."
                : "You currently don't have any active plan. Choose from our available plans below to get started."}
            </p>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-12 mb-3">
          <div className="d-flex justify-content-between align-items-center">
            <h4>Available Plans</h4>
            {/* Billing toggle */}
            <div
              className="form-check form-switch"
              style={{ userSelect: "none", cursor: "pointer" }}
            >
              <input
                id="billingToggleNoplan"
                className="form-check-input"
                type="checkbox"
                role="switch"
                onChange={toggleBilling}
                checked={billingPeriod === "yearly"}
              />
              <label className="form-check-label" htmlFor="billingToggleNoplan">
                {billingPeriod === "monthly" ? "Monthly" : "Yearly"}
              </label>
            </div>
          </div>
        </div>
        {availablePlans &&
          availablePlans.map((plan) => {
            const isYearly = billingPeriod === "yearly";
            const rawPrice = isYearly
              ? plan.yearlyPrice ?? plan.price * 12
              : plan.price;
            const price = rawPrice > 0 ? `£${rawPrice.toFixed(2)}` : "FREE";

            return (
              <div
                key={plan._id}
                className="col-xl-4 col-lg-6 col-md-12 col-12 mb-4"
              >
                <div className="card h-100 card-lift">
                  <div className="card-body">
                    <h4 className="card-title">{plan.name}</h4>
                    <div className="price mb-3">
                      <h3>
                        {price}
                        {rawPrice > 0 && (
                          <small>/{isYearly ? "Year" : "Month"}</small>
                        )}
                      </h3>
                    </div>
                    <ul className="list-unstyled mb-4">
                      <li className="mb-2">
                        <i className="fas fa-check text-success me-2"></i>
                        {isYearly
                          ? plan.maxDocuments * 2
                          : plan.maxDocuments}{" "}
                        Documents
                        {isYearly && (
                          <span className="text-success ms-1">(2x)</span>
                        )}
                      </li>
                      <li className="mb-2">
                        <i className="fas fa-check text-success me-2"></i>
                        {isYearly ? plan.maxFileSize * 2 : plan.maxFileSize}MB
                        File Size
                        {isYearly && (
                          <span className="text-success ms-1">(2x)</span>
                        )}
                      </li>
                      <li className="mb-2">
                        <i className="fas fa-check text-success me-2"></i>
                        {isYearly ? plan.maxUrls * 2 : plan.maxUrls} URLs
                        {isYearly && (
                          <span className="text-success ms-1">(2x)</span>
                        )}
                      </li>
                    </ul>
                    <Link
                      to={`/buy-plan?plan=${plan._id.toString()}&period=${billingPeriod}`}
                      className="btn btn-primary w-100"
                    >
                      Subscribe Now
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </>
  );
};

// Welcome Popup Component
const WelcomePopup = ({ currentPlan, onClose }) => {
  if (!currentPlan || !currentPlan.planId) {
    return null;
  }

  const plan = currentPlan.planId;
  const startDate = new Date(currentPlan.startDate);
  const expiryDate = new Date(currentPlan.expiryDate);
  const daysRemaining = Math.ceil(
    (expiryDate - new Date()) / (1000 * 60 * 60 * 24)
  );

  return (
    <>
      {/* Modal Backdrop - Grey background */}
      <div
        className="modal-backdrop fade show"
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          zIndex: 1040,
        }}
      ></div>

      {/* Modal - Colored content */}
      <div
        className="modal fade show"
        style={{
          display: "block",
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 1050,
          overflow: "auto",
        }}
        tabIndex="-1"
        role="dialog"
        onClick={onClose}
      >
        <div
          className="modal-dialog modal-dialog-centered"
          role="document"
          onClick={(e) => e.stopPropagation()}
          style={{
            zIndex: 1051,
            margin: "1.75rem auto",
          }}
        >
          <div
            className="modal-content"
            style={{
              backgroundColor: "#ffffff",
              border: "none",
              borderRadius: "8px",
              boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div
              className="modal-header"
              style={{
                backgroundColor: "#28a745",
                color: "#ffffff",
                borderBottom: "none",
                padding: "20px 30px",
                borderRadius: "8px 8px 0 0",
              }}
            >
              <h5
                className="modal-title"
                style={{ margin: 0, fontSize: "1.5rem", fontWeight: "bold" }}
              >
                <i className="fas fa-check-circle me-2"></i>
                Welcome to TalkNova!
              </h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onClose}
                aria-label="Close"
                style={{ opacity: 1 }}
              ></button>
            </div>
            <div
              className="modal-body"
              style={{
                backgroundColor: "#ffffff",
                padding: "30px",
                color: "#333333",
              }}
            >
              <div className="text-center mb-4">
                <i
                  className="fas fa-check-circle fa-3x text-success mb-3"
                  style={{ color: "#28a745" }}
                ></i>
                <h4
                  className="text-success"
                  style={{ color: "#28a745", fontWeight: "bold" }}
                >
                  Email Verified Successfully!
                </h4>
                <p className="text-muted" style={{ color: "#6c757d" }}>
                  Your account is now active and ready to use.
                </p>
              </div>

              <div
                className="card"
                style={{
                  border: "2px solid #28a745",
                  borderRadius: "8px",
                  backgroundColor: "#f8f9fa",
                }}
              >
                <div
                  className="card-header"
                  style={{
                    backgroundColor: "#e8f5e9",
                    borderBottom: "2px solid #28a745",
                    padding: "15px 20px",
                  }}
                >
                  <h5
                    className="mb-0"
                    style={{
                      color: "#155724",
                      fontWeight: "bold",
                      fontSize: "1.2rem",
                    }}
                  >
                    <i className="fas fa-crown text-warning me-2"></i>
                    Your Subscription Plan
                  </h5>
                </div>
                <div
                  className="card-body"
                  style={{ backgroundColor: "#ffffff", padding: "20px" }}
                >
                  <table className="table table-borderless mb-0">
                    <tbody>
                      <tr>
                        <td
                          style={{
                            fontWeight: "bold",
                            color: "#333",
                            width: "40%",
                          }}
                        >
                          Plan Name:
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              backgroundColor: "#007bff",
                              fontSize: "1rem",
                              padding: "8px 15px",
                              color: "#ffffff",
                            }}
                          >
                            {plan.name}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: "bold", color: "#333" }}>
                          Start Date:
                        </td>
                        <td style={{ color: "#555" }}>
                          {startDate.toLocaleDateString("en-GB", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: "bold", color: "#333" }}>
                          Expiry Date:
                        </td>
                        <td style={{ color: "#555" }}>
                          {expiryDate.toLocaleDateString("en-GB", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: "bold", color: "#333" }}>
                          Validity:
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              backgroundColor: "#17a2b8",
                              fontSize: "1rem",
                              padding: "8px 15px",
                              color: "#ffffff",
                            }}
                          >
                            {daysRemaining} days remaining
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td
                          style={{
                            fontWeight: "bold",
                            color: "#333",
                            verticalAlign: "top",
                          }}
                        >
                          Features:
                        </td>
                        <td>
                          <ul
                            className="list-unstyled mb-0"
                            style={{ color: "#555" }}
                          >
                            <li style={{ marginBottom: "8px" }}>
                              <i
                                className="fas fa-check text-success me-2"
                                style={{ color: "#28a745" }}
                              ></i>
                              {plan.maxDocuments} Documents
                            </li>
                            <li style={{ marginBottom: "8px" }}>
                              <i
                                className="fas fa-check text-success me-2"
                                style={{ color: "#28a745" }}
                              ></i>
                              {plan.maxFileSize}MB Max File Size
                            </li>
                            <li>
                              <i
                                className="fas fa-check text-success me-2"
                                style={{ color: "#28a745" }}
                              ></i>
                              {plan.maxUrls} Web URLs
                            </li>
                          </ul>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div
                className="alert alert-info mt-3 mb-0"
                style={{
                  backgroundColor: "#d1ecf1",
                  borderColor: "#bee5eb",
                  color: "#0c5460",
                  padding: "15px",
                  borderRadius: "5px",
                }}
              >
                <i className="fas fa-info-circle me-2"></i>
                <strong>Note:</strong> A confirmation email with your plan
                details has been sent to your email address.
              </div>
            </div>
            <div
              className="modal-footer"
              style={{
                backgroundColor: "#f8f9fa",
                borderTop: "1px solid #dee2e6",
                padding: "20px 30px",
                borderRadius: "0 0 8px 8px",
              }}
            >
              <button
                type="button"
                className="btn btn-primary"
                onClick={onClose}
                style={{
                  backgroundColor: "#007bff",
                  borderColor: "#007bff",
                  padding: "10px 30px",
                  fontSize: "1rem",
                  fontWeight: "bold",
                  borderRadius: "5px",
                  color: "#ffffff",
                }}
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// Main component
const PortalDashboard = () => {
  const { user, roles, data, showWelcomePopup } = useLoaderData<
    LoaderData & { showWelcomePopup?: boolean }
  >();
  const [showPopup, setShowPopup] = useState(false);
  const [planData, setPlanData] = useState(null);
  const fetcher = useFetcher();

  console.log("user", user);

  useEffect(() => {
    console.log("Welcome popup effect:", {
      showWelcomePopup,
      isClient: roles.includes("CLIENT"),
      hasData: !!data,
    });

    if (showWelcomePopup && roles.includes("CLIENT")) {
      // Wait for data to load
      data
        .then((resolvedData) => {
          console.log("Data resolved for welcome popup:", {
            hasCurrentPlan: !!resolvedData.currentPlan,
          });
          if (resolvedData.currentPlan) {
            setPlanData(resolvedData.currentPlan);
            setShowPopup(true);
          }
        })
        .catch((error) => {
          console.error("Error loading data for welcome popup:", error);
        });
    }
  }, [showWelcomePopup, roles, data]);

  // Handle fetcher response
  useEffect(() => {
    if (fetcher.data?.success) {
      console.log("✓ Welcome popup marked as shown - will not show again");
    } else if (fetcher.data?.error) {
      console.error("✗ Failed to mark welcome popup:", fetcher.data.error);
    }
  }, [fetcher.data]);

  // Mark welcome popup as shown when user closes it
  const handlePopupClose = async () => {
    console.log("🔵 Closing welcome popup, marking as shown...");

    // IMPORTANT: Mark as shown BEFORE closing the popup
    try {
      // Use direct fetch first to ensure it completes
      const response = await fetch("/portal/mark-welcome-shown", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        console.error("✗ API call failed with status:", response.status);
        const errorText = await response.text();
        console.error("Error response:", errorText);
      } else {
        const result = await response.json();
        console.log("✅ Mark welcome shown response:", result);

        if (result.success) {
          console.log("✅ Welcome popup marked as shown successfully");
        } else {
          console.error("✗ Failed to mark welcome popup:", result.error);
        }
      }

      // Also submit via fetcher as backup (non-blocking)
      fetcher.submit(
        {},
        {
          method: "POST",
          action: "/portal/mark-welcome-shown",
        }
      );
    } catch (error) {
      console.error("❌ Error in handlePopupClose:", error);
    }

    // Close popup after initiating the API call
    setShowPopup(false);
  };

  return (
    <AdminLayout>
      {showPopup && planData && (
        <WelcomePopup currentPlan={planData} onClose={handlePopupClose} />
      )}
      <div className="row">
        <div className="col-lg-12 col-md-12 col-12">
          {/* Page header */}
          <div className="d-flex justify-content-between align-items-center mb-5">
            <div className="mb-2 mb-lg-0">
              <h3 className="mb-0 text-white">
                Welcome, {`${user.firstName} ${user.lastName}`}
              </h3>
            </div>
          </div>
        </div>
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <Await resolve={data}>
          {(resolvedData) => {
            if (roles.includes("SUPER_ADMIN")) {
              return <AdminDashboard data={resolvedData} user={user} />;
            } else if (roles.includes("COURSEPROVIDER")) {
              return <ProviderDashboard data={resolvedData} user={user} />;
            } else if (roles.includes("CLIENT")) {
              return <ClientDashboard data={resolvedData} user={user} />;
            }
            return null;
          }}
        </Await>
      </Suspense>
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
        <p>{error instanceof Error ? error?.message : "Unknown error"}</p>
      </div>
    </AdminLayout>
  );
}
