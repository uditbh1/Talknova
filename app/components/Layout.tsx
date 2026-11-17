import { useEffect } from 'react';
import Sidebar from './Sidebar';
import HeaderBar from './HeaderBar';

const Layout = ({ children }) => {
  useEffect(() => {
    // Load dashboard-specific scripts only (stylesheets are loaded via portal.tsx links export)
    if (typeof window === 'undefined') return;

    const loadDashboardScripts = () => {
      // Scripts
      const scripts = [
        { src: 'https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js', id: 'jquery' },
        { src: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js', id: 'bootstrap' },
        { src: '/assets/libs/feather-icons/dist/feather.min.js', id: 'feather' },
        { src: 'https://cdn.jsdelivr.net/npm/simplebar@latest/dist/simplebar.min.js', id: 'simplebar-js' },
        { src: 'https://cdn.jsdelivr.net/npm/@popperjs/core@2.11.8/dist/umd/popper.min.js', id: 'popper' },
        { src: 'https://cdn.jsdelivr.net/npm/tippy.js@6.3.7/dist/tippy-bundle.umd.min.js', id: 'tippy' },
        { src: '/assets/js/vendors/tooltip.js', id: 'tooltip' },
        { src: '/assets/libs/datatables/media/js/jquery.dataTables.min.js', id: 'datatables-js' },
        { src: '/assets/libs/datatables.net-bs5/js/dataTables.bootstrap5.min.js', id: 'datatables-bs5' },
        { src: '/assets/libs/datatables.net-responsive/js/dataTables.responsive.min.js', id: 'datatables-responsive' },
        { src: '/assets/js/vendors/datatable.js', id: 'datatable-init' },
        { src: 'https://cdn.jsdelivr.net/npm/apexcharts@3.44.0/dist/apexcharts.min.js', id: 'apexcharts' },
        { src: 'https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.min.js', id: 'quill' },
        { src: '/assets/js/theme.min.js', id: 'theme-js' },
      ];

      scripts.forEach(({ src, id }) => {
        if (!document.getElementById(id) && !document.querySelector(`script[src="${src}"]`)) {
          const script = document.createElement('script');
          script.src = src;
          script.id = id;
          document.head.appendChild(script);
        }
      });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadDashboardScripts);
    } else {
      loadDashboardScripts();
    }
  }, []);

  return (
    <main id="main-wrapper" className="main-wrapper">
      <HeaderBar />
      <Sidebar />
      <div id="app-content">
        <div className="app-content-area">
          <div className="bg-primary pt-10 pb-21 mt-n6 mx-n4"></div>
          <div className="container-fluid mt-n22">{children}</div>
        </div>
      </div>
    </main>
  );
};

export default Layout;
