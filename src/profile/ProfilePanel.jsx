import React, { useMemo, useState } from "react";

const initials = (name) => {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
};

const CameraIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
    <path
      d="M6.75 5.5 8 4h4l1.25 1.5H15A1.75 1.75 0 0 1 16.75 7.25v6A1.75 1.75 0 0 1 15 15H5A1.75 1.75 0 0 1 3.25 13.25v-6A1.75 1.75 0 0 1 5 5.5h1.75ZM10 13a2.75 2.75 0 1 0 0-5.5A2.75 2.75 0 0 0 10 13Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Avatar = ({ photo, name }) => {
  if (photo) {
    return (
      <img
        src={photo}
        alt="Profile"
        className="h-16 w-16 rounded-[1.35rem] border border-white/10 object-cover shadow-lg shadow-cyan-950/20"
      />
    );
  }

  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-white/10 bg-gradient-to-br from-cyan-300 via-sky-400 to-indigo-500 text-lg font-semibold text-slate-950 shadow-lg shadow-cyan-950/20">
      {initials(name)}
    </div>
  );
};

export default function ProfilePanel({ profile, onSave, onClose }) {
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [photo, setPhoto] = useState(profile?.photo ?? "");
  const [error, setError] = useState("");

  const canSave = useMemo(() => {
    const nameOk = String(displayName ?? "").trim().length >= 2;
    return nameOk;
  }, [displayName]);

  const onPickPhoto = async (file) => {
    setError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setError("Image too large. Please use an image under 1MB.");
      return;
    }

    const reader = new FileReader();
    const result = await new Promise((resolve, reject) => {
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });

    if (typeof result === "string") setPhoto(result);
  };

  const save = () => {
    setError("");
    const name = String(displayName ?? "").trim();
    if (name.length < 2) {
      setError("Please enter a valid name.");
      return;
    }

    onSave?.({
      ...profile,
      displayName: name,
      photo,
    });
    onClose?.();
  };

  return (
    <div className="premium-panel mesh-accent rounded-[2rem] p-5 shadow-[0_32px_90px_rgba(2,8,23,0.48)]">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar photo={photo} name={displayName} />
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">
              Profile settings
            </div>
            <div className="font-display mt-2 text-xl font-semibold text-white">
              My profile
            </div>
            <div className="mt-1 text-sm text-slate-300/82">
              Save your name and photo without affecting chat functionality.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg text-slate-200 transition hover:bg-white/10"
        >
          ×
        </button>
      </div>

      <div className="space-y-4">
        <label className="block">
          <div className="mb-2 text-sm font-medium text-slate-200">
            Display name
          </div>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-[1.2rem] border border-white/10 bg-black/18 px-4 py-3 text-white placeholder:text-slate-400/90 outline-none transition focus:border-cyan-300/30 focus:ring-2 focus:ring-cyan-300/20"
            placeholder="Enter your name"
          />
        </label>

        <label className="block">
          <div className="mb-2 text-sm font-medium text-slate-200">
            Profile photo
          </div>
          <div className="rounded-[1.2rem] border border-white/10 bg-black/18 px-4 py-4">
            <div className="mb-3 inline-flex items-center gap-2 text-sm text-slate-300/82">
              <CameraIcon />
              Upload a clean profile image under 1MB.
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onPickPhoto(e.target.files?.[0])}
              className="block w-full text-sm text-slate-300/82 file:mr-4 file:rounded-xl file:border file:border-white/10 file:bg-white/8 file:px-4 file:py-2.5 file:text-white hover:file:bg-white/12"
            />
          </div>
        </label>

        {error && (
          <div className="rounded-[1.1rem] border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="w-full rounded-[1.2rem] bg-[linear-gradient(135deg,#14b8a6_0%,#0ea5e9_42%,#2563eb_100%)] py-3.5 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(14,165,233,0.25)] transition hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save profile
        </button>
      </div>
    </div>
  );
}
