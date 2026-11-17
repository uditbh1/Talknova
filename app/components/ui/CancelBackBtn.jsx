import { useNavigate, Link } from '@remix-run/react';

function CancelBackBtn({ txt = 'Cancel', className = 'btn btn-primary ms-3', to, ...props }) {
  const navigate = useNavigate();
  const goBack = () => navigate(-1);

  return (
    <Link onClick={!to ? goBack : undefined} to={to || '#'} className={className} {...props}>
      {txt}
    </Link>
  );
}

export default CancelBackBtn;
