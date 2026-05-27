"use client";

import { useState, useEffect } from "react";
import Navbar from "./components/Navbar";

export default function Translator() {
  const [inputText, setInputText] = useState("");
  const [translation, setTranslation] = useState("");
  const [headline, setHeadline] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [provider, setProvider] = useState("gemini");
  const [availableModels, setAvailableModels] = useState<{id: string, name: string, available: boolean}[]>([]);
  const [modelLink, setModelLink] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch(`/api/models`);
        const data = await response.json();
        setAvailableModels(data);
      } catch (err) {
        console.error("Failed to fetch models:", err);
      }
    };
    fetchModels();
  }, []);

  // Update model link from localStorage or provider defaults
  useEffect(() => {
    const customLink = localStorage.getItem("linkedin_translator_model_link");
    if (customLink) {
      setModelLink(customLink);
    } else {
      if (provider === "gemini") {
        setModelLink("https://deepmind.google/technologies/gemini/");
      } else if (provider === "openai") {
        setModelLink("https://openai.com/");
      } else if (provider === "anthropic") {
        setModelLink("https://www.anthropic.com/");
      }
    }
  }, [provider, isModalOpen]);

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    
    setIsLoading(true);
    setError("");
    setTranslation("");
    setHeadline("");
    setScore(null);
    
    try {
      const response = await fetch(`/api/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ post_text: inputText, provider: provider }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to translate");
      }
      
      setHeadline(data.headline);
      setTranslation(data.translation);
      setScore(data.score);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score <= 30) return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (score <= 70) return "bg-amber-50 text-amber-700 border-amber-100";
    return "bg-rose-50 text-rose-700 border-rose-100";
  };

  return (
    <div className="min-h-screen bg-slate-50 text-gray-800 font-sans flex flex-col relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
      <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-indigo-400/10 rounded-full blur-3xl pointer-events-none -z-10"></div>

      <Navbar />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
        
        {/* Page Header */}
        <div className="text-center lg:text-left mb-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center justify-center lg:justify-start gap-2.5">
            <span>🤖</span> Corporate Bullshit Translator
          </h2>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            Translate corporate jargon, synergistic speeches, and exaggerated LinkedIn posts into their honest, brutal truths.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch min-h-[500px]">
          
          {/* Left Panel - Input */}
          <div className="flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-md shadow-slate-100/50 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all duration-300">
            <div className="border-b border-slate-100 px-5 py-4 bg-slate-50/50 flex justify-between items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Corporate LinkedIn</h2>
              </div>
              <div className="flex items-center gap-2">
                <select 
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg text-slate-600 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 py-1.5 px-3 bg-white hover:bg-slate-50 transition-colors cursor-pointer font-medium"
                >
                  {availableModels.length > 0 ? (
                    availableModels.map((model) => (
                      <option key={model.id} value={model.id} disabled={!model.available}>
                        {model.name} {!model.available && "(Unavailable)"}
                      </option>
                    ))
                  ) : (
                    <option value="gemini">Google (Gemini 3.5 Flash)</option>
                  )}
                </select>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-sm"
                  title="Model Settings"
                >
                  ℹ️
                </button>
              </div>
            </div>
            <div className="flex-1 relative min-h-[250px] lg:min-h-auto">
              <textarea
                className="w-full h-full p-5 resize-none outline-none text-lg leading-relaxed text-slate-800 placeholder-slate-400 bg-transparent min-h-[250px]"
                placeholder="Paste your synergistic paradigm shift here..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
            </div>
            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/20 flex justify-end gap-2 shrink-0">
              {(inputText.trim() || translation) && (
                <button
                  onClick={() => {
                    setInputText("");
                    setTranslation("");
                    setHeadline("");
                    setScore(null);
                    setError("");
                  }}
                  className="px-5 py-2.5 rounded-lg font-semibold text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
              <button
                onClick={handleTranslate}
                disabled={isLoading || !inputText.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm shadow-blue-100 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Translating...
                  </>
                ) : (
                  <>
                    <span>⚡</span> Translate
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Panel - Output */}
          <div className="flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-md shadow-slate-100/50 overflow-hidden relative">
            <div className="border-b border-slate-100 px-5 py-4 bg-slate-50/50 flex justify-between items-center shrink-0">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Brutal Truth</h2>
              {score !== null && (
                <div className={`px-3 py-1 rounded-full text-xs font-bold border ${getScoreColor(score)}`}>
                  Bullshit: {score}/100
                </div>
              )}
            </div>

            {/* Score gauge dashboard header */}
            {score !== null && !isLoading && (
              <div className="flex flex-col sm:flex-row items-center gap-6 p-5 bg-slate-50/50 border-b border-slate-100 shrink-0">
                {/* Radial Gauge */}
                <div className="relative flex items-center justify-center shrink-0">
                  <svg className="w-20 h-20 transform -rotate-90">
                    <circle cx="40" cy="40" r="34" className="stroke-slate-200 fill-transparent" strokeWidth="5" />
                    <circle
                      cx="40"
                      cy="40"
                      r="34"
                      className={`fill-transparent transition-all duration-1000 ease-out ${
                        score <= 30 ? "stroke-emerald-500" : score <= 70 ? "stroke-amber-500" : "stroke-rose-500"
                      }`}
                      strokeWidth="5"
                      strokeDasharray="213.6"
                      strokeDashoffset={213.6 - (213.6 * score) / 100}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className={`absolute text-lg font-extrabold ${
                    score <= 30 ? "text-emerald-600" : score <= 70 ? "text-amber-600" : "text-rose-600"
                  }`}>
                    {score}%
                  </span>
                </div>
                <div className="text-center sm:text-left">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Bullshit Rating</span>
                  <h4 className={`text-base font-extrabold mt-0.5 ${
                    score <= 30 ? "text-emerald-700" : score <= 70 ? "text-amber-700" : "text-rose-700"
                  }`}>
                    {score <= 30 ? "🟢 Pure Truth" : score <= 70 ? "🟡 Corporate Fluff" : "🔴 Extreme Bullshit! 🔥"}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed font-light">
                    {score <= 30 ? "Surprisingly clean and honest. This post contains little to no corporate buzzwords." : 
                     score <= 70 ? "Contains a moderate amount of fluff. Read with caution and double-check claims." : 
                     "Severe exaggeration. Proceed with immediate cynicism; 99% buzzwords and zero substance."}
                  </p>
                </div>
              </div>
            )}
            
            <div className="flex-1 p-6 overflow-y-auto max-h-[450px]">
              {isLoading ? (
                <div className="animate-pulse flex flex-col gap-5 pt-2">
                  <div className="h-14 bg-slate-100 rounded-xl w-full"></div>
                  <div className="flex flex-col gap-3">
                    <div className="h-4 bg-slate-100 rounded w-full"></div>
                    <div className="h-4 bg-slate-100 rounded w-5/6"></div>
                    <div className="h-4 bg-slate-100 rounded w-full"></div>
                  </div>
                </div>
              ) : error ? (
                <div className="text-rose-500 p-4 border border-rose-200 bg-rose-50 rounded-xl flex items-start gap-3">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <p className="font-semibold text-sm">Translation Error</p>
                    <p className="text-xs mt-1 leading-relaxed">{error}</p>
                  </div>
                </div>
              ) : translation ? (
                <div className="flex flex-col gap-6">
                  {headline && (
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 sm:p-5">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1.5">Translated Core Message</span>
                      <div className="text-xl font-bold text-slate-800 leading-snug">
                        📢 {headline}
                      </div>
                    </div>
                  )}
                  {translation && (
                    <div className="px-1">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-2">Stripped Brutal Summary</span>
                      <div className="text-base sm:text-lg text-slate-600 leading-relaxed italic border-l-4 border-blue-500 pl-4 py-1 font-light">
                        &quot;{translation}&quot;
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full min-h-[250px] flex flex-col items-center justify-center text-center text-slate-400">
                  <span className="text-5xl mb-4">🔮</span>
                  <h3 className="text-base font-semibold text-slate-800">Ready for Translation</h3>
                  <p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
                    Paste a LinkedIn post on the left and hit Translate to reveal the honest core message underneath all the buzzwords.
                  </p>
                </div>
              )}
            </div>

          </div>
          
        </div>
      </main>

      {/* Model Info Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-150 flex justify-between items-center">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <span>🤖</span> AI Model Information
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all text-sm font-semibold cursor-pointer"
              >
                ✕
              </button>
            </div>
            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-4">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Selected Provider</span>
                <p className="text-base font-semibold text-slate-800 mt-1 capitalize">{provider}</p>
              </div>
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Model Description</span>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed font-light">
                  {provider === "gemini" && "Google's high-efficiency Gemini 3.5 Flash model, optimized for speed and analytical text transformations."}
                  {provider === "openai" && "OpenAI's GPT-4o-mini, a cost-efficient and smart model for quick reasoning tasks."}
                  {provider === "anthropic" && "Anthropic's Claude 3.5 Sonnet, providing advanced reasoning, nuanced tone understanding, and high-quality prose translation."}
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Model Reference Link</span>
                <a 
                  href={modelLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 transition-colors font-semibold text-sm py-2.5 px-4 rounded-xl text-center cursor-pointer"
                >
                  Visit Reference Page <span>↗</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
