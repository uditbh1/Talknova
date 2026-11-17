import { NavLink, useLoaderData, Form} from '@remix-run/react';
import { useEffect } from "react";
import feather from "feather-icons";
const HeaderBar = () => {
  const { user } = useLoaderData() || {};

useEffect(() => {
    feather.replace();

    // Initialize nav toggle functionality
    const navToggle = document.getElementById("nav-toggle");
    const mainWrapper = document.getElementById("main-wrapper");

    if (navToggle && mainWrapper) {
      const handleNavToggle = (e: Event) => {
        e.preventDefault();
        mainWrapper.classList.toggle("toggled");
      };

      navToggle.addEventListener("click", handleNavToggle);

      // Initialize Bootstrap dropdowns manually as fallback
      const initDropdowns = () => {
        if (window.bootstrap) {
          const notificationDropdown = document.getElementById(
            "dropdownNotification"
          );
          const userDropdown = document.getElementById("dropdownUser");

          if (
            notificationDropdown &&
            !notificationDropdown.hasAttribute("data-bs-dropdown-initialized")
          ) {
            new window.bootstrap.Dropdown(notificationDropdown);
            notificationDropdown.setAttribute(
              "data-bs-dropdown-initialized",
              "true"
            );
          }

          if (
            userDropdown &&
            !userDropdown.hasAttribute("data-bs-dropdown-initialized")
          ) {
            new window.bootstrap.Dropdown(userDropdown);
            userDropdown.setAttribute("data-bs-dropdown-initialized", "true");
          }
        } else {
          // Fallback: manual dropdown toggle
          const notificationTrigger = document.getElementById(
            "dropdownNotification"
          );
          const notificationMenu = document.querySelector(
            '[aria-labelledby="dropdownNotification"]'
          );

          if (
            notificationTrigger &&
            notificationMenu &&
            !notificationTrigger.hasAttribute("manual-dropdown-initialized")
          ) {
            notificationTrigger.addEventListener("click", (e) => {
              e.preventDefault();
              notificationMenu.classList.toggle("show");
            });
            notificationTrigger.setAttribute(
              "manual-dropdown-initialized",
              "true"
            );
          }
        }
      };

      // Try to initialize dropdowns with a delay
      setTimeout(initDropdowns, 1000);

      // Cleanup
      return () => {
        navToggle.removeEventListener("click", handleNavToggle);
      };
    }
  }, []);



  return (
    <div className="header">
      {/* navbar */}
      <div className="navbar-custom navbar navbar-expand-lg">
        <div className="container-fluid px-0">
          <a className="navbar-brand d-block d-md-none" href="/">
            <img src="/assets/images/brand/logo/logo.png" alt="Image" />
          </a>
          <a id="nav-toggle" href="#!" className="ms-auto ms-md-0 me-0 me-lg-3 ">
            <svg xmlns="http://www.w3.org/2000/svg" width={28} height={28} fill="currentColor" className="bi bi-text-indent-left text-muted" viewBox="0 0 16 16">
              <path d="M2 3.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm.646 2.146a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1 0 .708l-2 2a.5.5 0 0 1-.708-.708L4.293 8 2.646 6.354a.5.5 0 0 1 0-.708zM7 6.5a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5zm-5 3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z" />
            </svg>
          </a>
          <div className="d-none d-md-none d-lg-block">
            {/* Form */}
            <form action="#">
              <div className="input-group ">
                <input className="form-control rounded-3" type="search" defaultValue="" name="headersearch" id="headersearch" placeholder="Search" />
                <span className="input-group-append">
                  <button className="btn  ms-n10 rounded-0 rounded-end" type="button">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width={15}
                      height={15}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="feather feather-search text-dark">
                      <circle cx={11} cy={11} r={8} />
                      <line x1={21} y1={21} x2="16.65" y2="16.65" />
                    </svg>
                  </button>
                </span>
              </div>
            </form>
          </div>
          {/*Navbar nav */}
          <ul className="navbar-nav navbar-right-wrap ms-lg-auto d-flex nav-top-wrap align-items-center ms-4 ms-lg-0">
            <li className="dropdown stopevent ms-2">
              <a
                className="btn btn-ghost btn-icon rounded-circle"
                href="#!"
                role="button"
                id="dropdownNotification"
                data-bs-toggle="dropdown"
                aria-haspopup="true"
                aria-expanded="false">
                <i className="icon-xs" data-feather="bell" />
              </a>
              <div className="dropdown-menu dropdown-menu-lg dropdown-menu-end" aria-labelledby="dropdownNotification">
                <div>
                  <div
                    className="border-bottom px-3 pt-2 pb-3 d-flex
justify-content-between align-items-center">
                    <p className="mb-0 text-dark fw-medium fs-4">Notifications</p>
                    <a href="#!" className="text-muted">
                      <span>
                        <i className="me-1 icon-xs" data-feather="settings" />
                      </span>
                    </a>
                  </div>
                  <div data-simplebar style={{ height: 100 }}>
                    {/* List group */}
                    <ul className="list-group list-group-flush notification-list-scroll">
                      {/* List group item */}
                      <li className="list-group-item bg-light">
                        <a href="#!" className="text-muted">
                          <h5 className=" mb-1">Important Notice</h5>
                          <p className="mb-0"> Complete your profile. </p>
                        </a>
                      </li>
                    </ul>
                  </div>
                  <div className="border-top px-3 py-2 text-center">
                    <a href="#!" className="text-inherit ">
                      {' '}
                      View all Notifications{' '}
                    </a>
                  </div>
                </div>
              </div>
            </li>
            {/* List */}
            <li className="dropdown ms-2">
              <a className="rounded-circle" href="#!" role="button" id="dropdownUser" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                <div className="avatar avatar-md avatar-indicators avatar-online" style={{ height: '2.5rem', width: '2.5rem' }}>
                  <img alt="avatar" src="/assets/images/avatar/office-man.png" className="rounded-circle" style={{ height: '100%', width: '100%', objectFit: 'cover' }} />
                </div>
              </a>
              <div className="dropdown-menu dropdown-menu-end" aria-labelledby="dropdownUser">
                <div className="px-4 pb-0 pt-2">
                  <div className="lh-1 ">
                    <h5 className="mb-1">
                      {' '}
                      {user?.firstName} {user?.lastName}{' '}
                    </h5>
                    <a href="#!" className="text-inherit fs-6">
                      {user?.email}
                    </a>
                  </div>
                  <div className=" dropdown-divider mt-3 mb-2" />
                </div>
                <ul className="list-unstyled">
                  <li>
                    <Form action="/logout" method="post" className="d-inline">
                      <button type="submit" className="dropdown-item" style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', padding: '0.5rem 1rem' }}>
                        <i className="me-2 icon-xxs dropdown-item-icon" data-feather="power" />
                        Sign Out
                      </button>
                    </Form>
                  </li>
                </ul>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HeaderBar;
