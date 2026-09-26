/** Hazır SVG hayvan avatarları. D1'de yalnızca "avatar-1" … "avatar-8" saklanır. */

export const AVATARS = [
  { id: "avatar-1", name: "Baykuş" },
  { id: "avatar-2", name: "Kedi" },
  { id: "avatar-3", name: "Tilki" },
  { id: "avatar-4", name: "Ayı" },
  { id: "avatar-5", name: "Tavşan" },
  { id: "avatar-6", name: "Panda" },
  { id: "avatar-7", name: "Aslan" },
  { id: "avatar-8", name: "Kurbağa" },
] as const;

const Eyes = ({ y = 48, dx = 13, r = 5, color = "#1f2a37" }: { y?: number; dx?: number; r?: number; color?: string }) => (
  <g>
    <circle cx={50 - dx} cy={y} r={r} fill={color} />
    <circle cx={50 + dx} cy={y} r={r} fill={color} />
    <circle cx={50 - dx + 1.6} cy={y - 1.8} r={r / 2.6} fill="#fff" />
    <circle cx={50 + dx + 1.6} cy={y - 1.8} r={r / 2.6} fill="#fff" />
  </g>
);

const Cheeks = ({ y = 60, dx = 22 }: { y?: number; dx?: number }) => (
  <g fill="#ff9a7d" opacity={0.45}>
    <ellipse cx={50 - dx} cy={y} rx={6} ry={4} />
    <ellipse cx={50 + dx} cy={y} rx={6} ry={4} />
  </g>
);

const Smile = ({ y = 64 }: { y?: number }) => (
  <path d={`M${43} ${y} q7 6 14 0`} stroke="#1f2a37" strokeWidth={2.6} fill="none" strokeLinecap="round" />
);

