import { Form, Link, NavLink, useLoaderData } from '@remix-run/react';
import { useNavigate } from '@remix-run/react';
import { useEffect, useState } from 'react';

const FrontHeaderBar = () => {
  const { user } = useLoaderData();
  const navigate = useNavigate();
  let roles = user?.roles || [];

  return (
    <header>
      {/* ---------- Mobile off‑canvas navigation ---------- */}
      <div className="mobile-nav d-lg-none">
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="offcanvas"
          data-bs-target="#offcanvasExample"
          aria-controls="offcanvasExample"
          aria-label="Toggle navigation">
          <i className="fas fa-bars" />
        </button>

        <div className="offcanvas offcanvas-start" tabIndex={-1} id="offcanvasExample" aria-labelledby="offcanvasExampleLabel">
          <div className="offcanvas-header">
            <h5 className="offcanvas-title" id="offcanvasExampleLabel">
              <Link className="navbar-brand" to="/">
                <img src="/frontend/images/logo.png" alt="Site logo" style={{ width: '120px', maxWidth: '120px' }} />
              </Link>
            </h5>
            <button type="button" className="btn-close text-reset" data-bs-dismiss="offcanvas" aria-label="Close" />
          </div>

          <div className="offcanvas-body">
            <div className="dropdown mt-0">
              {user ? (
                <>
                  <Link to="/portal" className="document-btn me-2">
                    Dashboard
                  </Link>
                  <Form action="/logout" method="post" className="d-inline">
                    <button type="submit" className="document-btn" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                      Log Out
                    </button>
                  </Form>
                </>
              ) : (
                <Link to="/login" className="document-btn">
                  Log In
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Desktop / full‑width navigation ---------- */}
      <nav className="navbar navbar-expand-lg navbar-light top-navbar" data-toggle="sticky-onscroll">
        <div className="container">
          <Link className="navbar-brand" to="/">
            <img src="/frontend/images/logo.png" alt="Site logo" style={{ width: '120px', maxWidth: '120px' }} />
          </Link>

          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarSupportedContent"
            aria-controls="navbarSupportedContent"
            aria-expanded="false"
            aria-label="Toggle navigation">
            <span className="navbar-toggler-icon" />
          </button>

          <div className="collapse navbar-collapse justify-content-end" id="navbarSupportedContent">
            <ul className="navbar-nav pull-right" />

            {user ? (
              <>
                <Link to="/portal" className="document-btn me-2">
                  Dashboard
                </Link>
                <Form action="/logout" method="post" className="d-inline">
                  <button type="submit" className="document-btn" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                    Log Out
                  </button>
                </Form>
              </>
            ) : (
              <Link to="/login" className="document-btn">
                Log In
              </Link>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
};

export default FrontHeaderBar;
