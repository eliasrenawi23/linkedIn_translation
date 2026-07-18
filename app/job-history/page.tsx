"use client";

import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { createHistoryExport, loadJobHistory, parseHistoryImport, type JobHistoryEntry, writeJobHistory } from "../lib/job-history";

export default function JobHistoryPage() {
  const [entries, setEntries] = useState<JobHistoryEntry[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setEntries(loadJobHistory(window.localStorage)), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const persist = (next: JobHistoryEntry[]) => setEntries(writeJobHistory(window.localStorage, next));
  const toggleFavorite = (id: string) => persist(entries.map((entry) => entry.id === id ? { ...entry, favorite: !entry.favorite } : entry));
  const remove = (id: string) => {
    persist(entries.filter((entry) => entry.id !== id));
    setSelected((current) => current.filter((item) => item !== id));
  };
  const toggleComparison = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current);
  const compared = selected.map((id) => entries.find((entry) => entry.id === id)).filter((entry): entry is JobHistoryEntry => Boolean(entry));

  const exportHistory = () => {
    const blob = new Blob([JSON.stringify(createHistoryExport(entries), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `job-analysis-history-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importHistory = async (file: File | undefined) => {
    if (!file) return;
    try {
      const imported = parseHistoryImport(JSON.parse(await file.text()));
      const merged = [...imported, ...entries.filter((entry) => !imported.some((item) => item.id === entry.id))];
      persist(merged);
      setMessage(`Imported ${imported.length} history entries.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not import this history file.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h2 className="text-2xl font-extrabold">Job Analysis History</h2>
            <p className="text-sm text-slate-500 mt-1">Stored only in this browser. Resume and job-description bodies are not saved.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={exportHistory} disabled={!entries.length} className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 disabled:opacity-50">Export JSON</button>
            <label className="relative px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold cursor-pointer">
              Import JSON
              <input type="file" accept="application/json,.json" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(event) => void importHistory(event.target.files?.[0])} />
            </label>
          </div>
        </div>

        {message && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">{message}</div>}

        {compared.length >= 2 && (
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100"><h3 className="font-bold">Comparison</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-sm">
                <thead><tr className="bg-slate-50"><th className="text-left p-3 text-slate-500">Metric</th>{compared.map((entry) => <th key={entry.id} className="text-left p-3">{entry.title}<span className="block text-xs font-normal text-slate-500">{entry.company}</span></th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="p-3 font-semibold">Score</td>{compared.map((entry) => <td key={entry.id} className="p-3 text-lg font-bold text-blue-600">{entry.score}%</td>)}</tr>
                  <tr><td className="p-3 font-semibold">Recommendation</td>{compared.map((entry) => <td key={entry.id} className="p-3">{entry.recommendation}</td>)}</tr>
                  <tr><td className="p-3 font-semibold">Matching skills</td>{compared.map((entry) => <td key={entry.id} className="p-3">{entry.matchingSkills.length}</td>)}</tr>
                  <tr><td className="p-3 font-semibold">Missing skills</td>{compared.map((entry) => <td key={entry.id} className="p-3">{entry.missingSkills.length}</td>)}</tr>
                  <tr><td className="p-3 font-semibold">Critical gaps</td>{compared.map((entry) => <td key={entry.id} className="p-3 text-rose-700">{entry.criticalGaps.length}</td>)}</tr>
                  <tr><td className="p-3 font-semibold">Resume</td>{compared.map((entry) => <td key={entry.id} className="p-3 text-slate-500">{entry.resumeVersion}</td>)}</tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {entries.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {entries.map((entry) => (
              <article key={entry.id} className={`bg-white rounded-xl border p-5 shadow-sm ${selected.includes(entry.id) ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="font-bold text-slate-800">{entry.title}</h3><p className="text-xs text-slate-500 mt-0.5">{entry.company}</p></div>
                  <button type="button" onClick={() => toggleFavorite(entry.id)} className={`text-xl ${entry.favorite ? "text-amber-400" : "text-slate-300"}`} aria-label={entry.favorite ? "Remove favorite" : "Add favorite"}>★</button>
                </div>
                <div className="flex items-center justify-between mt-4"><span className="text-3xl font-extrabold text-blue-600">{entry.score}%</span><span className="text-xs font-semibold text-slate-600 text-right">{entry.recommendation}</span></div>
                <div className="grid grid-cols-3 gap-2 mt-4 text-center"><div className="rounded bg-emerald-50 p-2"><strong className="block text-emerald-700">{entry.matchingSkills.length}</strong><span className="text-[10px] text-slate-500">matches</span></div><div className="rounded bg-rose-50 p-2"><strong className="block text-rose-700">{entry.missingSkills.length}</strong><span className="text-[10px] text-slate-500">missing</span></div><div className="rounded bg-amber-50 p-2"><strong className="block text-amber-700">{entry.criticalGaps.length}</strong><span className="text-[10px] text-slate-500">critical</span></div></div>
                <p className="text-[11px] text-slate-400 mt-4">{new Date(entry.createdAt).toLocaleString()} · {entry.resumeVersion}</p>
                <div className="flex gap-2 mt-4">
                  <button type="button" onClick={() => toggleComparison(entry.id)} disabled={!selected.includes(entry.id) && selected.length >= 3} className="flex-1 px-3 py-2 rounded-lg border border-blue-200 text-xs font-semibold text-blue-700 disabled:opacity-40">{selected.includes(entry.id) ? "Remove comparison" : "Compare"}</button>
                  <button type="button" onClick={() => remove(entry.id)} className="px-3 py-2 rounded-lg border border-rose-100 text-xs font-semibold text-rose-600">Delete</button>
                </div>
              </article>
            ))}
          </div>
        ) : <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500"><h3 className="font-semibold text-slate-700">No saved analyses yet</h3><p className="text-sm mt-1">Complete a job analysis and it will appear here automatically.</p></div>}
      </main>
    </div>
  );
}
