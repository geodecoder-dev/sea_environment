import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { AdminDashboard } from './pages/AdminDashboard';
import { DonationResultPage } from './pages/DonationResultPage';
import { BillplzSimulationPage } from './pages/BillplzSimulationPage';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path.split('?')[0]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Route matching
  const isSimulation = currentPath.startsWith('/billplz-simulation');
  const isAdmin = currentPath.startsWith('/admin');
  const isResult = currentPath.startsWith('/donation/result');

  return (
    <div className="min-h-screen flex flex-col bg-[#FFFDF7] text-[#123047] font-sans selection:bg-[#B8E0D2] selection:text-[#123047]">
      {/* Simulation Page renders as its own full-screen standalone portal */}
      {isSimulation ? (
        <BillplzSimulationPage onNavigate={navigate} />
      ) : isAdmin ? (
        /* Admin has its dedicated operational layout */
        <AdminDashboard onNavigate={navigate} />
      ) : (
        /* Public Pages (Homepage & Donation Result) share brand Navbar & Footer */
        <>
          <Navbar currentPath={currentPath} onNavigate={navigate} />
          
          <main className="flex-1">
            {isResult ? (
              <DonationResultPage onNavigate={navigate} />
            ) : (
              <HomePage onNavigate={navigate} />
            )}
          </main>

          <Footer onNavigate={navigate} />
        </>
      )}
    </div>
  );
}
