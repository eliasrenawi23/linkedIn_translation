"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import {
  MODEL_REVIEW_CONTEXT_KEY,
  type ModelComparisonResult,
  type ModelReviewContext,
} from "../lib/model-comparison";

type ModelOption = { id: string; name: string; available: boolean };

function debugPayload(value: unknown): string {
  try {
    return typeof value === "string" ? value : JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function ModelReviewPage() {
  const [context, setContext] = useState<ModelReviewContext | null>(null);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [comparison, setComparison] = useState<ModelComparisonResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [error, setError] = useState("");
  const [errorResponse, setErrorResponse] = useState("");

  useEffect(() => {
    const stored = window.sessionStorage.getItem(MODEL_REVIEW_CONTEXT_KEY);
    if (stored) {
      try {
        setContext(JSON.parse(stored) as ModelReviewContext);
      } catch {
        window.sessionStorage.removeItem(MODEL_REVIEW_CONTEXT_KEY);
      }
    }

    void fetch("/api/models")
      .then((response) => response.json())
      .then((data: ModelOption[]) => {
        setModels(data);
        setSelectedProviders(data.filter((model) => model.available).slice(0, 2).map((model) => model.id));
      })
      .catch((fetchError) => {
        console.error("Failed to load model providers:", fetchError);
        setError("Could not load the configured AI providers.");
      });
  }, []);

  const toggleProvider = (id: string) => {
    setSelectedProviders((current) => current.includes(id)
      ? current.filter((provider) => provider !== id)
      : current.length < 3 ? [...current, id] : current);
    setComparison(null);
    setError("");
    setErrorResponse("");
  };

  const runComparison = async () => {
    if (!context || selectedProviders.length < 2) return;
    setIsComparing(true);
    setComparison(null);
    setError("");
    setErrorResponse("");

    try {
      const response = await fetch("/api/compare-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume: context.resume,
          job_description: context.jobDescription,
          providers: selectedProviders,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorResponse(debugPayload(data.providerResponse ?? data));
        console.error("Full Multi-model AI error response:", data.providerResponse ?? data);
        throw new Error(data.error || "Could not compare the selected models");
      }
      setComparison(data as ModelComparisonResult);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Could not compare the selected models.");
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="app-container app-main">
        <header className="page-intro">
          <div>
            <p className="page-kicker">Independent AI perspectives</p>
            <h2 className="page-title mt-2">Multi-model Review</h2>
          </div>
          <p className="page-description max-w-3xl">Compare complete assessments side by side, understand where the models agree, and investigate why their conclusions differ.</p>
        </header>

        {!context ? (
          <section className="app-surface app-empty-state mx-auto flex max-w-2xl flex-col items-center p-10 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-2xl text-indigo-700">◈</div>
            <h3 className="text-lg font-bold text-slate-800">Start with a job analysis</h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">The review needs the resume and job description from a completed Job Match analysis.</p>
            <Link href="/job-checker" className="app-primary-button mt-6 px-5 text-sm">Go to Job Match</Link>
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
            <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
              <section className="app-surface overflow-hidden">
                <div className="app-section-header px-5 py-4"><h3 className="font-semibold text-slate-800">Review context</h3></div>
                <div className="space-y-4 p-5">
                  <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Role</p><p className="mt-1 font-semibold text-slate-800">{context.jobTitle}</p><p className="text-sm text-slate-500">{context.company}</p></div>
                  <div className="rounded-xl bg-blue-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-blue-600">Primary analysis</p><div className="mt-1 flex items-end justify-between gap-3"><strong className="text-3xl text-blue-700">{context.primaryScore}%</strong><span className="text-right text-xs font-semibold text-slate-600">{context.primaryRecommendation}</span></div></div>
                  <p className="text-xs text-slate-400">Prepared {new Date(context.preparedAt).toLocaleString()}</p>
                  <Link href="/job-checker" className="block text-sm font-semibold text-blue-700 hover:text-blue-900">← Back to Job Match</Link>
                </div>
              </section>

              <section className="app-surface overflow-hidden">
                <div className="app-section-header px-5 py-4"><h3 className="font-semibold text-slate-800">Choose providers</h3></div>
                <div className="space-y-3 p-5">
                  {models.map((model) => {
                    const selected = selectedProviders.includes(model.id);
                    return <button key={model.id} type="button" disabled={!model.available || (!selected && selectedProviders.length >= 3)} onClick={() => toggleProvider(model.id)} className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${selected ? "border-indigo-300 bg-indigo-50 text-indigo-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}><span>{model.name}</span><span>{selected ? "✓" : model.available ? "+" : "Unavailable"}</span></button>;
                  })}
                  <p className="text-xs leading-relaxed text-amber-700">Runs {selectedProviders.length} additional paid AI requests. Provider billing applies.</p>
                  <button type="button" onClick={() => void runComparison()} disabled={isComparing || selectedProviders.length < 2} className="app-primary-button w-full px-4 text-sm">{isComparing ? "Comparing models…" : comparison ? "Run comparison again" : "Compare selected models"}</button>
                  {models.filter((model) => model.available).length < 2 && <p className="text-xs text-rose-600">Configure at least two provider API keys.</p>}
                </div>
              </section>
            </aside>

            <section className="min-w-0 space-y-6">
              {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700"><p className="font-semibold">{error}</p>{errorResponse && <details className="mt-3 text-slate-700"><summary className="cursor-pointer font-semibold">Show full AI response (sensitive)</summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-white p-4 text-xs">{errorResponse}</pre></details>}</div>}

              {!comparison && !error && <div className="app-surface app-empty-state flex min-h-96 flex-col items-center justify-center p-10 text-center"><div className="mb-4 text-4xl">◈</div><h3 className="font-bold text-slate-800">Ready for a deeper review</h3><p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-500">Select two or three providers. Their complete reviews, consensus, differences, skills, and gaps will appear here.</p></div>}

              {comparison && <>
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                  <Metric label="Average score" value={`${comparison.consensus.averageScore}%`} tone="blue" />
                  <Metric label="Point spread" value={String(comparison.consensus.scoreSpread)} tone="violet" />
                  <Metric label="Consensus" value={comparison.consensus.consensusRecommendation} tone="slate" />
                  <Metric label="Recommendation" value={comparison.consensus.recommendationAgreement ? "Agreed" : "Disagreed"} tone={comparison.consensus.recommendationAgreement ? "green" : "amber"} />
                </div>

                <section className="app-surface overflow-hidden">
                  <div className="app-section-header px-5 py-4"><div><h3 className="font-semibold text-slate-800">Model-by-model findings</h3><p className="mt-1 text-xs text-slate-500">Independent evaluations of the same resume and role</p></div></div>
                  <div className="grid gap-5 p-5 xl:grid-cols-2">
                    {comparison.reviews.map((review) => <article key={review.provider} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><h4 className="font-bold text-slate-800">{comparison.providerNames[review.provider] || review.provider}</h4><p className="mt-1 text-xs text-slate-400">Completed in {(review.latencyMs / 1000).toFixed(1)}s</p></div><strong className="text-3xl text-blue-700">{review.score}%</strong></div><div className="mt-4 rounded-xl bg-slate-50 p-4"><p className="text-sm font-bold text-slate-700">{review.recommendation}</p><p className="mt-2 text-sm leading-relaxed text-slate-600">{review.summary}</p></div><FindingList title="Matching skills" items={review.matchingSkills} color="emerald" /><FindingList title="Missing skills" items={review.missingSkills} color="amber" /><FindingList title="Critical gaps" items={review.criticalGaps} color="rose" /></article>)}
                  </div>
                </section>

                <section className="app-surface overflow-hidden"><div className="app-section-header px-5 py-4"><h3 className="font-semibold text-slate-800">Shared findings</h3></div><div className="grid gap-5 p-5 md:grid-cols-2"><FindingList title="Matches confirmed by multiple models" items={comparison.consensus.sharedMatchingSkills} color="emerald" /><FindingList title="Missing skills confirmed by multiple models" items={comparison.consensus.sharedMissingSkills} color="rose" /></div></section>

                {comparison.failures.length > 0 && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><h3 className="font-bold text-amber-900">Partial failures</h3>{comparison.failures.map((failure) => <div key={failure.provider} className="mt-4 border-t border-amber-200 pt-4"><p className="text-sm text-amber-800"><strong>{comparison.providerNames[failure.provider] || failure.provider}:</strong> {failure.error}</p>{failure.providerResponse !== undefined && <details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-slate-700">Show full AI response (sensitive)</summary><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-white p-4 text-xs">{debugPayload(failure.providerResponse)}</pre></details>}</div>)}</section>}
              </>}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "blue" | "violet" | "slate" | "green" | "amber" }) {
  const tones = { blue: "bg-blue-50 text-blue-700", violet: "bg-violet-50 text-violet-700", slate: "bg-slate-100 text-slate-700", green: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700" };
  return <div className={`rounded-2xl p-5 ${tones[tone]}`}><p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p><strong className="mt-2 block text-xl leading-tight">{value}</strong></div>;
}

function FindingList({ title, items, color }: { title: string; items: string[]; color: "emerald" | "amber" | "rose" }) {
  const tones = { emerald: "bg-emerald-100 text-emerald-800", amber: "bg-amber-100 text-amber-800", rose: "bg-rose-100 text-rose-800" };
  return <div className="mt-5"><h5 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h5>{items.length ? <div className="mt-2 flex flex-wrap gap-2">{items.map((item) => <span key={item} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tones[color]}`}>{item}</span>)}</div> : <p className="mt-2 text-sm text-slate-400">None identified</p>}</div>;
}
