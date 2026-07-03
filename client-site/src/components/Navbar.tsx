import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, LayoutDashboard, Key } from 'lucide-react';
import { motion } from 'framer-motion';

interface NavbarProps {
  isAuthenticated: boolean;
  activeTab: 'landing' | 'dashboard' | 'login';
  setActiveTab: (tab: 'landing' | 'dashboard' | 'login') => void;
  onLogout: () => void;
  onScrollToSection: (id: string) => void;
  onNavigateAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isAuthenticated,
  activeTab,
  setActiveTab,
  onLogout,
  onScrollToSection,
  onNavigateAuth
}) => {
  const navigate = useNavigate();
  return (
    <motion.header 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed top-0 z-50 w-full bg-[#F7F6F2]/80 backdrop-blur-md border-b border-line/50 transition-colors duration-300"
    >
      <div className="mx-auto flex max-w-[1180px] h-16 items-center justify-between px-4">
        
        {/* Logo */}
        <div 
          onClick={() => {
            setActiveTab(isAuthenticated ? 'dashboard' : 'landing');
          }}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-[#080808] transition-transform duration-300 group-hover:scale-105">
            <img src="/logo.png" alt="Delegators Logo" className="h-5 w-5 object-contain invert brightness-0" />
          </div>
          <span className="font-sans text-[15px] font-semibold tracking-tight text-[#080808] transition-colors duration-300">
            DELEGATORS
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-1 sm:gap-6">
          <button
            onClick={() => navigate('/flow')}
            className="px-3 py-2 text-[14px] font-medium text-secondary transition-colors duration-200 hover:text-foreground cursor-pointer"
          >
            Flow
          </button>

          <button
            onClick={() => navigate('/pricing')}
            className="px-3 py-2 text-[14px] font-medium text-secondary transition-colors duration-200 hover:text-foreground cursor-pointer"
          >
            Pricing
          </button>
          
          <button
            onClick={() => {
              setActiveTab('landing');
              setTimeout(() => onScrollToSection('docs'), 100);
            }}
            className="px-3 py-2 text-[14px] font-medium text-secondary transition-colors duration-200 hover:text-foreground cursor-pointer"
          >
            Docs
          </button>

          {isAuthenticated ? (
            <div className="flex items-center gap-3 ml-4">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-2 px-4 py-2 rounded-sm text-[13px] font-medium transition-all duration-300 cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-[#080808] text-white'
                    : 'bg-white border border-line text-foreground hover:bg-black/5'
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                Console
              </button>
              
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-secondary transition-all duration-200 hover:text-red-600 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onNavigateAuth}
              className="ml-4 flex items-center gap-2 px-5 py-2 rounded-sm text-[14px] font-medium bg-[#080808] text-white transition-all duration-300 hover:bg-black/80 hover:scale-[1.02] cursor-pointer"
            >
              Sign In
              <Key className="h-3.5 w-3.5 opacity-70" />
            </button>
          )}
        </nav>
      </div>
    </motion.header>
  );
};
