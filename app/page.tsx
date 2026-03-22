"use client";

import { useState, useEffect } from "react";

export default function Translator() {
  const [inputText, setInputText] = useState("");
  const [translation, setTranslation] = useState("");
  const [headline, setHeadline] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [provider, setProvider] = useState("gemini");
  const [availableModels, setAvailableModels] = useState<{id: string, name: string, available: boolean}[]>([]);

  // Prepare for Vercel deployment using environment variable for API URL
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000";


  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/models`);
        const data = await response.json();
        setAvailableModels(data);
      } catch (err) {
        console.error("Failed to fetch models:", err);
      }
    };
    fetchModels();
  }, []);

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
    if (score <= 30) return "bg-green-100 text-green-800 border-green-200";
    if (score <= 70) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-800 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center shadow-sm">
        <h1 className="text-2xl font-normal text-gray-600 tracking-wide">
          <span className="font-semibold text-blue-600">LinkedIn</span> Bullshit Translator
        </h1>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-4 h-[600px] max-h-[70vh]">
          
          {/* Left Panel - Input */}
          <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden focus-within:ring-1 focus-within:ring-blue-500 transition-shadow">
            <div className="border-b border-gray-100 px-4 py-3 bg-white flex justify-between items-center">
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Corporate LinkedIn</h2>
              <select 
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="text-sm border border-gray-200 rounded-md text-gray-600 outline-none focus:ring-1 focus:ring-blue-500 py-1 px-2 bg-gray-50 cursor-pointer"
              >
                {availableModels.length > 0 ? (
                  availableModels.map((model) => (
                    <option key={model.id} value={model.id} disabled={!model.available}>
                      {model.name} {!model.available && "(Unavailable)"}
                    </option>
                  ))
                ) : (
                  <option value="gemini">Google (Gemini 3 Flash Preview)</option>
                )}
              </select>
            </div>
            <div className="flex-1 relative">
              <textarea
                className="w-full h-full p-4 resize-none outline-none text-xl leading-relaxed text-gray-800 placeholder-gray-400 bg-transparent"
                placeholder="Paste your synergistic paradigm shift here..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
            </div>
            <div className="px-4 py-3 border-t border-gray-100 bg-white flex justify-end">
              <button
                onClick={handleTranslate}
                disabled={isLoading || !inputText.trim()}
                className="bg-[#1A73E8] hover:bg-[#1557B0] text-white px-6 py-2.5 rounded-md font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                  "Translate"
                )}
              </button>
            </div>
          </div>

          {/* Right Panel - Output */}
          <div className="flex-1 flex flex-col bg-[#F8F9FA] rounded-xl border border-gray-200 shadow-sm overflow-hidden relative">
            <div className="border-b border-gray-200 px-4 py-3 bg-white flex justify-between items-center">
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Brutal Truth</h2>
              {score !== null && (
                <div className={`px-3 py-1 rounded-full text-xs font-bold border ${getScoreColor(score)}`}>
                  Bullshit Score: {score}/100
                </div>
              )}
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto">
              {isLoading ? (
                <div className="animate-pulse flex flex-col gap-4">
                  <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                </div>
              ) : error ? (
                <div className="text-red-500 p-4 border border-red-200 bg-red-50 rounded-lg">
                  <p className="font-semibold">Error</p>
                  <p className="text-sm">{error}</p>
                </div>
              ) : translation ? (
                <div className="flex flex-col gap-6">
                  {headline && (
                    <div className="text-2xl font-semibold text-gray-900 leading-tight">
                      🚀 Headline: {headline}
                    </div>
                  )}
                  {translation && (
                    <div className="text-xl text-gray-700 leading-relaxed font-light">
                      {translation}
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-lg font-light">
                  Translation will appear here
                </div>
              )}
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}
