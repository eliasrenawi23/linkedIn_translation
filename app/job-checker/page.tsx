"use client";

import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { DEFAULT_RESUME } from "./constants";
import { upsertJobHistory } from "../lib/job-history";

interface AnalysisResult {
  score: number;
  recommendation: 'Apply' | 'Apply with Reservations' | 'Do Not Apply';
  matchAnalysis: {
    matchingSkills: string[];
    missingSkills: string[];
    experienceFit: string;
    cultureFit: string;
  };
  requirements: Array<{
    requirement: string;
    importance: 'must-have' | 'preferred';
    status: 'match' | 'partial' | 'missing' | 'unclear';
    resumeEvidence: string;
    explanation: string;
  }>;
  resumeTailoring: {
    summary: { suggested: string; evidenceSources: string[] };
    prioritizedSkills: string[];
    bulletRewrites: Array<{ original: string; suggested: string; evidenceSource: string }>;
    unsupportedKeywords: string[];
  };
  pros: string[];
  cons: string[];
  details: string;
  resumeTips: string[];
}

interface ApplicationPackageResult {
  coverLetter: string;
  recruiterMessage: string;
  connectionNote: string;
  whyThisCompany: string;
  interviewTalkingPoints: string[];
}

interface ModelComparisonResult {
  reviews: Array<{
    provider: 'gemini' | 'openai' | 'anthropic'; score: number;
    recommendation: 'Apply' | 'Apply with Reservations' | 'Do Not Apply';
    matchingSkills: string[]; missingSkills: string[]; criticalGaps: string[];
    summary: string; latencyMs: number;
  }>;
  failures: Array<{ provider: string; error: string; providerResponse?: unknown }>;
  consensus: {
    averageScore: number; scoreSpread: number; recommendationAgreement: boolean;
    consensusRecommendation: 'Apply' | 'Apply with Reservations' | 'Do Not Apply' | 'Mixed';
    sharedMatchingSkills: string[]; sharedMissingSkills: string[];
  };
  providerNames: Record<string, string>;
}

function inputFingerprint(resume: string, jobDescription: string): string {
  let hash = 2166136261;
  const value = `${resume}\u0000${jobDescription}`;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return `${value.length}:${hash >>> 0}`;
}