function Face({ id }: { id: string }) {
  switch (id) {
    case "avatar-1": // Baykuş
      return (
        <g>
          <path d="M22 30 L30 14 L38 28 Z M78 30 L70 14 L62 28 Z" fill="#8a5a3b" />
          <ellipse cx={50} cy={55} rx={32} ry={34} fill="#a86f4c" />
          <ellipse cx={50} cy={66} rx={20} ry={18} fill="#f3d9b1" />
          <circle cx={37} cy={46} r={12} fill="#fff" />
          <circle cx={63} cy={46} r={12} fill="#fff" />
          <Eyes y={46} dx={13} r={6} />
          <path d="M45 56 L55 56 L50 64 Z" fill="#f5b82e" />
        </g>
      );
    case "avatar-2": // Kedi
      return (
        <g>
          <path d="M20 40 L24 12 L44 28 Z M80 40 L76 12 L56 28 Z" fill="#f59e4a" />
          <path d="M25 34 L27 19 L38 28 Z M75 34 L73 19 L62 28 Z" fill="#ffd1b3" />
          <circle cx={50} cy={54} r={32} fill="#f7a855" />
          <Eyes y={50} dx={13} />
          <path d="M47 58 h6 l-3 3 z" fill="#ff7a59" />
          <path d="M50 61 q-4 5 -8 2 M50 61 q4 5 8 2" stroke="#1f2a37" strokeWidth={2.2} fill="none" strokeLinecap="round" />
          <g stroke="#1f2a37" strokeWidth={1.4} strokeLinecap="round" opacity={0.6}>
            <path d="M30 58 h-12 M30 62 l-11 3 M70 58 h12 M70 62 l11 3" />
          </g>
          <Cheeks y={60} dx={20} />
        </g>
      );
    case "avatar-3": // Tilki
      return (
        <g>
          <path d="M18 42 L22 10 L46 30 Z M82 42 L78 10 L54 30 Z" fill="#e8663d" />
          <path d="M24 34 L26 18 L38 29 Z M76 34 L74 18 L62 29 Z" fill="#3b2a24" />
          <path d="M50 88 C25 88 16 64 18 48 C22 30 36 24 50 24 C64 24 78 30 82 48 C84 64 75 88 50 88 Z" fill="#f07a4a" />
          <path d="M50 88 C36 88 24 76 22 62 C32 60 42 64 50 72 C58 64 68 60 78 62 C76 76 64 88 50 88 Z" fill="#fff4e8" />
          <Eyes y={50} dx={14} />
          <ellipse cx={50} cy={70} rx={5} ry={3.6} fill="#1f2a37" />
        </g>
      );
    case "avatar-4": // Ayı
      return (
        <g>
          <circle cx={24} cy={26} r={12} fill="#8a5a3b" />
          <circle cx={76} cy={26} r={12} fill="#8a5a3b" />
          <circle cx={24} cy={26} r={6} fill="#d9a77e" />
          <circle cx={76} cy={26} r={6} fill="#d9a77e" />
          <circle cx={50} cy={54} r={34} fill="#9c6b48" />
          <ellipse cx={50} cy={66} rx={15} ry={12} fill="#e7c49f" />
          <Eyes y={48} dx={14} />
          <ellipse cx={50} cy={61} rx={6} ry={4.4} fill="#1f2a37" />
          <Smile y={68} />
        </g>
      );
    case "avatar-5": // Tavşan
      return (
        <g>
          <ellipse cx={36} cy={22} rx={9} ry={22} fill="#e9e4ef" />
          <ellipse cx={64} cy={22} rx={9} ry={22} fill="#e9e4ef" />
          <ellipse cx={36} cy={22} rx={4.5} ry={16} fill="#ffc2cf" />
          <ellipse cx={64} cy={22} rx={4.5} ry={16} fill="#ffc2cf" />
          <circle cx={50} cy={58} r={30} fill="#f4f0f8" />
          <Eyes y={54} dx={12} />
          <path d="M46 63 h8 l-4 4 z" fill="#ff8fa8" />
          <path d="M47 71 h6 v5 h-6 z" fill="#fff" stroke="#d6cfe0" strokeWidth={1} />
          <Cheeks y={66} dx={19} />
        </g>
      );
    case "avatar-6": // Panda
      return (
        <g>
          <circle cx={25} cy={26} r={12} fill="#2b2f36" />
          <circle cx={75} cy={26} r={12} fill="#2b2f36" />
          <circle cx={50} cy={54} r={33} fill="#fff" stroke="#e3e6ea" strokeWidth={1.5} />
          <ellipse cx={36} cy={50} rx={9} ry={11} fill="#2b2f36" transform="rotate(-20 36 50)" />
          <ellipse cx={64} cy={50} rx={9} ry={11} fill="#2b2f36" transform="rotate(20 64 50)" />
          <Eyes y={49} dx={13} r={4} color="#fff" />
          <circle cx={37} cy={49} r={2.2} fill="#2b2f36" />
          <circle cx={63} cy={49} r={2.2} fill="#2b2f36" />
          <ellipse cx={50} cy={62} rx={5} ry={3.6} fill="#2b2f36" />
          <Smile y={67} />
          <Cheeks y={64} dx={22} />
        </g>
      );
    case "avatar-7": // Aslan
      return (
        <g>
          <g fill="#c86b1f">
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2;
              return <circle key={i} cx={50 + Math.cos(a) * 34} cy={54 + Math.sin(a) * 34} r={12} />;
            })}
          </g>
          <circle cx={50} cy={54} r={34} fill="#d8812d" />
          <circle cx={50} cy={54} r={27} fill="#ffc861" />
          <Eyes y={50} dx={11} />
          <ellipse cx={50} cy={62} rx={11} ry={8} fill="#fff1cc" />
          <path d="M46 58 h8 l-4 4 z" fill="#8a4b1a" />
          <Smile y={65} />
        </g>
      );
    default: // Kurbağa
      return (
        <g>
          <circle cx={32} cy={30} r={14} fill="#5cc26b" />
          <circle cx={68} cy={30} r={14} fill="#5cc26b" />
          <ellipse cx={50} cy={60} rx={36} ry={28} fill="#6fd17d" />
          <circle cx={32} cy={30} r={9} fill="#fff" />
          <circle cx={68} cy={30} r={9} fill="#fff" />
          <Eyes y={30} dx={18} r={5} />
          <path d="M30 64 q20 16 40 0" stroke="#1f2a37" strokeWidth={3} fill="none" strokeLinecap="round" />
          <Cheeks y={60} dx={26} />
        </g>
      );
  }
}

export function Avatar({ id, size = 56, className = "" }: { id: string; size?: number; className?: string }) {
  const name = AVATARS.find((a) => a.id === id)?.name ?? "Avatar";
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} role="img" aria-label={name}>
      <circle cx={50} cy={50} r={50} fill="#fff4d1" />
      <Face id={id} />
    </svg>
  );
}

export function AvatarPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="grid grid-cols-4 gap-3" role="radiogroup" aria-label="Avatar seç">
      {AVATARS.map((a) => (
        <button
          key={a.id}
          type="button"
          role="radio"
          aria-checked={value === a.id}
          onClick={() => onChange(a.id)}
          className={`flex flex-col items-center gap-1 rounded-2xl border-3 p-2 transition ${
            value === a.id ? "border-brand-500 bg-brand-50 scale-105" : "border-transparent bg-white hover:bg-brand-50"
          }`}
        >
          <Avatar id={a.id} size={60} />
          <span className="text-xs font-bold text-ink/70">{a.name}</span>
        </button>
      ))}
    </div>
  );
}
