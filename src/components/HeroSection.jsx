import React from "react";
import { Activity, Crown, Globe2, Sparkles } from "lucide-react";
import ChatBubble from "./auth/ui/ChatBubble";
import TypingIndicator from "./auth/ui/TypingIndicator";

const heroImages = [
  {
    src: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
    alt: "Team collaboration workspace",
  },
  {
    src: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80",
    alt: "Team members discussing together",
  },
  {
    src: "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=900&q=80",
    alt: "Modern professional workspace",
  },
];

const metrics = [
  { label: "Sync speed", value: "<120ms", icon: Activity },
  { label: "Global reach", value: "24/7", icon: Globe2 },
  { label: "Experience", value: "Luxury", icon: Crown },
];

const HeroSection = () => {
  return (
    <section className="relative hidden min-h-full overflow-hidden lg:flex">
      <div className="absolute inset-0 bg-[linear-gradient(150deg,rgba(8,15,28,0.56),rgba(8,15,28,0.18)),radial-gradient(circle_at_top_left,rgba(94,234,212,0.16),transparent_24%),radial-gradient(circle_at_80%_20%,rgba(96,165,250,0.16),transparent_22%)]" />

      <div className="relative flex flex-1 flex-col justify-between p-8 xl:p-10">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-cyan-100/72">
            <Sparkles className="h-3.5 w-3.5" />
            Premium visual workspace
          </div>

          <div className="mt-5 grid grid-cols-[1.25fr_0.95fr] gap-4">
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-black/20 shadow-[0_28px_80px_rgba(2,8,23,0.34)]">
              <img
                src={heroImages[0].src}
                alt={heroImages[0].alt}
                className="h-[24rem] w-full object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(4,9,20,0.72))]" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/68">
                  Executive collaboration
                </div>
                <div className="font-display mt-2 text-2xl font-semibold text-white">
                  Built for premium chat experiences that feel modern and calm.
                </div>
              </div>
            </div>

            <div className="grid grid-rows-2 gap-4">
              {heroImages.slice(1).map((image) => (
                <div
                  key={image.src}
                  className="overflow-hidden rounded-[1.7rem] border border-white/10 bg-black/20 shadow-[0_20px_50px_rgba(2,8,23,0.26)]"
                >
                  <img
                    src={image.src}
                    alt={image.alt}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <div key={metric.label} className="premium-card rounded-[1.4rem] p-4">
                  <Icon className="h-5 w-5 text-cyan-200" />
                  <div className="mt-3 font-display text-xl font-semibold text-white">
                    {metric.value}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-300/74">
                    {metric.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-[1.05fr_0.95fr] gap-4">
          <div className="premium-card rounded-[1.8rem] p-5">
            <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/68">
              Live preview
            </div>
            <div className="mt-4 space-y-3">
              <ChatBubble text="Design is looking sharp. Launch the premium version." delay={350} />
              <ChatBubble
                text="The new interface feels much more polished and high-end."
                isUser
                delay={900}
              />
              <TypingIndicator delay={1500} />
              <ChatBubble text="Perfect. Keep functionality exactly the same." delay={2200} />
            </div>
          </div>

          <div className="premium-card rounded-[1.8rem] p-5">
            <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/68">
              Why this page works
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <div className="text-sm font-semibold text-white">
                  Split-screen luxury layout
                </div>
                <div className="mt-1 text-sm leading-6 text-slate-300/78">
                  A branded form side with a premium visual gallery side makes the
                  login screen feel like a polished product, not a default auth box.
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold text-white">
                  Visual trust and product context
                </div>
                <div className="mt-1 text-sm leading-6 text-slate-300/78">
                  Workspace imagery, chat preview cards, and performance cues make
                  the app feel established before the user even logs in.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