function debugPayload(value: unknown): string {
  try {
    return typeof value === "string" ? value : JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function JobChecker() {
  const [resumeMode, setResumeMode] = useState<'default' | 'paste' | 'upload'>('default');
  const [resumeText, setResumeText] = useState(DEFAULT_RESUME);
  const [pastedResume, setPastedResume] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [isImportingJob, setIsImportingJob] = useState(false);
  const [importedJobSource, setImportedJobSource] = useState("");
  const [importedJobTitle, setImportedJobTitle] = useState("");
  const [importedJobCompany, setImportedJobCompany] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorResponse, setErrorResponse] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'verdict' | 'evidence' | 'proscons' | 'skills' | 'tips' | 'applykit' | 'models'>('verdict');
  const [provider, setProvider] = useState("gemini");
  const [availableModels, setAvailableModels] = useState<{id: string, name: string, available: boolean}[]>([]);
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<string[]>([]);
  const [copiedSuggestion, setCopiedSuggestion] = useState("");
  const [applicationPackage, setApplicationPackage] = useState<ApplicationPackageResult | null>(null);
  const [packageTone, setPackageTone] = useState<'professional' | 'warm' | 'direct'>('professional');
  const [packageLength, setPackageLength] = useState<'concise' | 'standard' | 'detailed'>('standard');
  const [isGeneratingPackage, setIsGeneratingPackage] = useState(false);
  const [packageError, setPackageError] = useState("");
  const [packageErrorResponse, setPackageErrorResponse] = useState("");
  const [comparisonProviders, setComparisonProviders] = useState<string[]>([]);
  const [modelComparison, setModelComparison] = useState<ModelComparisonResult | null>(null);
  const [isComparingModels, setIsComparingModels] = useState(false);
  const [comparisonError, setComparisonError] = useState("");
  const [comparisonErrorResponse, setComparisonErrorResponse] = useState("");
  const [analysisFingerprint, setAnalysisFingerprint] = useState("");

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch(`/api/models`);
        const data = await response.json();
        setAvailableModels(data);
        setComparisonProviders(data.filter((model: { available: boolean }) => model.available).slice(0, 2).map((model: { id: string }) => model.id));
      } catch (err) {
        console.error("Failed to fetch models:", err);
      }
    };
    fetchModels();
  }, []);

  const handleResumeModeChange = (mode: 'default' | 'paste' | 'upload') => {
    setResumeMode(mode);
    setError("");
    setErrorResponse("");
    if (mode === 'default') {
      setResumeText(DEFAULT_RESUME);
    } else if (mode === 'paste') {
      setResumeText(pastedResume);
    } else {
      setResumeText("");
      setUploadedFileName("");
    }
  };

  const handlePastedResumeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPastedResume(val);
    if (resumeMode === 'paste') {
      setResumeText(val);
    }
  };

  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setError("");
    setResumeText("");

    const fileName = file.name.toLowerCase();

    // For plain text files, read client-side (faster)
    if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string || "";
        setResumeText(text);
      };
      reader.onerror = () => {
        setError("Failed to read the uploaded file.");
        setResumeText("");
      };
      reader.readAsText(file);
      return;
    }

    // For PDF/DOCX, send to server for parsing
    if (fileName.endsWith('.pdf') || fileName.endsWith('.docx')) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/parse-resume', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        console.log('Parse Resume response:', data);

        if (!response.ok) {
          throw new Error(data.error || 'Failed to parse the file');
        }

        setResumeText(data.text);
      } catch (err: unknown) {
        console.error('Parse Resume error:', err);
        setError(err instanceof Error ? err.message : 'Failed to parse the uploaded file.');
        setResumeText("");
      } finally {
        setIsUploading(false);
      }
      return;
    }

    setError("Unsupported file type. Please upload a .pdf, .docx, .txt, or .md file.");
  };

  const handleAnalyze = async () => {
    const finalResume = resumeMode === 'default' ? DEFAULT_RESUME : resumeText;

    if (!finalResume.trim()) {
      setError("Please provide a resume (either default, pasted, or uploaded file).");
      return;
    }

    if (!jobDescription.trim()) {
      setError("Please paste the job description.");
      return;
    }

    setIsLoading(true);
    setError("");
    setResult(null);
    setAcceptedSuggestions([]);
    setCopiedSuggestion("");
    setApplicationPackage(null);
    setPackageError("");
    setModelComparison(null);
    setComparisonError("");

    try {
      const response = await fetch('/api/check-job', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resume: finalResume,
          job_description: jobDescription,
          provider: provider
        }),
      });

      const data = await response.json();
      console.log('Check Job response:', data);

      if (!response.ok) {
        const fullResponse = debugPayload(data.providerResponse ?? data);
        setErrorResponse(fullResponse);
        console.error('Full Check Job AI error response:', data.providerResponse ?? data);
        throw new Error(data.error || "Failed to analyze the job description");
      }

      const analysis = data as AnalysisResult;
      setResult(analysis);
      setAnalysisFingerprint(inputFingerprint(finalResume, jobDescription));
      const firstLine = jobDescription.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "Untitled role";
      const resumeVersion = resumeMode === 'default' ? 'Default resume' : resumeMode === 'upload' ? `Uploaded: ${uploadedFileName || 'resume file'}` : 'Pasted resume';
      upsertJobHistory(window.localStorage, {
        id: window.crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        title: importedJobTitle || firstLine.replace(/^job title:\s*/i, '').slice(0, 120),
        company: importedJobCompany || 'Unknown company',
        sourceUrl: importedJobSource,
        score: analysis.score,
        recommendation: analysis.recommendation,
        resumeVersion,
        matchingSkills: analysis.matchAnalysis.matchingSkills,
        missingSkills: analysis.matchAnalysis.missingSkills,
        criticalGaps: analysis.requirements.filter((item) => item.importance === 'must-have' && item.status === 'missing').map((item) => item.requirement),
        favorite: false,
      });
      setActiveTab('verdict');
    } catch (err: unknown) {
      console.error('Check Job error:', err);
      setError(err instanceof Error ? err.message : "An error occurred during analysis.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSuggestion = (id: string) => {
    setAcceptedSuggestions((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const copySuggestion = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSuggestion(id);
      window.setTimeout(() => setCopiedSuggestion((current) => current === id ? "" : current), 1600);
    } catch {
      setCopiedSuggestion("");
    }
  };

  const handleGenerateApplicationPackage = async () => {
    if (!result) return;
    setIsGeneratingPackage(true);
    setPackageError("");
    setPackageErrorResponse("");
    setApplicationPackage(null);
    try {
      const response = await fetch('/api/application-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume: resumeMode === 'default' ? DEFAULT_RESUME : resumeText,
          job_description: jobDescription,
          requirements: result.requirements,
          provider,
          tone: packageTone,
          length: packageLength,
        }),
      });
      const data = await response.json();
      console.log('Application Package response:', data);
      if (!response.ok) {
        setPackageErrorResponse(debugPayload(data.providerResponse ?? data));
        console.error('Full Application Package AI error response:', data.providerResponse ?? data);
        throw new Error(data.error || 'Could not generate the application package');
      }
      setApplicationPackage(data);
    } catch (error: unknown) {
      console.error('Application Package error:', error);
      setPackageError(error instanceof Error ? error.message : 'Could not generate the application package.');
    } finally {
      setIsGeneratingPackage(false);
    }
  };

  const toggleComparisonProvider = (id: string) => {
    setComparisonProviders((current) => current.includes(id) ? current.filter((providerId) => providerId !== id) : current.length < 3 ? [...current, id] : current);
    setModelComparison(null);
    setComparisonError("");
    setComparisonErrorResponse("");
  };

  const handleCompareModels = async () => {
    if (!result || comparisonProviders.length < 2) return;
    const currentResume = resumeMode === 'default' ? DEFAULT_RESUME : resumeText;
    if (inputFingerprint(currentResume, jobDescription) !== analysisFingerprint) {
      setComparisonError("Resume or job inputs changed after the analysis. Run Analyze Match again before comparing models.");
      return;
    }
    setIsComparingModels(true);
    setComparisonError("");
    setComparisonErrorResponse("");
    setModelComparison(null);
    try {
      const response = await fetch('/api/compare-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume: currentResume, job_description: jobDescription, providers: comparisonProviders }),
      });
      const data = await response.json();
      if (!response.ok) {
        setComparisonErrorResponse(debugPayload(data.providerResponse ?? data));
        console.error('Full Multi-model AI error response:', data.providerResponse ?? data);
        throw new Error(data.error || 'Could not compare the selected models');
      }
      setModelComparison(data);
    } catch (error: unknown) {
      setComparisonError(error instanceof Error ? error.message : 'Could not compare the selected models.');
    } finally {
      setIsComparingModels(false);
    }
  };

  const handleImportJob = async () => {
    if (!jobUrl.trim()) {
      setError("Enter a public job-post URL.");
      return;
    }
    setIsImportingJob(true);
    setError("");
    try {
      const response = await fetch('/api/fetch-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: jobUrl }),
      });
      const data = await response.json();
      console.log('Fetch Job response:', data);
      if (!response.ok) throw new Error(data.error || 'Failed to import the job page');
      setJobDescription(data.description);
      setImportedJobSource(data.sourceUrl);
      setImportedJobTitle(data.title || "");
      setImportedJobCompany(data.company || "");
      setResult(null);
    } catch (err: unknown) {
      console.error('Fetch Job error:', err);
      setError(err instanceof Error ? err.message : 'Failed to import the job page.');
    } finally {
      setIsImportingJob(false);
    }
  };

  // Color mappings based on score
  const getScoreColors = (score: number) => {
    if (score >= 75) return { stroke: "stroke-emerald-500", text: "text-emerald-600", bg: "bg-emerald-50 text-emerald-800 border-emerald-200" };
    if (score >= 50) return { stroke: "stroke-amber-500", text: "text-amber-600", bg: "bg-amber-50 text-amber-800 border-amber-200" };
    return { stroke: "stroke-rose-500", text: "text-rose-600", bg: "bg-rose-50 text-rose-800 border-rose-200" };
  };

  const getRecommendationBadge = (rec: string) => {
    switch (rec) {
      case "Apply":
        return <span className="px-4 py-1.5 rounded-full text-sm font-semibold border bg-emerald-100 text-emerald-800 border-emerald-300 shadow-sm animate-pulse">🚀 Apply Now</span>;
      case "Apply with Reservations":
        return <span className="px-4 py-1.5 rounded-full text-sm font-semibold border bg-amber-100 text-amber-800 border-amber-300 shadow-sm">⚠️ Apply with Reservations</span>;
      default:
        return <span className="px-4 py-1.5 rounded-full text-sm font-semibold border bg-rose-100 text-rose-800 border-rose-300 shadow-sm">❌ Do Not Apply</span>;
    }
  };

  const currentScoreDetails = result ? getScoreColors(result.score) : null;
  const strokeDashoffset = result ? 251.2 - (251.2 * result.score) / 100 : 251.2;

  return (
    <div className="min-h-screen bg-slate-50 text-gray-800 font-sans flex flex-col relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
      <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-indigo-400/10 rounded-full blur-3xl pointer-events-none -z-10"></div>

      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2.5">
              <span>🎯</span> Job Match Analyzer
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Compare your credentials against a job description to evaluate your fit.
            </p>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">AI Model:</span>
            <select 
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg text-slate-600 outline-none focus:ring-1 focus:ring-blue-500 py-1.5 px-3 bg-white hover:bg-slate-50 transition-colors cursor-pointer font-semibold shadow-2xs"
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
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        
        {/* Left Column - Inputs */}
        <div className="flex-1 flex flex-col gap-6">
          
          {/* Resume Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="border-b border-gray-100 px-5 py-4 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-800">Your Resume</h2>
                <p className="text-xs text-gray-500">Provide the credentials to match against</p>
              </div>
              <div className="flex gap-1 bg-gray-200/60 p-1 rounded-lg self-start sm:self-auto">
                <button
                  onClick={() => handleResumeModeChange('default')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    resumeMode === 'default' ? "bg-white text-blue-600 shadow-xs" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  📄 Default
                </button>
                <button
                  onClick={() => handleResumeModeChange('paste')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    resumeMode === 'paste' ? "bg-white text-blue-600 shadow-xs" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  ✍️ Paste Text
                </button>
                <button
                  onClick={() => handleResumeModeChange('upload')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    resumeMode === 'upload' ? "bg-white text-blue-600 shadow-xs" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  📤 Upload
                </button>
              </div>
            </div>

            <div className="p-5 flex-1 min-h-[220px] flex flex-col">
              {resumeMode === 'default' && (
                <div className="flex-1 bg-slate-50 border border-slate-100 rounded-lg p-4 font-mono text-xs text-gray-600 overflow-y-auto max-h-[260px] leading-relaxed">
                  <pre className="whitespace-pre-wrap">{DEFAULT_RESUME}</pre>
                </div>
              )}

              {resumeMode === 'paste' && (
                <textarea
                  className="flex-1 w-full p-4 border border-gray-200 rounded-lg outline-none text-sm text-gray-800 placeholder-gray-400 focus:ring-1 focus:ring-blue-500 bg-white resize-none min-h-[200px]"
                  placeholder="Paste your markdown or plain-text resume here..."
                  value={pastedResume}
                  onChange={handlePastedResumeChange}
                />
              )}

              {resumeMode === 'upload' && (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 bg-slate-50/50 hover:bg-slate-50 transition-colors relative">
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="text-center flex flex-col items-center gap-2">
                    {isUploading ? (
                      <>
                        <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="text-sm font-medium text-blue-600">Parsing {uploadedFileName}...</p>
                      </>
                    ) : (
                      <>
                        <span className="text-3xl">📁</span>
                        <p className="text-sm font-medium text-gray-700">
                          {uploadedFileName ? `✅ Loaded: ${uploadedFileName}` : "Drag & drop a file here, or click to browse"}
                        </p>
                        <p className="text-xs text-gray-400">Supports .pdf, .docx, .txt, and .md files</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Job Description Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-[280px]">
            <div className="border-b border-gray-100 px-5 py-4 bg-gray-50">
              <h2 className="text-base font-semibold text-gray-800">Job Description</h2>
              <p className="text-xs text-gray-500">Import a public job page or paste its details</p>
            </div>
            <div className="p-5 flex-1 flex flex-col">
              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <input
                  type="url"
                  value={jobUrl}
                  onChange={(e) => setJobUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleImportJob(); } }}
                  placeholder="https://company.com/careers/job..."
                  aria-label="Public job-post URL"
                  className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg outline-none text-sm text-gray-800 placeholder-gray-400 focus:ring-1 focus:ring-blue-500 bg-white"
                />
                <button
                  type="button"
                  onClick={handleImportJob}
                  disabled={isImportingJob || !jobUrl.trim()}
                  className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isImportingJob ? "Importing..." : "Import URL"}
                </button>
              </div>
              {importedJobSource && (
                <p className="text-xs text-emerald-700 mb-3 break-all">
                  Imported successfully. Review and edit the text before analysis.
                </p>
              )}
              <textarea
                className="flex-1 w-full p-4 border border-gray-200 rounded-lg outline-none text-sm text-gray-800 placeholder-gray-400 focus:ring-1 focus:ring-blue-500 bg-white resize-none min-h-[160px]"
                placeholder="Paste responsibilities, requirements, technology stack..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
            </div>
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
              {(jobDescription.trim() || (resumeMode !== 'default' && resumeText.trim()) || result) && (
                <button
                  onClick={() => {
                    setJobDescription("");
                    setJobUrl("");
                    setImportedJobSource("");
                    setImportedJobTitle("");
                    setImportedJobCompany("");
                    setPastedResume("");
                    setUploadedFileName("");
                    if (resumeMode !== 'default') {
                      setResumeText("");
                    }
                    setResult(null);
                    setError("");
                  }}
                  className="px-4 py-2.5 rounded-lg font-semibold text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-200/50 transition-all cursor-pointer"
                >
                  Clear All
                </button>
              )}
              <button
                onClick={handleAnalyze}
                disabled={isLoading || !jobDescription.trim() || (resumeMode !== 'default' && !resumeText.trim())}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm shadow-blue-100 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Scanning Credentials...
                  </>
                ) : (
                  <>
                    <span>🔍</span> Analyze Match
                  </>
                )}
              </button>
            </div>
          </div>

        </div>

        {/* Right Column - Results */}
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden relative min-h-[500px]">
          
          {/* Header */}
          <div className="border-b border-gray-100 px-5 py-4 bg-gray-50 flex justify-between items-center">
            <h2 className="text-base font-semibold text-gray-800">Match Report</h2>
            {result && (
              <div className={`px-3 py-1 rounded-full text-xs font-bold border ${currentScoreDetails?.bg}`}>
                Match Fit: {result.score}%
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col">
            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/20">
                {/* Custom glowing radar/document scanning micro-animation */}
                <div className="relative w-40 h-40 flex items-center justify-center">
                  <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-blue-500 rounded-full animate-ping opacity-10"></div>
                  <div className="absolute top-0 bottom-0 left-0 right-0 m-auto w-24 h-32 bg-white border border-gray-200 rounded-lg shadow-lg flex flex-col p-3 overflow-hidden">
                    <div className="w-full h-2 bg-blue-100 rounded mb-2"></div>
                    <div className="w-5/6 h-2 bg-gray-100 rounded mb-2"></div>
                    <div className="w-full h-2 bg-gray-100 rounded mb-2"></div>
                    <div className="w-4/6 h-2 bg-gray-100 rounded mb-4"></div>
                    <div className="w-full h-1 bg-green-100 rounded mb-1"></div>
                    <div className="w-5/6 h-1 bg-green-100 rounded"></div>
                  </div>
                  {/* Glowing Laser Scan Bar */}
                  <div className="absolute left-4 right-4 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-lg shadow-blue-500 animate-bounce"></div>
                </div>
                <h3 className="mt-6 text-base font-semibold text-gray-800">Evaluating Job Fit</h3>
                <p className="text-xs text-gray-500 max-w-xs text-center mt-1">
                  Gemini is matching your skills, parsing requirements, and organizing recommendations...
                </p>
              </div>
            ) : error ? (
              <div className="p-6">
                <div className="text-rose-500 p-4 border border-rose-200 bg-rose-50 rounded-lg flex items-start gap-3">
                  <span className="text-xl">⚠️</span>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-sm">Error Loading Analysis</h4>
                    <p className="text-xs mt-1 leading-relaxed">{error}</p>
                    {errorResponse && (
                      <details className="mt-3 text-slate-700">
                        <summary className="text-xs font-semibold cursor-pointer">Show full AI response (sensitive)</summary>
                        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-rose-200 bg-white p-3 text-[11px] leading-relaxed">{errorResponse}</pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ) : result ? (
              <div className="flex-1 flex flex-col">
                
                {/* Score and Recommendation Dashboard Header */}
                <div className="p-6 bg-gradient-to-br from-slate-50 to-white border-b border-gray-100 flex flex-col sm:flex-row items-center gap-6">
                  {/* Radial Gauge */}
                  <div className="relative flex items-center justify-center">
                    <svg className="w-24 h-24 transform -rotate-90">
                      <circle cx="48" cy="48" r="40" className="stroke-gray-200 fill-transparent" strokeWidth="6" />
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        className={`fill-transparent transition-all duration-1000 ease-out ${currentScoreDetails?.stroke}`}
                        strokeWidth="6"
                        strokeDasharray="251.2"
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className={`absolute text-2xl font-bold ${currentScoreDetails?.text}`}>
                      {result.score}%
                    </span>
                  </div>

                  <div className="flex-1 text-center sm:text-left">
                    <div className="mb-2">{getRecommendationBadge(result.recommendation)}</div>
                    <p className="text-sm font-medium text-gray-700 leading-tight">
                      Experience Fit Check:
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 italic">
                      &quot;{result.matchAnalysis.experienceFit}&quot;
                    </p>
                  </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-gray-200 px-4 bg-gray-50 overflow-x-auto">
                  <button
                    onClick={() => setActiveTab('verdict')}
                    className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 outline-none cursor-pointer ${
                      activeTab === 'verdict' ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    📝 Verdict
                  </button>
                  <button
                    onClick={() => setActiveTab('evidence')}
                    className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-all border-b-2 outline-none cursor-pointer ${
                      activeTab === 'evidence' ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    Evidence ({result.requirements.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('proscons')}
                    className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 outline-none cursor-pointer ${
                      activeTab === 'proscons' ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    ⚖️ Pros & Cons
                  </button>
                  <button
                    onClick={() => setActiveTab('skills')}
                    className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 outline-none cursor-pointer ${
                      activeTab === 'skills' ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    💡 Skills
                  </button>
                  <button
                    onClick={() => setActiveTab('tips')}
                    className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 outline-none cursor-pointer ${
                      activeTab === 'tips' ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    🚀 Tweak Resume
                  </button>
                  <button
                    onClick={() => setActiveTab('applykit')}
                    className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-all border-b-2 outline-none cursor-pointer ${
                      activeTab === 'applykit' ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    Apply Kit
                  </button>
                  <button
                    onClick={() => setActiveTab('models')}
                    className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-all border-b-2 outline-none cursor-pointer ${
                      activeTab === 'models' ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    Model Review
                  </button>
                </div>

                {/* Tab Panel Contents */}
                <div className="flex-1 p-6 overflow-y-auto max-h-[380px]">
                  
                  {activeTab === 'verdict' && (
                    <div className="flex flex-col gap-4">
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Detailed Analysis</h4>
                        <p className="text-sm text-gray-700 leading-relaxed font-light bg-slate-50/50 p-4 rounded-lg border border-slate-100">
                          {result.details}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Culture Alignment</h4>
                        <p className="text-sm text-gray-600 leading-relaxed italic bg-blue-50/20 p-4 rounded-lg border border-blue-50/30">
                          📌 &quot;{result.matchAnalysis.cultureFit}&quot;
                        </p>
                      </div>
                    </div>
                  )}

                  {activeTab === 'evidence' && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <div>
                          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Requirement Evidence</h4>
                          <p className="text-xs text-gray-500 mt-1">Each conclusion is tied to information found in your resume.</p>
                        </div>
                        <span className="text-xs text-gray-500 shrink-0">
                          {result.requirements.filter((item) => item.status === 'match').length}/{result.requirements.length} matched
                        </span>
                      </div>
                      {result.requirements.map((item, idx) => {
                        const statusStyles = {
                          match: "bg-emerald-50 text-emerald-700 border-emerald-200",
                          partial: "bg-amber-50 text-amber-700 border-amber-200",
                          missing: "bg-rose-50 text-rose-700 border-rose-200",
                          unclear: "bg-slate-100 text-slate-600 border-slate-200",
                        };
                        const isCriticalGap = item.importance === 'must-have' && item.status === 'missing';
                        return (
                          <article
                            key={`${item.requirement}-${idx}`}
                            className={`rounded-xl border p-4 ${isCriticalGap ? "border-rose-300 bg-rose-50/30 ring-1 ring-rose-100" : "border-slate-200 bg-white"}`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                              <h5 className="text-sm font-semibold text-slate-800 leading-snug">{item.requirement}</h5>
                              <div className="flex gap-1.5 shrink-0">
                                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${item.importance === 'must-have' ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}>
                                  {item.importance}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${statusStyles[item.status]}`}>
                                  {item.status}
                                </span>
                              </div>
                            </div>
                            {isCriticalGap && <p className="text-xs font-semibold text-rose-700 mt-2">Critical gap: a must-have requirement has no supporting evidence.</p>}
                            <div className="mt-3 grid grid-cols-1 gap-2">
                              <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Resume evidence</span>
                                <p className="text-xs text-slate-700 leading-relaxed">{item.resumeEvidence}</p>
                              </div>
                              <p className="text-xs text-slate-500 leading-relaxed">{item.explanation}</p>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}

                  {activeTab === 'proscons' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-emerald-50/30 border border-emerald-100/50 rounded-xl p-4">
                        <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                          <span>✅</span> Key Strengths (Pros)
                        </h4>
                        <ul className="flex flex-col gap-2.5">
                          {result.pros.map((pro, idx) => (
                            <li key={idx} className="text-xs text-gray-700 leading-relaxed flex items-start gap-2">
                              <span className="text-emerald-500 text-sm mt-0.5">•</span>
                              <span>{pro}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-rose-50/30 border border-rose-100/50 rounded-xl p-4">
                        <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                          <span>⚠️</span> Risks & Gaps (Cons)
                        </h4>
                        <ul className="flex flex-col gap-2.5">
                          {result.cons.map((con, idx) => (
                            <li key={idx} className="text-xs text-gray-700 leading-relaxed flex items-start gap-2">
                              <span className="text-rose-500 text-sm mt-0.5">•</span>
                              <span>{con}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {activeTab === 'skills' && (
                    <div className="flex flex-col gap-5">
                      <div>
                        <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wide mb-2 flex items-center gap-1">
                          <span>✨</span> Skills You Possess
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {result.matchAnalysis.matchingSkills.length > 0 ? (
                            result.matchAnalysis.matchingSkills.map((skill, idx) => (
                              <span key={idx} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md text-xs font-semibold shadow-2xs">
                                {skill}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-500 italic">No exact skill matches detected.</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wide mb-2 flex items-center gap-1">
                          <span>🔍</span> Gaps to Address
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {result.matchAnalysis.missingSkills.length > 0 ? (
                            result.matchAnalysis.missingSkills.map((skill, idx) => (
                              <span key={idx} className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-100 rounded-md text-xs font-semibold shadow-2xs">
                                {skill}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-emerald-600 font-medium">Excellent profile match! No major skills missing.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'tips' && (
                    <div className="flex flex-col gap-5">
                      <section>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wide">Suggested Summary</h4>
                          <div className="flex gap-1.5">
                            <button type="button" onClick={() => void copySuggestion('summary', result.resumeTailoring.summary.suggested)} className="px-2.5 py-1 rounded-md border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">
                              {copiedSuggestion === 'summary' ? 'Copied' : 'Copy'}
                            </button>
                            <button type="button" onClick={() => toggleSuggestion('summary')} className={`px-2.5 py-1 rounded-md border text-[11px] font-semibold ${acceptedSuggestions.includes('summary') ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-blue-200 text-blue-700 hover:bg-blue-50"}`}>
                              {acceptedSuggestions.includes('summary') ? 'Accepted' : 'Accept'}
                            </button>
                          </div>
                        </div>
                        <div className={`rounded-xl border p-4 ${acceptedSuggestions.includes('summary') ? "border-emerald-200 bg-emerald-50/30" : "border-blue-100 bg-blue-50/20"}`}>
                          <p className="text-sm text-slate-700 leading-relaxed">{result.resumeTailoring.summary.suggested}</p>
                          <div className="mt-3 pt-3 border-t border-slate-200/60">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Supported by</span>
                            <ul className="mt-1 flex flex-col gap-1">
                              {result.resumeTailoring.summary.evidenceSources.map((source, idx) => <li key={idx} className="text-xs text-slate-500">• {source}</li>)}
                            </ul>
                          </div>
                        </div>
                      </section>

                      <section>
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Prioritized Skills</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {result.resumeTailoring.prioritizedSkills.map((skill, idx) => (
                            <span key={`${skill}-${idx}`} className="px-2.5 py-1 rounded-md bg-violet-50 border border-violet-100 text-violet-700 text-xs font-semibold">{idx + 1}. {skill}</span>
                          ))}
                        </div>
                      </section>

                      <section>
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Bullet Rewrites</h4>
                        {result.resumeTailoring.bulletRewrites.length > 0 ? (
                          <div className="flex flex-col gap-3">
                            {result.resumeTailoring.bulletRewrites.map((rewrite, idx) => {
                              const id = `bullet-${idx}`;
                              const accepted = acceptedSuggestions.includes(id);
                              return (
                                <article key={id} className={`rounded-xl border overflow-hidden ${accepted ? "border-emerald-200" : "border-slate-200"}`}>
                                  <div className="p-3 bg-rose-50/30 border-b border-slate-100">
                                    <span className="block text-[10px] font-bold text-rose-500 uppercase tracking-wide mb-1">Before</span>
                                    <p className="text-xs text-slate-600 leading-relaxed">{rewrite.original}</p>
                                  </div>
                                  <div className={`p-3 ${accepted ? "bg-emerald-50/30" : "bg-white"}`}>
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <span className="block text-[10px] font-bold text-emerald-600 uppercase tracking-wide mb-1">After</span>
                                        <p className="text-xs text-slate-700 leading-relaxed font-medium">{rewrite.suggested}</p>
                                      </div>
                                      <div className="flex gap-1 shrink-0">
                                        <button type="button" onClick={() => void copySuggestion(id, rewrite.suggested)} className="px-2 py-1 rounded border border-slate-200 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">{copiedSuggestion === id ? 'Copied' : 'Copy'}</button>
                                        <button type="button" onClick={() => toggleSuggestion(id)} className={`px-2 py-1 rounded border text-[10px] font-semibold ${accepted ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "border-blue-200 text-blue-700 hover:bg-blue-50"}`}>{accepted ? 'Accepted' : 'Accept'}</button>
                                      </div>
                                    </div>
                                    <p className="mt-2 text-[11px] text-slate-400"><span className="font-semibold">Evidence:</span> {rewrite.evidenceSource}</p>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        ) : <p className="text-xs text-slate-500 italic">No resume bullets were suitable for a safe rewrite.</p>}
                      </section>

                      {result.resumeTailoring.unsupportedKeywords.length > 0 && (
                        <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                          <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wide">Do Not Add Without Evidence</h4>
                          <p className="text-xs text-amber-700 mt-1 mb-2">These job keywords are relevant, but your resume does not currently support them.</p>
                          <div className="flex flex-wrap gap-1.5">
                            {result.resumeTailoring.unsupportedKeywords.map((keyword, idx) => <span key={`${keyword}-${idx}`} className="px-2 py-1 rounded bg-white border border-amber-200 text-amber-800 text-xs">{keyword}</span>)}
                          </div>
                        </section>
                      )}

                      <section>
                        <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-3">Additional Recommendations</h4>
                        <ul className="flex flex-col gap-2">
                          {result.resumeTips.map((tip, idx) => (
                            <li key={idx} className="bg-blue-50/20 border border-blue-100/30 rounded-lg p-3 text-xs text-gray-700 leading-relaxed flex items-start gap-2.5">
                              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px] shrink-0">{idx + 1}</span>
                              <span>{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    </div>
                  )}

                  {activeTab === 'applykit' && (
                    <div className="flex flex-col gap-4">
                      <div>
                        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Application Package</h4>
                        <p className="text-xs text-gray-500 mt-1">Generated from your resume and the verified evidence matrix. Review every message before sending.</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                        <label className="text-xs font-semibold text-slate-600">
                          Tone
                          <select value={packageTone} onChange={(event) => setPackageTone(event.target.value as typeof packageTone)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:ring-1 focus:ring-blue-500">
                            <option value="professional">Professional</option>
                            <option value="warm">Warm</option>
                            <option value="direct">Direct</option>
                          </select>
                        </label>
                        <label className="text-xs font-semibold text-slate-600">
                          Length
                          <select value={packageLength} onChange={(event) => setPackageLength(event.target.value as typeof packageLength)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:ring-1 focus:ring-blue-500">
                            <option value="concise">Concise</option>
                            <option value="standard">Standard</option>
                            <option value="detailed">Detailed</option>
                          </select>
                        </label>
                        <button type="button" onClick={() => void handleGenerateApplicationPackage()} disabled={isGeneratingPackage} className="sm:col-span-2 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed">
                          {isGeneratingPackage ? 'Generating application package...' : applicationPackage ? 'Regenerate Package' : 'Generate Application Package'}
                        </button>
                      </div>

                      {packageError && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"><p>{packageError}</p>{packageErrorResponse && <details className="mt-2 text-slate-700"><summary className="font-semibold cursor-pointer">Show full AI response (sensitive)</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-white p-2 text-[11px]">{packageErrorResponse}</pre></details>}</div>}

                      {applicationPackage && (
                        <div className="flex flex-col gap-3">
                          {[
                            { id: 'cover-letter', label: 'Cover Letter', text: applicationPackage.coverLetter },
                            { id: 'recruiter-message', label: 'Recruiter Message', text: applicationPackage.recruiterMessage },
                            { id: 'connection-note', label: 'Connection Note', text: applicationPackage.connectionNote },
                            { id: 'why-company', label: 'Why This Company?', text: applicationPackage.whyThisCompany },
                          ].map((item) => (
                            <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
                              <div className="flex items-center justify-between gap-3 mb-2">
                                <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wide">{item.label}</h5>
                                <button type="button" onClick={() => void copySuggestion(item.id, item.text)} className="px-2.5 py-1 rounded-md border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">{copiedSuggestion === item.id ? 'Copied' : 'Copy'}</button>
                              </div>
                              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{item.text}</p>
                              {item.id === 'connection-note' && <p className="mt-2 text-[10px] text-slate-400 text-right">{item.text.length}/280 characters</p>}
                            </article>
                          ))}

                          <article className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Interview Talking Points</h5>
                              <button type="button" onClick={() => void copySuggestion('talking-points', applicationPackage.interviewTalkingPoints.map((point) => `• ${point}`).join('\n'))} className="px-2.5 py-1 rounded-md border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">{copiedSuggestion === 'talking-points' ? 'Copied' : 'Copy All'}</button>
                            </div>
                            <ul className="flex flex-col gap-2">
                              {applicationPackage.interviewTalkingPoints.map((point, idx) => <li key={idx} className="text-sm text-slate-700 leading-relaxed flex gap-2"><span className="text-blue-500">•</span><span>{point}</span></li>)}
                            </ul>
                          </article>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'models' && (
                    <div className="flex flex-col gap-4">
                      <div>
                        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Multi-model Review</h4>
                        <p className="text-xs text-gray-500 mt-1">Compare independent compact reviews without replacing your primary analysis.</p>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                        <span className="block text-xs font-semibold text-slate-600 mb-2">Select 2-3 configured providers</span>
                        <div className="flex flex-wrap gap-2">
                          {availableModels.map((model) => {
                            const selected = comparisonProviders.includes(model.id);
                            return (
                              <button key={model.id} type="button" disabled={!model.available || (!selected && comparisonProviders.length >= 3)} onClick={() => toggleComparisonProvider(model.id)} className={`px-3 py-2 rounded-lg border text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed ${selected ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-slate-200 text-slate-600"}`}>
                                {selected ? '✓ ' : ''}{model.name}{!model.available ? ' (Unavailable)' : ''}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[11px] text-amber-700 mt-3">This runs {comparisonProviders.length || 0} additional paid AI requests in parallel. Provider billing applies; exact cost is not available.</p>
                        <button type="button" onClick={() => void handleCompareModels()} disabled={isComparingModels || comparisonProviders.length < 2} className="mt-3 w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed">
                          {isComparingModels ? 'Comparing models...' : modelComparison ? 'Run Comparison Again' : 'Compare Selected Models'}
                        </button>
                        {availableModels.filter((model) => model.available).length < 2 && <p className="mt-2 text-xs text-rose-600">Configure at least two provider API keys to use this feature.</p>}
                      </div>

                      {comparisonError && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"><p>{comparisonError}</p>{comparisonErrorResponse && <details className="mt-2 text-slate-700"><summary className="font-semibold cursor-pointer">Show full AI response (sensitive)</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-white p-2 text-[11px]">{comparisonErrorResponse}</pre></details>}</div>}

                      {modelComparison && (
                        <div className="flex flex-col gap-4">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div className="rounded-lg bg-blue-50 p-3 text-center"><strong className="block text-xl text-blue-700">{modelComparison.consensus.averageScore}%</strong><span className="text-[10px] text-slate-500">simple average</span></div>
                            <div className="rounded-lg bg-violet-50 p-3 text-center"><strong className="block text-xl text-violet-700">{modelComparison.consensus.scoreSpread}</strong><span className="text-[10px] text-slate-500">point spread</span></div>
                            <div className="rounded-lg bg-slate-100 p-3 text-center"><strong className="block text-sm text-slate-700 mt-1">{modelComparison.consensus.consensusRecommendation}</strong><span className="text-[10px] text-slate-500">consensus</span></div>
                            <div className={`rounded-lg p-3 text-center ${modelComparison.consensus.recommendationAgreement ? "bg-emerald-50" : "bg-amber-50"}`}><strong className={`block text-sm mt-1 ${modelComparison.consensus.recommendationAgreement ? "text-emerald-700" : "text-amber-700"}`}>{modelComparison.consensus.recommendationAgreement ? 'Agreed' : 'Disagreed'}</strong><span className="text-[10px] text-slate-500">recommendation</span></div>
                          </div>

                          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                            {modelComparison.reviews.map((review) => (
                              <article key={review.provider} className="rounded-xl border border-slate-200 bg-white p-4">
                                <div className="flex items-start justify-between gap-3"><div><h5 className="text-sm font-bold text-slate-800">{modelComparison.providerNames[review.provider] || review.provider}</h5><p className="text-[10px] text-slate-400 mt-0.5">{(review.latencyMs / 1000).toFixed(1)}s</p></div><span className="text-2xl font-extrabold text-blue-600">{review.score}%</span></div>
                                <p className="text-xs font-semibold text-slate-600 mt-3">{review.recommendation}</p>
                                <p className="text-xs text-slate-500 leading-relaxed mt-2">{review.summary}</p>
                                <div className="mt-3"><span className="text-[10px] font-bold uppercase text-emerald-600">Matches</span><p className="text-xs text-slate-600 mt-1">{review.matchingSkills.join(', ') || 'None identified'}</p></div>
                                <div className="mt-3"><span className="text-[10px] font-bold uppercase text-rose-600">Critical gaps</span><p className="text-xs text-slate-600 mt-1">{review.criticalGaps.join(', ') || 'None identified'}</p></div>
                              </article>
                            ))}
                          </div>

                          {(modelComparison.consensus.sharedMatchingSkills.length > 0 || modelComparison.consensus.sharedMissingSkills.length > 0) && (
                            <section className="rounded-xl border border-slate-200 bg-white p-4">
                              <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Shared findings across successful models</h5>
                              {modelComparison.consensus.sharedMatchingSkills.length > 0 && <p className="mt-2 text-xs text-emerald-700"><span className="font-semibold">Matches:</span> {modelComparison.consensus.sharedMatchingSkills.join(', ')}</p>}
                              {modelComparison.consensus.sharedMissingSkills.length > 0 && <p className="mt-2 text-xs text-rose-700"><span className="font-semibold">Missing:</span> {modelComparison.consensus.sharedMissingSkills.join(', ')}</p>}
                            </section>
                          )}

                          {modelComparison.failures.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h5 className="text-xs font-bold text-amber-800 uppercase">Partial failures</h5>{modelComparison.failures.map((failure) => <div key={failure.provider} className="mt-2"><p className="text-xs text-amber-700"><span className="font-semibold">{modelComparison.providerNames[failure.provider] || failure.provider}:</span> {failure.error}</p>{failure.providerResponse !== undefined && <details className="mt-1 text-slate-700"><summary className="text-xs font-semibold cursor-pointer">Show full AI response (sensitive)</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-white p-2 text-[11px]">{debugPayload(failure.providerResponse)}</pre></details>}</div>)}</div>}
                        </div>
                      )}
                    </div>
                  )}

                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/10">
                <span className="text-5xl mb-4">🔮</span>
                <h3 className="text-base font-semibold text-gray-800">Ready for Scan</h3>
                <p className="text-xs text-gray-500 max-w-xs mt-1">
                  Paste the job posting description on the left, select/paste your resume, and click &quot;Analyze Match&quot; to generate your fit analysis.
                </p>
              </div>
            )}
          </div>
 
        </div>
 
      </div>
      </main>
    </div>
  );
}
