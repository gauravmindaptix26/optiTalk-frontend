import React from "react";

export default function ChatLayout({
  sidebar,
  chatHeader,
  messageList,
  composer,
  rightPanel,
  sidebarOpen = false,
  infoPanelOpen = false,
  onCloseSidebar = () => {},
  onCloseInfoPanel = () => {},
}) {
  return (
    <div className="relative min-h-[100dvh] w-screen overflow-hidden text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-8rem] top-[-8rem] h-72 w-72 rounded-full bg-cyan-400/12 blur-3xl [animation:floatAura_12s_ease-in-out_infinite]" />
        <div className="absolute right-[-7rem] top-[10%] h-80 w-80 rounded-full bg-blue-500/12 blur-3xl [animation:floatAura_14s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-8rem] left-[22%] h-96 w-96 rounded-full bg-emerald-400/8 blur-3xl [animation:floatAura_16s_ease-in-out_infinite]" />
      </div>

      <div className="relative mx-auto flex h-[100dvh] min-h-[100dvh] max-w-[1700px] flex-col px-2 py-2 sm:px-4 sm:py-4 xl:px-5">
        <div className="relative flex h-full min-h-0 flex-1 flex-col gap-2 lg:flex-row lg:gap-4">
          <div
            className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition lg:hidden ${
              sidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
            }`}
            onClick={onCloseSidebar}
          />

          <div
            className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition 2xl:hidden ${
              infoPanelOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
            }`}
            onClick={onCloseInfoPanel}
          />

          <aside
            className={`fixed inset-y-0 left-0 z-50 flex w-[88vw] max-w-sm flex-col gap-3 transform p-2 transition duration-300 lg:static lg:z-auto lg:w-[320px] lg:max-w-none lg:transform-none lg:p-0 xl:w-[360px] ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            }`}
          >
            <div className="premium-panel mesh-accent flex h-full min-h-0 flex-col gap-4 overflow-hidden rounded-[2rem] p-4">
              {sidebar}
            </div>
          </aside>

          <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
            <div className="premium-panel relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2rem]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(94,234,212,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(96,165,250,0.08),transparent_26%)]" />
              <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto]">
                {chatHeader}
                <div className="min-h-0 overflow-hidden">{messageList}</div>
                {composer}
              </div>
            </div>
          </main>

          <aside className="hidden w-[320px] 2xl:flex">{rightPanel ?? null}</aside>

          <aside
            className={`premium-panel fixed inset-x-2 bottom-2 z-50 flex max-h-[76dvh] flex-col overflow-hidden rounded-[1.9rem] transition duration-300 2xl:hidden ${
              infoPanelOpen
                ? "translate-y-0 opacity-100"
                : "pointer-events-none translate-y-[110%] opacity-0"
            }`}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/65">
                  Workspace
                </div>
                <div className="text-sm font-semibold text-white">Chat info</div>
              </div>
              <button
                type="button"
                onClick={onCloseInfoPanel}
                className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg transition hover:bg-white/10"
                aria-label="Close info panel"
              >
                ×
              </button>
            </div>
            <div className="soft-scrollbar min-h-0 overflow-y-auto p-2">
              {rightPanel ?? null}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
