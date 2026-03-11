import React, { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AuthPage from "./pages/AuthPage";
import ProtectedRoute from "./auth/ProtectedRoute";
import RouteErrorBoundary from "./components/RouteErrorBoundary";

const ChatPage = lazy(() => import("./chat/ChatPage"));

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center px-6 text-white">
    <div className="premium-card rounded-[1.5rem] px-6 py-5 text-center">
      <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">
        Loading
      </div>
      <div className="mt-3 text-sm text-slate-300/82">
        Opening your workspace...
      </div>
    </div>
  </div>
);

function App() {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<AuthPage />} />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  );
}

export default App;
