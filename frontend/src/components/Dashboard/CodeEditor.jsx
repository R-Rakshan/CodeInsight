import { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseApiError, reviewAPI } from '../../services/api';
import toast from 'react-hot-toast';
import {
  Play, Loader2, Code2, AlertCircle, CheckCircle2,
  Info, AlertTriangle, Shield, Zap, SearchCode, Bug, ChevronDown, ChevronUp, Copy
} from 'lucide-react';

const DEFAULT_CODE = `function greet(name) {
  console.log("Hello, " + name);
}

greet("World");
`;

const LANGUAGE_OPTIONS = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'typescript', label: 'TypeScript' },
];

const REVIEW_TYPE_OPTIONS = [
  { value: 'full', label: 'Full Review' },
  { value: 'security', label: 'Security Only' },
  { value: 'performance', label: 'Performance Only' },
];

const SEVERITY_STYLES = {
  critical: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200', icon: AlertCircle },
  high: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200', icon: AlertTriangle },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200', icon: Info },
  low: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200', icon: CheckCircle2 },
};

const CATEGORY_ICONS = {
  security: Shield,
  performance: Zap,
  quality: SearchCode,
  bugs: Bug,
};

const CATEGORY_STYLES = {
  security: 'bg-purple-100 text-purple-700 ring-purple-200',
  performance: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  quality: 'bg-slate-100 text-slate-700 ring-slate-200',
  bugs: 'bg-rose-100 text-rose-700 ring-rose-200',
};

const getScoreStyles = (score) => {
  if (score == null) return { ring: 'ring-gray-200', text: 'text-gray-500', bg: 'bg-gray-50', label: 'N/A' };
  if (score >= 80) return { ring: 'ring-green-200', text: 'text-green-600', bg: 'bg-green-50', label: 'Excellent' };
  if (score >= 60) return { ring: 'ring-yellow-200', text: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Needs Improvement' };
  return { ring: 'ring-red-200', text: 'text-red-600', bg: 'bg-red-50', label: 'Critical Issues' };
};

const parseIssues = (issues) => {
  if (!issues) return [];
  if (Array.isArray(issues)) return issues;
  try {
    return JSON.parse(issues);
  } catch {
    return [];
  }
};

const SeverityBadge = ({ severity }) => {
  const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.low;
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${style.bg} ${style.text} ${style.border}`}>
      <Icon size={12} />
      {severity || 'unknown'}
    </span>
  );
};

const CategoryTag = ({ category }) => {
  const catStyle = CATEGORY_STYLES[category] || 'bg-gray-100 text-gray-700 ring-gray-200';
  const Icon = CATEGORY_ICONS[category] || SearchCode;

  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${catStyle}`}>
      <Icon size={12} />
      {category || 'general'}
    </span>
  );
};

const CopyButton = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy.');
    }
  }, [code]);

  return (
    <button
      onClick={handleCopy}
      title="Copy code"
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium bg-gray-700 text-gray-300 hover:bg-indigo-600 hover:text-white transition-colors"
    >
      <Copy size={12} />
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
};

const LoadingPulse = ({ progress }) => (
  <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-4">
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative flex h-20 w-20 items-center justify-center"
    >
      <div className="absolute inset-0 rounded-full border-4 border-indigo-100 animate-pulse" />
      <div className="absolute inset-0 rounded-full border-t-4 border-indigo-600 animate-spin" />
      <SparklesIcon className="h-8 w-8 text-indigo-600 animate-pulse" />
    </motion.div>
    <div className="space-y-2 w-full max-w-xs">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI is reviewing your code</h3>
      <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium animate-pulse">
        Analyzing code... {progress}%
      </p>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
        <motion.div
          className="h-2 bg-indigo-600 rounded-full"
          initial={{ width: '10%' }}
          animate={{ width: `${progress}%` }}
          transition={{ ease: 'easeOut', duration: 0.4 }}
        />
      </div>
    </div>
  </div>
);

const SparklesIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
  </svg>
);

const EmptyState = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-16 px-6 text-center"
  >
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 shadow-sm">
      <Code2 className="h-8 w-8" />
    </div>
    <h3 className="text-lg font-semibold text-gray-900">No review yet</h3>
    <p className="mt-2 max-w-sm text-sm text-gray-500">
      Paste your code, select a language and review type, then click &quot;Review Code&quot; to get
      AI-powered feedback.
    </p>
  </motion.div>
);



