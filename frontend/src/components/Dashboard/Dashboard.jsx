import { motion } from 'framer-motion';
import CodeEditor from './CodeEditor';
import { Sparkles } from 'lucide-react';

const Dashboard = () => {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
            <Sparkles size={18} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            AI Code Review
          </h1>
        </div>
        <p className="text-sm text-gray-600 sm:text-base max-w-2xl">
          Paste your code and get instant, professional feedback on security vulnerabilities, performance bottlenecks, and code quality improvements.
        </p>
      </motion.div>

      <CodeEditor />
    </div>
  );
};

export default Dashboard;
