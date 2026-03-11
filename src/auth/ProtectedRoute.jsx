import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Navigate, useLocation } from "react-router-dom";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth0();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-white">
        <div className="premium-card rounded-[1.5rem] px-6 py-5 text-center">
          <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">
            Auth check
          </div>
          <div className="mt-3 text-sm text-slate-300/82">
            Loading your session...
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return children;
};

export default ProtectedRoute;
