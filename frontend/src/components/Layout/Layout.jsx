import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, History, LogOut, Menu, X, Code2, Sun, Moon } from 'lucide-react';

const Layout = () => {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Close mobile menu when navigating
    useState(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    const navItems = [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { name: 'History', path: '/history', icon: History },
    ];

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-gray-900">
            {/* Header */}
            <header className="sticky top-0 z-40 w-full border-b border-gray-200/80 bg-white/80 dark:bg-gray-900/80 dark:border-gray-700/80 backdrop-blur-md">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <Link to="/dashboard" className="flex items-center gap-2 group">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 text-white shadow-sm group-hover:shadow-md transition">
                                    <Code2 size={20} />
                                </div>
                                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-700">
                                    CodeInsight
                                </span>
                            </Link>
                        </div>

                        {/* Desktop Navigation */}
                        <nav className="hidden md:flex items-center gap-6">
                            {navItems.map((item) => {
                                const isActive = location.pathname.startsWith(item.path);
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                                            ? 'bg-primary-50 text-primary-700'
                                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                            }`}
                                    >
                                        <Icon size={18} />
                                        {item.name}
                                    </Link>
                                );
                            })}
                        </nav>

                        {/* User Menu & Mobile Toggle */}
                        <div className="flex items-center gap-4">
                            <div className="hidden md:flex items-center gap-3 pr-4 border-r border-gray-200 dark:border-gray-700">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                                    {user?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {user?.full_name || user?.email}
                                </span>
                            </div>

                            {/* Theme Toggle */}
                            <button
                                onClick={toggleTheme}
                                aria-label="Toggle theme"
                                className="rounded-lg p-2 text-gray-500 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                            >
                                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                            </button>

                            <button
                                onClick={logout}
                                className="hidden md:flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-400 transition"
                            >
                                <LogOut size={18} />
                                Logout
                            </button>

                            <button
                                className="md:hidden p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            >
                                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="md:hidden border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                    >
                        <div className="px-4 py-4 space-y-3">
                            <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-gray-50 mb-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-lg">
                                    {user?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-gray-900">{user?.full_name}</span>
                                    <span className="text-xs text-gray-500">{user?.email}</span>
                                </div>
                            </div>

                            {navItems.map((item) => {
                                const isActive = location.pathname.startsWith(item.path);
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition ${isActive
                                            ? 'bg-primary-50 text-primary-700'
                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                            }`}
                                    >
                                        <Icon size={20} />
                                        {item.name}
                                    </Link>
                                );
                            })}

                            <button
                                onClick={() => {
                                    setIsMobileMenuOpen(false);
                                    logout();
                                }}
                                className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-red-600 hover:bg-red-50 transition mt-2"
                            >
                                <LogOut size={20} />
                                Logout
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content Area */}
            <main className="flex-1 relative">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={location.pathname}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="h-full"
                    >
                        <Outlet />
                    </motion.div>
                </AnimatePresence>
            </main>

            {/* Footer */}
            <footer className="mt-auto border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-6">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-gray-500">
                        <Code2 size={18} />
                        <span className="text-sm font-medium">CodeInsight</span>
                    </div>
                    <p className="text-sm text-gray-500">
                        AI-powered code review platform. © {new Date().getFullYear()}
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default Layout;
