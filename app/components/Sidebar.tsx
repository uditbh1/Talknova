// app/components/Sidebar.jsx
import React from 'react';
import { Link } from '@remix-run/react';
import Navbar from './Navbar';

const Sidebar = () => {
  return (
    <div className="app-menu">
      <div className="navbar-vertical navbar nav-dashboard">
        <div className="h-100" data-simplebar>
          <Link className="navbar-brand hide-mobile" to="/portal">
            <img src="/assets/images/brand/logo/logo.png" alt="Logo" />
          </Link>
          <Navbar />
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
