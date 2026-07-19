"use client";

import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { DEFAULT_RESUME } from "../job-checker/constants";
import type { CandidateEvaluation } from "../lib/ai/schemas";

type ModelOption = { id: string; name: string; available: boolean };
type EvaluationResponse = CandidateEvaluation & { source: string };

function debugPayload(value: unknown): string {
  try { return typeof value === "string" ? value : JSON.stringify(value, null, 2); } catch { return String(value); }
}

export default function CandidateScorePage() {
  const [resume, setResume] = useState(DEFAULT_RESUME);
  const [github, setGithub] = useState("");
  const [provider, setProvider] = useState("gemini");
  const [models, setModels] = useState<ModelOption[]>([]);
  const [result, setResult] = useState<EvaluationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [errorResponse, setErrorResponse] = useState("");

  useEffect(() => {
    void fetch("/api/models").then((response) => response.json()).then((data: ModelOption[]) => {
      setModels(data);
      const firstAvailable = data.find((model) => model.available);
      if (firstAvailable) setProvider(firstAvailable.id);
    }).catch((loadError) => console.error("Failed to load AI models:", loadError));
  }, []);

  const uploadResume = async (file: File | undefined) => {
    if (!file) return;
    setIsUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/parse-resume", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not read the resume");
      setResume(data.text);
      setResult(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not read the resume");
    } finally { setIsUploading(false); }
  };

  const evaluate = async () => {
    if (!resume.trim()) { setError("Provide resume text before evaluating."); return; }
    setIsLoading(true);
    setResult(null);
    setError("");
    setErrorResponse("");
    try {
      const response = await fetch("/api/candidate-evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, github, provider }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorResponse(debugPayload(data.providerResponse ?? data));
        console.error("Full Candidate Score AI error response:", data.providerResponse ?? data);
        throw new Error(data.error || "Could not evaluate the candidate portfolio");
      }
      setResult(data as EvaluationResponse);
    } catch (evaluationError) {
      setError(evaluationError instanceof Error ? evaluationError.message : "Could not evaluate the candidate portfolio");
    } finally { setIsLoading(false); }
  };

  const categories = result ? [
    ["Open Source", result.scores.openSource],
    ["Self Projects", result.scores.selfProjects],
    ["Production", result.scores.production],
    ["Technical Skills", result.scores.technicalSkills],
  ] as const : [];

  return <div className="min-h-screen">
    <Navbar />
    <main className="app-container app-main">
      <header className="page-intro">
        <div><p className="page-kicker">Explainable portfolio signals</p><h2 className="page-title">Candidate Score</h2></div>
        <p className="page-description">Evaluate technical evidence across open source, personal projects, production work, and skills using an adapted HackerRank Hiring Agent rubric.</p>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="app-surface overflow-hidden">
          <div className="app-section-header flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><h3 className="font-semibold text-slate-800">Candidate evidence</h3><p className="mt-1 text-xs text-slate-500">Resume content stays in this request and is not added to history.</p></div><label className="cursor-pointer rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"><input type="file" accept=".pdf,.docx,.txt,.md" className="sr-only" onChange={(event) => void uploadResume(event.target.files?.[0])} />{isUploading ? "Reading…" : "Upload resume"}</label></div>
          <div className="space-y-5 p-5">
            <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Resume text</span><textarea value={resume} onChange={(event) => { setResume(event.target.value); setResult(null); }} className="app-control min-h-80 w-full resize-y p-4 font-mono text-xs leading-relaxed" placeholder="Paste a resume or upload a file…" /></label>
            <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">GitHub profile <span className="font-normal normal-case text-slate-400">(optional)</span></span><input value={github} onChange={(event) => { setGithub(event.target.value); setResult(null); }} className="app-control w-full px-4 text-sm" placeholder="username or https://github.com/username" /><p className="mt-2 text-xs leading-relaxed text-slate-400">Only public profile and repository metadata is fetched. A token is optional and remains server-side.</p></label>
            <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">AI model</span><select value={provider} onChange={(event) => setProvider(event.target.value)} className="app-control w-full px-4 text-sm">{models.map((model) => <option key={model.id} value={model.id} disabled={!model.available}>{model.name}{model.available ? "" : " (Unavailable)"}</option>)}</select></label>
            <button type="button" onClick={() => void evaluate()} disabled={isLoading || !resume.trim()} className="app-primary-button w-full px-5 text-sm">{isLoading ? "Evaluating portfolio…" : "Evaluate candidate evidence"}</button>
            <p className="text-xs leading-relaxed text-slate-400">This score is a portfolio-development aid, not a hiring decision. It deliberately ignores school names, grades, location, demographics, and other irrelevant personal information.</p>
          </div>
        </section>

        <section className="min-w-0 space-y-5">
          {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700"><p className="font-semibold">{error}</p>{errorResponse && <details className="mt-3 text-slate-700"><summary className="cursor-pointer font-semibold">Show full AI response (sensitive)</summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-white p-4 text-xs">{errorResponse}</pre></details>}</div>}
          {!result && !error && <div className="app-surface app-empty-state flex min-h-[36rem] flex-col items-center justify-center p-10 text-center"><div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-3xl text-blue-700">⌁</div><h3 className="text-lg font-bold text-slate-800">Ready to score technical evidence</h3><p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">Add a GitHub profile for stronger open-source and project evidence, or evaluate the resume alone.</p></div>}
          {result && <>
            <section className="app-surface overflow-hidden"><div className="grid gap-5 p-6 sm:grid-cols-[10rem_1fr] sm:items-center"><div className="flex aspect-square items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-200"><div className="text-center"><strong className="block text-4xl">{result.overallScore}</strong><span className="text-xs font-bold uppercase tracking-widest text-blue-100">out of 120</span></div></div><div><p className="page-kicker">Overall portfolio signal</p><h3 className="text-2xl font-bold text-slate-900">Evidence-based technical profile</h3><p className="mt-2 text-sm leading-relaxed text-slate-500">{result.githubEnriched ? "Public GitHub evidence was included." : "Scored from resume evidence only."}</p><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800">+{result.bonusPoints.total} bonus</span><span className="rounded-full bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-800">−{result.deductions.total} deductions</span></div></div></div></section>
            <div className="grid gap-4 sm:grid-cols-2">{categories.map(([label, category]) => <article key={label} className="app-surface p-5"><div className="flex items-end justify-between gap-3"><h3 className="font-bold text-slate-800">{label}</h3><strong className="text-2xl text-blue-700">{category.score}<span className="text-sm text-slate-400">/{category.max}</span></strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" style={{ width: `${(category.score / category.max) * 100}%` }} /></div><p className="mt-4 text-sm leading-relaxed text-slate-600">{category.evidence}</p></article>)}</div>
            <section className="app-surface overflow-hidden"><div className="app-section-header px-5 py-4"><h3 className="font-semibold text-slate-800">What moves the score</h3></div><div className="grid gap-5 p-5 sm:grid-cols-2"><div><h4 className="text-xs font-bold uppercase tracking-wide text-emerald-700">Bonus evidence</h4><p className="mt-2 text-sm leading-relaxed text-slate-600">{result.bonusPoints.breakdown}</p></div><div><h4 className="text-xs font-bold uppercase tracking-wide text-rose-700">Deductions</h4><p className="mt-2 text-sm leading-relaxed text-slate-600">{result.deductions.reasons}</p></div></div></section>
            <section className="grid gap-4 sm:grid-cols-2"><InsightList title="Key strengths" items={result.keyStrengths} tone="green" /><InsightList title="Areas to improve" items={result.areasForImprovement} tone="amber" /></section>
            <p className="text-center text-xs text-slate-400">{result.source}. See THIRD_PARTY_NOTICES.md.</p>
          </>}
        </section>
      </div>
    </main>
  </div>;
}

function InsightList({ title, items, tone }: { title: string; items: string[]; tone: "green" | "amber" }) {
  return <article className="app-surface p-5"><h3 className={`font-bold ${tone === "green" ? "text-emerald-800" : "text-amber-800"}`}>{title}</h3><ul className="mt-4 space-y-3">{items.map((item) => <li key={item} className="flex gap-3 text-sm leading-relaxed text-slate-600"><span className={tone === "green" ? "text-emerald-500" : "text-amber-500"}>●</span><span>{item}</span></li>)}</ul></article>;
}
