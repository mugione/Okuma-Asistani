import { Play } from "lucide-react";
import { useState } from "react";
import type { ReadingModeName } from "../../shared/api-types";
import { api } from "../api/client";
import { Layout } from "../components/Layout";
import { ModePicker } from "../components/reading/ModePicker";
import { ReadingFlow } from "../components/reading/ReadingFlow";
import { Button, Card, ErrorBox, PageTitle, Spinner } from "../components/ui";
import { useAsync } from "../lib/app-state";
import { useRouter } from "../lib/router";
import { Difficulty } from "./Library";

export function ReadPage({ id }: { id: number }) {
  const { navigate } = useRouter();
  const { data: text, error, loading } = useAsync(() => api.text(id), [id]);
  const [mode, setMode] = useState<Exclude<ReadingModeName, "placement">>("normal");
  const [started, setStarted] = useState(false);

  return (
    <Layout back="/kutuphane">
      {loading && <Spinner />}
      {error && <ErrorBox message={error} />}
      {text && (
        <>
          <PageTitle sub={<span className="flex items-center gap-3">{text.category} · {text.word_count} kelime <Difficulty level={text.difficulty} /></span>}>
            {text.title}
          </PageTitle>
          {!started ? (
            <Card className="animate-fade-up">
              <h2 className="mb-3 text-xl font-black">Nasıl okumak istersin?</h2>
              <ModePicker value={mode} onChange={setMode} />
              <Button size="lg" className="mt-5 w-full" onClick={() => setStarted(true)}>
                <Play className="size-6 fill-white" /> Hazırım
              </Button>
            </Card>
          ) : (
            <ReadingFlow text={text} mode={mode} plan="standard" completeLabel="Kütüphaneye Dön" onComplete={() => navigate("/kutuphane")} />
          )}
        </>
      )}
    </Layout>
  );
}
