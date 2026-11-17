import { useNavigate } from '@remix-run/react';

export default function ErrorBoundary({ error }: { error: Error }) {
  const navigate = useNavigate();

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card">
            <div className="card-body text-center">
              <h1 className="h4 mb-4">Oops! Something went wrong</h1>
              <p className="text-muted mb-4">{error.message}</p>
              <div className="d-flex justify-content-center gap-3">
                <button 
                  onClick={() => navigate(-1)} 
                  className="btn btn-secondary"
                >
                  Go Back
                </button>
                <button 
                  onClick={() => window.location.reload()} 
                  className="btn btn-primary"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 