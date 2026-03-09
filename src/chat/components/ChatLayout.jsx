import React from "react";

export default function ChatLayout({
  sidebar,
  chatHeader,
  messageList,
  composer,
  rightPanel,
  sidebarOpen = false,
  onToggleSidebar = () => {},
  onCloseSidebar = () => {},
}) {
  return (
    <div className="min-h-[100dvh] w-screen overflow-x-hidden bg-gradient-to-br from-[#0f1535] via-[#191f48] to-[#1f0f2f] text-white">
      <div className="min-h-[100dvh] h-[100dvh] px-3 sm:px-4 py-4 max-w-screen-2xl mx-auto flex flex-col">
        <div className="relative flex-1 min-h-0 h-full flex flex-col lg:flex-row gap-3 lg:gap-4">
          {/* Mobile / tablet overlay for sidebar */}
          <div
            className={`fixed inset-0 z-40 lg:hidden transition ${
              sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            } bg-black/50 backdrop-blur-sm`}
            onClick={onCloseSidebar}
          />

          {/* Sidebar as drawer on mobile/tablet, static on xl+ */}
          <aside
            className={`fixed inset-y-0 left-0 z-50 w-[86%] max-w-sm lg:static lg:z-auto lg:w-[280px] lg:md:w-80 transform transition duration-300 lg:transform-none lg:flex flex-col gap-3 ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            }`}
          >
            <div className="h-full lg:h-full rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl p-4 flex flex-col gap-4 shadow-xl shadow-purple-900/30 overflow-y-auto">
              {sidebar}
            </div>
          </aside>

          <main className="flex-1 min-w-0 flex flex-col gap-3 lg:pl-0 min-h-0">
            <div className="flex-1 min-h-0 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl shadow-purple-900/30 overflow-hidden">
              <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto]">
                {chatHeader}
                <div className="min-h-0 overflow-hidden">{messageList}</div>
                {composer}
              </div>
            </div>
          </main>

          <aside className="w-72 hidden 2xl:flex">{rightPanel ?? null}</aside>
        </div>
      </div>
    </div>
  );
}