const IssueCard = ({ issue, index }) => {
  const lineNumber = issue.lineNumber ?? issue.line_number;
  //const hasOptimized = !!(issue.optimizedCode || issue.optimized_code);

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group relative rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md"
    >
      <div className="mb-4 flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
            {index + 1}
          </span>
          <SeverityBadge severity={issue.severity} />
          <CategoryTag category={issue.category} />
        </div>
        {lineNumber != null && (
          <span className="sm:ml-auto inline-flex items-center gap-1 rounded bg-gray-50 px-2 py-1 text-xs font-mono font-medium text-gray-600 ring-1 ring-inset ring-gray-200">
            Line {lineNumber}
          </span>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1.5">
            <AlertCircle size={14} className="text-red-400" />
            Problem
          </h4>
          <p className="text-sm leading-relaxed text-gray-800 bg-gray-50 rounded-lg p-3 border border-gray-100">{issue.description}</p>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-green-500" />
            Suggestion
          </h4>
          <p className="text-sm leading-relaxed text-gray-700">{issue.suggestion}</p>
        </div>

        {(issue.optimizedCode || issue.optimized_code) && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <Zap size={14} className="text-indigo-500" />
                Optimized snippet
              </h4>
              <CopyButton code={issue.optimizedCode || issue.optimized_code} />
            </div>
            <pre className="overflow-x-auto rounded-lg bg-gray-900 border border-gray-800 p-4 text-xs leading-relaxed text-green-400 sm:text-sm shadow-inner mt-2">
              <code>{issue.optimizedCode || issue.optimized_code}</code>
            </pre>
          </div>
        )}
      </div>
    </motion.article>
  );
};

