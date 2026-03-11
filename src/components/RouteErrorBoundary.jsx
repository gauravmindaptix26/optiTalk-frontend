import React from "react";

class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Route render failed", error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-white">
        <div className="premium-card max-w-md rounded-[1.6rem] px-6 py-6 text-center">
          <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">
            App error
          </div>
          <div className="mt-3 text-lg font-semibold text-white">
            Something went wrong while opening this page.
          </div>
          <div className="mt-2 text-sm text-slate-300/82">
            Try going back to the login page and opening chat again.
          </div>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              className="rounded-xl border border-white/10 bg-white/8 px-4 py-2 text-sm text-white transition hover:bg-white/12"
              onClick={() => window.location.assign("/")}
            >
              Open login
            </button>
            <button
              type="button"
              className="rounded-xl bg-[linear-gradient(135deg,#14b8a6_0%,#0ea5e9_42%,#2563eb_100%)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-95"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default RouteErrorBoundary;
