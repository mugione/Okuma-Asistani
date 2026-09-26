import { lazy, Suspense } from "react";
import { Achievements } from "./pages/Achievements";
import { GamePage, GamesHub } from "./pages/Games";
import { Home } from "./pages/Home";
import { Library } from "./pages/Library";
import { MinuteTest } from "./pages/MinuteTest";
import { Neighborhood } from "./pages/Neighborhood";
import { Onboarding } from "./pages/Onboarding";
import { Placement } from "./pages/Placement";
import { ProfilePicker } from "./pages/ProfilePicker";
import { ReadPage } from "./pages/ReadPage";
import { Training } from "./pages/Training";
import { ErrorBox, Spinner } from "./components/ui";
import { AppStateProvider, useApp } from "./lib/app-state";
import { matchPath, RouterProvider, useRouter } from "./lib/router";

// Grafik kütüphanesi (Recharts) yalnızca ebeveyn panelinde yüklenir.
const ParentPanel = lazy(() => import("./pages/ParentPanel").then((m) => ({ default: m.ParentPanel })));

function Routes() {
  const { path } = useRouter();
  const { account, children, child, loading, error, refresh } = useApp();

  if (loading) return <Spinner />;
  if (error && !account) {
    return <div className="mx-auto max-w-md p-6"><ErrorBox message={error} onRetry={refresh} /></div>;
  }
  if (!account || !children.length) return <Onboarding />;
  if (path === "/yeni-okur") return <Onboarding addChildOnly />;
  if (path === "/ebeveyn") return <Suspense fallback={<Spinner />}><ParentPanel /></Suspense>;
  if (path === "/profiller" || !child) return <ProfilePicker />;

  let m: Record<string, string> | null;
  if (path === "/seviye-testi") return <Placement />;
  if (path === "/antrenman") return <Training />;
  if (path === "/kutuphane") return <Library />;
  if ((m = matchPath("/oku/:id", path))) return <ReadPage id={Number(m.id)} />;
  if (path === "/oyunlar") return <GamesHub />;
  if ((m = matchPath("/oyunlar/:slug", path))) return <GamePage slug={m.slug} />;
  if (path === "/rozetler") return <Achievements />;
  if (path === "/dakika-testi") return <MinuteTest />;
  if (path === "/mahalle") return <Neighborhood />;
  return <Home />;
}

export function App() {
  return (
    <RouterProvider>
      <AppStateProvider>
        <Routes />
      </AppStateProvider>
    </RouterProvider>
  );
}
