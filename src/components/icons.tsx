import {
  Award,
  BookOpen,
  Brain,
  CalendarCheck,
  Compass,
  Flame,
  Footprints,
  Gamepad2,
  Library,
  Lightbulb,
  Moon,
  Mountain,
  Repeat,
  Star,
  TrendingUp,
  Type,
  type LucideIcon,
} from "lucide-react";

/** D1'de saklanan rozet ikon adlarını Lucide bileşenlerine eşler (yalnızca kullanılanlar paketlenir). */
const ICONS: Record<string, LucideIcon> = {
  BookOpen, Brain, CalendarCheck, Compass, Flame, Footprints, Gamepad2, Library, Lightbulb, Moon, Mountain, Repeat, Star,
  TrendingUp, Type,
};

export function AchievementIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Award;
  return <Icon className={className} aria-hidden />;
}
