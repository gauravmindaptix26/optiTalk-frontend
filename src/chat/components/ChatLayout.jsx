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
    <div className="min-h-[100dvh] w-screen overflow-hidden bg-gradient-to-br from-[#0f1535] via-[#191f48] to-[#1f0f2f] text-white">
      <div className="mx-auto flex h-[100dvh] min-h-[100dvh] max-w-screen-2xl flex-col px-2 py-2 sm:px-4 sm:py-4">
        <div className="relative flex h-full min-h-0 flex-1 flex-col gap-2 lg:flex-row lg:gap-4">
          <div
            className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition lg:hidden ${
              sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`}
            onClick={onCloseSidebar}
          />

          <div
            className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition 2xl:hidden ${
              infoPanelOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`}
            onClick={onCloseInfoPanel}
          />

          <aside
            className={`fixed inset-y-0 left-0 z-50 flex w-[88vw] max-w-sm flex-col gap-3 transform p-2 transition duration-300 lg:static lg:z-auto lg:w-[280px] lg:max-w-none lg:transform-none lg:p-0 xl:w-80 ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            }`}
          >
            <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-purple-900/30 backdrop-blur-xl">
              {sidebar}
            </div>
          </aside>

          <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/5 shadow-2xl shadow-purple-900/30 backdrop-blur-xl">
              <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto]">
                {chatHeader}
                <div className="min-h-0 overflow-hidden">{messageList}</div>
                {composer}
              </div>
            </div>
          </main>

          <aside className="hidden w-72 2xl:flex">{rightPanel ?? null}</aside>

          <aside
            className={`fixed inset-x-2 bottom-2 z-50 flex max-h-[72dvh] flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#111735]/95 shadow-2xl shadow-purple-900/40 backdrop-blur-xl transition duration-300 2xl:hidden ${
              infoPanelOpen
                ? "translate-y-0 opacity-100"
                : "pointer-events-none translate-y-[110%] opacity-0"
            }`}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="text-sm font-semibold text-white">Chat info</div>
              <button
                type="button"
                onClick={onCloseInfoPanel}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg"
                aria-label="Close info panel"
              >
                ×
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto p-2">
              {rightPanel ?? null}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
