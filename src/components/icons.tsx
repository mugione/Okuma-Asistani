import {
  AudioLines,
  Award,
  BookOpen,
  Brain,
  CalendarCheck,
  CalendarClock,
  Compass,
  Flame,
  Footprints,
  Gamepad2,
  Gauge,
  Headphones,
  Library,
  Lightbulb,
  Moon,
  Mountain,
  Repeat,
  Rocket,
  Star,
  Timer,
  TrendingUp,
  Trophy,
  Type,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** D1'de saklanan rozet ikon adlarını Lucide bileşenlerine eşler (yalnızca kullanılanlar paketlenir). */
const ICONS: Record<string, LucideIcon> = {
  AudioLines, BookOpen, Brain, CalendarCheck, CalendarClock, Headphones, Compass, Flame, Footprints, Gamepad2, Gauge, Library, Lightbulb, Moon,
  Mountain, Repeat, Rocket, Star, Timer, TrendingUp, Trophy, Type, Zap,
};

export function AchievementIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Award;
  return <Icon className={className} aria-hidden />;
}
