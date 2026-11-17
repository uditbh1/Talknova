import { NavLink, useLoaderData, Link } from '@remix-run/react';
const FrontFooterBar = () => {
  const { user } = useLoaderData() || {};
  return (
    <footer>
      <div className="container">
        <div className="row">
          <div className="col-lg-4 col-md-4 col-sm-12 col-xs-12">
            <div className="logofooter">
              <img src="/frontend/images/logo.png" className="w-50 mb-2" />
            </div>
            <div className="footerleft "></div>
          </div>
          <div className="col-lg-4 col-md-4 col-sm-12 col-xs-12">
            <h5>Quick Links</h5>
            <ul>
              <li>
                <Link to="/privacy-policy">Privacy Policy</Link>
              </li>
              <li>
                <Link to="/terms-of-service">Terms of Service</Link>
              </li>
              <li>
                <Link to="/refund-policy">Refund Policy</Link>
              </li>
            </ul>
          </div>
          <div className="col-lg-4 col-md-4 col-sm-12 col-xs-12">
            <h5>Contact </h5>
            <div className="footerleft">
              <p>
                <i className="fa fa-map-marker" />
                1004 The Vista Building 30 Calderwood Street London SE18 6JH
              </p>
              <p>
                <i className="fa fa-phone" /> Enquiry: +44 (0)800 0996062{' '}
              </p>
            </div>
          </div>
        </div>
        <div className="copyright">
          <div className="copyright-leftbar">
            <p>© 2025 Talk Nova All rights reserved</p>
          </div>
          <div className="copyright-rightbar">
            <ul>
              <li>
                {' '}
                <a href="https://www.facebook.com/profile.php?id=61578158835683" target="_blank">
                  <i className="fab fa-facebook-f"></i>
                </a>
              </li>
              <li>
                <a href="https://www.linkedin.com/company/talknova-ai/?viewAsMember=true" target="_blank">
                  <i className="fab fa-linkedin-in"></i>
                </a>
              </li>
              <li>
                <a href="https://x.com/talknova69443?s=11" target="_blank">
                  <i className="fab fa-twitter"></i>
                </a>
              </li>
              <li>
                <a href="https://www.instagram.com/talknova_ai/" target="_blank">
                  <i className="fab fa-instagram"></i>
                </a>
              </li>

              <li>
                <a href="https://t.me/talknovaai_bot" target="_blank">
                  <i className="fab fa-telegram"></i>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default FrontFooterBar;
