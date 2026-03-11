import React, { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate, useLocation } from "react-router-dom";
import FloatingParticles from "../components/auth/ui/FloatingParticles.jsx";
import AuthForm from "../components/auth/AuthForm.jsx";
import HeroSection from "../components/HeroSection.jsx";

const AuthPage = () => {
  const { isAuthenticated, isLoading } = useAuth0();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      const returnTo = location.state?.from || "/chat";
      navigate(returnTo, { replace: true });
    }
  }, [isAuthenticated, isLoading, location.state?.from, navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(94,234,212,0.16),transparent_26%),radial-gradient(circle_at_85%_10%,rgba(96,165,250,0.2),transparent_24%),linear-gradient(135deg,#040914_0%,#09121f_46%,#0d1628_100%)]" />
        <div className="absolute left-[-6rem] top-[-4rem] h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-[-7rem] right-[-4rem] h-80 w-80 rounded-full bg-blue-500/12 blur-3xl" />
      </div>

      <FloatingParticles />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1500px] items-center">
        <div className="premium-panel mesh-accent grid w-full overflow-hidden rounded-[2rem] border border-white/10 lg:grid-cols-[minmax(420px,0.9fr)_minmax(480px,1.1fr)]">
          <AuthForm />
          <HeroSection />
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