const ReviewResults = ({ review }) => {
  const issues = parseIssues(review.issues);
  const scoreStyles = getScoreStyles(review.score);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-5"
    >
      {review.isFallback && (
        <div className="flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-4 text-sm text-yellow-800 shadow-sm transition-colors">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
          <p>AI review unavailable — showing estimated fallback feedback.</p>
        </div>
      )}

      <div className={`relative overflow-hidden flex flex-col sm:flex-row sm:items-center gap-5 rounded-2xl p-6 ring-1 ring-inset ${scoreStyles.ring} ${scoreStyles.bg} shadow-sm transition-colors`}>
        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-white opacity-20 blur-2xl pointer-events-none" />
        <div
          className={`relative z-10 flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-inset ${scoreStyles.ring} transform transition-transform hover:scale-105`}
        >
          <span className={`text-3xl font-black ${scoreStyles.text}`}>
            {review.score != null ? review.score : '—'}
          </span>
        </div>
        <div className="relative z-10 flex-1">
          <p className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-1">Overall Score</p>
          <div className="flex items-baseline gap-2">
            <p className={`text-2xl font-bold ${scoreStyles.text}`}>
              {review.score != null ? `${review.score}/100` : 'Not available'}
            </p>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-white ring-1 ring-inset ${scoreStyles.ring} ${scoreStyles.text}`}>
              {scoreStyles.label}
            </span>
          </div>
        </div>
        <div className="relative z-10 sm:text-right flex items-center justify-between sm:block border-t sm:border-t-0 border-gray-200 pt-3 sm:pt-0 mt-3 sm:mt-0 w-full sm:w-auto">
          <p className="text-sm font-medium text-gray-600">Issues Found</p>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-white font-bold shadow-sm">
            {issues.length}
          </span>
        </div>
      </div>

      {review.summary && (
        <div className="rounded-2xl border border-indigo-100 bg-white/50 backdrop-blur-sm p-5 shadow-sm transition hover:shadow-md">
          <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-900 mb-2 flex items-center gap-2">
            <Info size={16} className="text-indigo-600" />
            Summary
          </h3>
          <p className="text-sm md:text-base leading-relaxed text-gray-700">{review.summary}</p>
        </div>
      )}

      {issues.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            Detailed Findings
            <span className="text-sm font-normal text-gray-500">({issues.length})</span>
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {issues.map((issue, index) => (
              <IssueCard key={index} issue={issue} index={index} />
            ))}
          </div>
        </div>
      )}

      {review.optimized_code && (
        <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Code2 size={20} className="text-indigo-600" />
              Complete Optimized Code
            </h3>
            <CopyButton code={review.optimized_code} />
          </div>
          <pre className="overflow-x-auto rounded-xl bg-[#1e1e1e] p-5 text-sm leading-relaxed text-gray-300 shadow-xl border border-gray-800">
            <code>{review.optimized_code}</code>
          </pre>
        </div>
      )}
    </motion.div>
  );
};

const CodeEditor = () => {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [language, setLanguage] = useState('javascript');
  const [reviewType, setReviewType] = useState('full');
  const [loading, setLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState(null);
  const [progress, setProgress] = useState(10);
  const progressIntervalRef = useRef(null);

  // Mobile states
  const [isEditorCollapsed, setIsEditorCollapsed] = useState(false);

  const startProgress = useCallback(() => {
    setProgress(10);
    clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressIntervalRef.current);
          return 90;
        }
        return Math.min(prev + Math.floor(Math.random() * 8 + 3), 90);
      });
    }, 500);
  }, []);

  const stopProgress = useCallback(() => {
    clearInterval(progressIntervalRef.current);
    setProgress(10);
  }, []);

  useEffect(() => () => clearInterval(progressIntervalRef.current), []);

  const handleReview = async () => {
    if (!code.trim()) {
      toast.error('Please enter some code to review.');
      return;
    }

    setLoading(true);
    setReviewResult(null);
    startProgress();

    try {
      const response = await reviewAPI.createReview({
        code,
        language,
        review_type: reviewType,
      });

      setReviewResult(response.data.data);
      toast.success("Review complete!");
      // Auto-collapse editor on mobile when results are ready
      if (window.innerWidth < 1024) {
        setIsEditorCollapsed(true);
      }
    } catch (err) {
      if (err.isRateLimited) {
        toast.error(`Rate limited: ${err.userMessage || parseApiError(err)}`);
      } else {
        toast.error(err.userMessage || parseApiError(err));
      }
    } finally {
      stopProgress();
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start lg:gap-8">
      {/* Editor panel */}
      <section className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all sticky top-24 z-10 lg:static">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50/50 px-4 py-4 sm:px-6">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
              <Code2 size={18} className="text-indigo-600" />
              Code Input
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm text-gray-500">Provide code for analysis</p>
          </div>
          <button
            onClick={() => setIsEditorCollapsed(!isEditorCollapsed)}
            className="lg:hidden rounded-lg p-2 text-gray-500 hover:bg-gray-200 transition-colors"
            aria-label={isEditorCollapsed ? "Expand editor" : "Collapse editor"}
          >
            {isEditorCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {(!isEditorCollapsed || window.innerWidth >= 1024) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col"
            >
              <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="language" className="mb-1.5 block text-xs sm:text-sm font-semibold text-gray-700">
                      Language
                    </label>
                    <select
                      id="language"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      disabled={loading}
                      className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-gray-50"
                    >
                      {LANGUAGE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="reviewType" className="mb-1.5 block text-xs sm:text-sm font-semibold text-gray-700">
                      Review Focus
                    </label>
                    <select
                      id="reviewType"
                      value={reviewType}
                      onChange={(e) => setReviewType(e.target.value)}
                      disabled={loading}
                      className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-gray-50"
                    >
                      {REVIEW_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-gray-300 ring-1 ring-black/5 shadow-inner">
                  <Editor
                    height="400px"
                    language={language}
                    value={code}
                    onChange={(value) => setCode(value || '')}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      lineNumbers: 'on',
                      fontSize: 14,
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      wordWrap: 'on',
                      padding: { top: 16, bottom: 16 },
                      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleReview}
                  disabled={loading || !code.trim()}
                  className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-indigo-600 px-4 py-3.5 text-sm sm:text-base font-bold text-white shadow-md transition-all hover:bg-indigo-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-indigo-400 disabled:shadow-none"
                >
                  <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-100%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(100%)]">
                    <div className="relative h-full w-8 bg-white/20" />
                  </div>
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Play className="h-5 w-5" />
                      Run Analysis
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Results panel */}
      <section className="flex flex-col rounded-2xl border border-gray-200 bg-white shadow-sm lg:sticky lg:top-24">
        <div className="border-b border-gray-200 bg-gray-50/50 px-4 py-4 sm:px-6">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
            <SparklesIcon className="text-indigo-600 h-5 w-5" />
            Analysis Results
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm text-gray-500">AI-powered insights & suggestions</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:max-h-[calc(100vh-14rem)] custom-scrollbar">
          {loading && <LoadingPulse progress={progress} />}
          {!loading && !reviewResult && <EmptyState />}
          {!loading && reviewResult && <ReviewResults review={reviewResult} />}
        </div>
      </section>
    </div>
  );
};

export default CodeEditor;
