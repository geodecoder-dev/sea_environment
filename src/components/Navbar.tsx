import React, { useState } from 'react';
import { Menu, X, Shield, Waves } from 'lucide-react';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, onNavigate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (href: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (href.startsWith('#')) {
      if (currentPath !== '/') {
        onNavigate('/');
        setTimeout(() => {
          const el = document.querySelector(href);
          el?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        const el = document.querySelector(href);
        el?.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      onNavigate(href);
    }
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FFFDF7]/95 backdrop-blur-md border-b border-[#123047]/10 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-20">
          
          {/* Zone 1: Brand Wordmark (Single text element in display face) */}
          <a
            href="/"
            onClick={(e) => handleNavClick('/', e)}
            className="flex items-center gap-2.5 text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7F6A] rounded-sm whitespace-nowrap shrink-0 group"
          >
            <img
              src="/images/solaris_logo.png"
              alt="Solaris logo"
              className="w-15 h-15 object-contain"
            />
            <div className="flex flex-col text-left">
              <span className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-[#123047] leading-none">
                Adopt a Coral
              </span>
              <span className="text-[10px] tracking-wider uppercase font-semibold text-[#247BA0] mt-0.5">
                Leo-Lion KL Solaris
              </span>
            </div>
          </a>

          {/* Zone 2: Navigation Links (Clean single-line text links with subtle hover underlines) */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#123047]/80">
            <a
              href="#overview"
              onClick={(e) => handleNavClick('#overview', e)}
              className="hover:text-[#247BA0] transition-colors whitespace-nowrap shrink-0 hover:underline underline-offset-8"
            >
              Why Reefs Matter
            </a>
            <a
              href="#impact"
              onClick={(e) => handleNavClick('#impact', e)}
              className="hover:text-[#247BA0] transition-colors whitespace-nowrap shrink-0 hover:underline underline-offset-8"
            >
              Our Impact
            </a>
            <a
              href="#donate"
              onClick={(e) => handleNavClick('#donate', e)}
              className="hover:text-[#247BA0] transition-colors whitespace-nowrap shrink-0 hover:underline underline-offset-8"
            >
              How to Donate

            </a>
          </nav>

          {/* Zone 3: Primary Action & Subtle Admin Access */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onNavigate('/admin')}
              title="Admin Operations"
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[#123047]/60 hover:text-[#123047] hover:bg-[#123047]/5 rounded-md transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Staff Login</span>
            </button>

            <a
              href="#donate"
              onClick={(e) => handleNavClick('#donate', e)}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-[#FF7F6A] hover:bg-[#E66652] active:scale-[0.98] rounded-xl shadow-sm transition-all whitespace-nowrap shrink-0"
            >
              Support the Reef
            </a>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-[#123047] hover:bg-[#123047]/5 rounded-lg focus:outline-none"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#123047]/10 bg-[#FFFDF7] px-4 pt-3 pb-6 space-y-3">
          <a
            href="#overview"
            onClick={(e) => handleNavClick('#overview', e)}
            className="block text-base font-medium text-[#123047] py-2 hover:text-[#247BA0]"
          >
            Why Reefs Matter
          </a>
          <a
            href="#impact"
            onClick={(e) => handleNavClick('#impact', e)}
            className="block text-base font-medium text-[#123047] py-2 hover:text-[#247BA0]"
          >
            Live Progress & Impact
          </a>
          <a
            href="#donate"
            onClick={(e) => handleNavClick('#donate', e)}
            className="block text-base font-medium text-[#123047] py-2 hover:text-[#247BA0]"
          >
            How to Donate
          </a>
          <a
            href="#about-club"
            onClick={(e) => handleNavClick('#about-club', e)}
            className="block text-base font-medium text-[#123047] py-2 hover:text-[#247BA0]"
          >
            About Leo-Lion KL Solaris
          </a>
          <div className="pt-2 border-t border-[#123047]/10 flex items-center justify-between">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onNavigate('/admin');
              }}
              className="flex items-center gap-1.5 text-xs text-[#123047]/70 py-1"
            >
              <Shield className="w-4 h-4 text-[#247BA0]" />
              <span>Admin Dashboard</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
