// app/components/Navbar.jsx
import { NavLink, useLoaderData, useLocation, Form } from '@remix-run/react';
import { useEffect } from 'react';
import feather from 'feather-icons';

const navLinks = [
  {
    name: 'Dashboard',
    path: '/portal',
    featherIcon: 'home',
    roles: ['ALL'],
  },

  {
    name: 'Clients',
    path: '/portal/clients',
    featherIcon: 'users',
    roles: ['SUPER_ADMIN'],
  },

  {
    name: 'Plans',
    path: '/portal/plans',
    featherIcon: 'package',
    roles: ['SUPER_ADMIN'],
  },

  {
    name: 'Chat Agents',
    path: '/portal/chatagents',
    featherIcon: 'mic',
    roles: ['ALL'],
  },

  {
    name: 'Subscription',
    path: '/portal/my-subscription',
    featherIcon: 'credit-card',
    roles: ['ALL'],
  },

  {
    name: 'Chat History',
    path: '/portal/chat-history',
    featherIcon: 'message-circle',
    roles: ['ALL'],
  },

  {
    name: 'Email Templates',
    path: '/portal/email-templates',
    featherIcon: 'mail',
    roles: ['SUPER_ADMIN'],
  },
  {
    name: 'Coupons',
    path: '/portal/coupons',
    featherIcon: 'tag',
    roles: ['SUPER_ADMIN'],
  },

  {
    name: 'Payments',
    path: '/portal/payments',
    featherIcon: 'dollar-sign',
    roles: ['SUPER_ADMIN'],
  },

  {
    name: 'Reviews',
    path: '/portal/reviews',
    featherIcon: 'star',
    roles: ['SUPER_ADMIN'],
  },
  //contact us
  {
    name: 'Contact Us',
    path: '/portal/contactus',
    featherIcon: 'mail',
    roles: ['SUPER_ADMIN'],
  },
  {
    name: 'Settings',
    path: '/portal/settings',
    featherIcon: 'settings',
    roles: ['SUPER_ADMIN'],
  },
  {
    name: 'Logout',
    path: '/logout',
    featherIcon: 'log-out',
    roles: ['ALL'],
  },
];

const Navbar = () => {
  const { user } = useLoaderData() || {};
  const location = useLocation();
  const roles = user?.roles || [];

  const filteredNavLinks = navLinks.filter(nav => {
    if (nav.roles.includes('ALL')) return true;
    return nav.roles.some(role => roles.includes(role));
  });

  filteredNavLinks.forEach(nav => {
    if (nav.subMenu) {
      nav.subMenu = nav.subMenu.filter(sub => {
        if (sub.roles.includes('ALL')) return true;
        return sub.roles.some(role => roles.includes(role));
      });
    }
  });

  useEffect(() => {
    feather.replace();
    
    // Ensure sidebar is visible
    const sidebar = document.querySelector('.app-menu');
    if (sidebar) {
      sidebar.style.display = '';
    }
    
    // Handle active nav links and collapse states
    const activeNavLink = document.querySelector('.nav-link.active');
    if (activeNavLink) {
      const collapseElement = activeNavLink.closest('.collapse');
      if (collapseElement) {
        collapseElement.classList.add('show');
        const parentLink = collapseElement.previousElementSibling;
        if (parentLink) {
          parentLink.classList.add('active');
          parentLink.setAttribute('aria-expanded', 'true');
        }
      }
    }
    
    // Ensure main wrapper is not toggled (sidebar visible)
    const mainWrapper = document.getElementById('main-wrapper');
    if (mainWrapper) {
      mainWrapper.classList.remove('toggled');
    }
  }, [location.pathname]);

  return (
    <ul className="navbar-nav flex-column pt-12" id="sideNavbar">
      {filteredNavLinks.map((link, index) => (
        <li className="nav-item" key={index}>
          {link.subMenu ? (
            <>
              <a
                className="nav-link has-arrow"
                href="#!"
                data-bs-toggle="collapse"
                data-bs-target={`#nav${link.name.replace(/\s+/g, '')}`}
                aria-expanded="false"
                aria-controls={`nav${link.name.replace(/\s+/g, '')}`}>
                <i data-feather={link.featherIcon} className="nav-icon me-2 icon-xxs" /> {link.name}
              </a>
              <div id={`nav${link.name.replace(/\s+/g, '')}`} className="collapse" data-bs-parent="#sideNavbar">
                <ul className="nav flex-column">
                  {link.subMenu.map((subLink, subIndex) => (
                    <li className="nav-item" key={subIndex}>
                      <NavLink prefetch="none" className="nav-link" to={subLink.path}>
                        {subLink.name}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : link.path === '/logout' ? (
            <Form action="/logout" method="post" style={{ width: '100%', margin: 0, padding: 0 }}>
              <button type="submit" className="nav-link" style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', color: 'inherit', cursor: 'pointer' }}>
                <i data-feather={link.featherIcon} className="nav-icon me-2 icon-xxs" /> {link.name}
              </button>
            </Form>
          ) : (
            <NavLink prefetch="none" className="nav-link" to={link.path}>
              <i data-feather={link.featherIcon} className="nav-icon me-2 icon-xxs" /> {link.name}
            </NavLink>
          )}
        </li>
      ))}
    </ul>
  );
};

export default Navbar;

