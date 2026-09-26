import { Plus } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { useApp } from "../lib/app-state";
import { Link, useRouter } from "../lib/router";

export function ProfilePicker() {
  const { children, selectChild } = useApp();
  const { navigate } = useRouter();
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center px-4 py-10">
      <h1 className="text-4xl font-black">Kim okuyor?</h1>
      <div className="mt-8 grid w-full grid-cols-2 gap-4 sm:grid-cols-3">
        {children.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              selectChild(c.id);
              navigate("/");
            }}
            className="flex flex-col items-center gap-2 rounded-3xl bg-white p-5 shadow-[0_6px_24px_rgba(15,81,75,0.08)] transition hover:-translate-y-1"
          >
            <Avatar id={c.avatar} size={96} />
            <span className="text-xl font-black">{c.name}</span>
          </button>
        ))}
        <Link to="/yeni-okur" className="flex flex-col items-center justify-center gap-2 rounded-3xl border-3 border-dashed border-brand-200 p-5 text-brand-600 hover:bg-brand-50">
          <Plus className="size-12" />
          <span className="font-black">Yeni okur</span>
        </Link>
      </div>
    </div>
  );
}
