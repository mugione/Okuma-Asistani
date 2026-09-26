import { useState } from "react";
import { api } from "../api/client";
import { Layout } from "../components/Layout";
import { ReadingFlow } from "../components/reading/ReadingFlow";
import { Card, ErrorBox, PageTitle, Spinner } from "../components/ui";
import { useApp, useAsync } from "../lib/app-state";
import { useRouter } from "../lib/router";

export function Placement() {
  const { child } = useApp();
  const { navigate } = useRouter();
  const [retake] = useState(() => !!child?.placement_completed);
  const today = useAsync(() => api.today(child!.id), [child?.id]);
  const textId = today.data?.placementTextId;
  const text = useAsync(() => (textId ? api.text(textId) : Promise.resolve(null)), [textId]);

  return (
    <Layout back="/">
      <PageTitle sub="Kendi hızında, dikkatlice oku. Sonra birkaç soru cevaplayacaksın.">Seviye Testi</PageTitle>
      {(today.error || text.error) && <ErrorBox message={today.error ?? text.error!} />}
      {(today.loading || text.loading) && <Spinner />}
      {retake ? (
        <Card className="mb-4 !bg-sun-100 font-bold">Seviye testini daha önce yaptın. İstersen tekrar yapabilirsin; hedefin yeni sonuca göre ayarlanır.</Card>
      ) : null}
      {text.data && (
        <ReadingFlow text={text.data} mode="placement" plan="placement" completeLabel="Ana Sayfaya Git" onComplete={() => navigate("/")} />
      )}
    </Layout>
  );
}
