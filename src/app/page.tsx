"use client";

import { useState } from 'react';
import { Mic, Activity, AlertTriangle, Wallet, Store, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import SuaraView from '../views/SuaraView';
import InfraView from '../views/InfraView';
import BencanaView from '../views/BencanaView';
import SivikView from '../views/SivikView';
import NiagaView from '../views/NiagaView';

export default function App() {
  const [activeTab, setActiveTab] = useState<'suara' | 'infra' | 'bencana' | 'sivik' | 'niaga'>('suara');
  const [isEmergency, setIsEmergency] = useState(false);

  const tabs: { id: 'suara' | 'infra' | 'bencana' | 'sivik' | 'niaga', name: string, icon: any, isCenter?: boolean }[] = [
    { id: 'sivik', name: 'Nadi-Pass', icon: Wallet },
    { id: 'infra', name: 'Infra', icon: Activity },
    { id: 'suara', name: 'Voice', icon: Mic, isCenter: true },
    { id: 'bencana', name: 'Bencana', icon: AlertTriangle },
    { id: 'niaga', name: 'Niaga', icon: Store },
  ];

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-500 overflow-hidden font-sans ${isEmergency ? 'bg-[#1a0505] text-red-50' : 'bg-[#050505] text-zinc-100'
      }`}>
      {/* Mobile-style container for demo purposes */}
      <div className={`flex-1 max-w-md w-full mx-auto relative flex flex-col overflow-hidden sm:shadow-2xl sm:border-x ${isEmergency ? 'bg-[#1a0505] border-red-950/50' : 'bg-[#0A0A0C] border-zinc-900'
        }`}>

        {/* Glow Effects */}
        <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-[#C5A367]/[0.03] to-transparent pointer-events-none"></div>
        {isEmergency && <div className="absolute top-0 inset-x-0 h-full bg-red-900/10 pointer-events-none animate-pulse"></div>}

        {/* Header */}
        <header className={`px-6 py-5 flex items-center justify-between z-10 ${isEmergency ? 'bg-[#1a0505]/60' : 'bg-[#0A0A0C]/60'
          } backdrop-blur-2xl border-b ${isEmergency ? 'border-red-900/30' : 'border-zinc-800/60'
          }`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isEmergency ? 'bg-red-500/20 text-red-400' : 'bg-[#C5A367]/10 text-[#C5A367]'}`}>
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-serif font-medium tracking-tight">
                NADI
              </h1>
              <p className={`text-[9px] uppercase font-bold tracking-widest mt-0.5 ${isEmergency ? 'text-red-400' : 'text-zinc-500'}`}>
                Civic OS
              </p>
            </div>
          </div>
          {isEmergency && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 bg-red-500/20 text-red-400 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Emergency
            </motion.div>
          )}
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto relative scroll-smooth pb-32 no-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="h-full"
            >
              {activeTab === 'suara' && <SuaraView />}
              {activeTab === 'infra' && <InfraView />}
              {activeTab === 'bencana' && <BencanaView isEmergency={isEmergency} setIsEmergency={setIsEmergency} />}
              {activeTab === 'sivik' && <SivikView />}
              {activeTab === 'niaga' && <NiagaView />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Bottom Navigation */}
        <nav className={`absolute bottom-6 left-6 right-6 rounded-3xl backdrop-blur-xl border ${isEmergency ? 'bg-[#1a0505]/80 border-red-900/50 shadow-[0_10px_40px_-10px_rgba(220,38,38,0.2)]' : 'bg-[#121214]/80 border-zinc-800 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)]'
          }`}>
          <div className="flex justify-between items-center px-1 py-1 relative">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              if (tab.isCenter) {
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="relative -top-8 group focus:outline-none"
                  >
                    <div className={`absolute inset-0 rounded-full blur-lg opacity-50 transition-opacity duration-300 ${isActive
                      ? (isEmergency ? 'bg-red-500 opacity-60' : 'bg-[#C5A367] opacity-60')
                      : 'bg-transparent'
                      }`}></div>
                    <div className={`relative w-[60px] h-[60px] rounded-full flex items-center justify-center shadow-xl transition-all duration-300 border focus:outline-none ${isActive
                      ? (isEmergency ? 'bg-red-600 border-red-500 text-white' : 'bg-gradient-to-b from-[#D4AF37] to-[#B8860B] border-[#E8C34B] text-[#0A0A0C]')
                      : (isEmergency ? 'bg-[#1a0505] text-red-500 border-red-900' : 'bg-[#121214] border-zinc-800 text-[#C5A367] hover:bg-zinc-800/50')
                      }`}>
                      <Icon className={`w-6 h-6 ${isActive ? '' : 'opacity-80'}`} />
                    </div>
                  </button>
                );
              }

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-center justify-center w-16 h-14 rounded-2xl transition-all duration-300 focus:outline-none ${isActive
                    ? (isEmergency ? 'text-red-400 bg-red-500/10' : 'text-zinc-100 bg-zinc-800/50')
                    : (isEmergency ? 'text-red-900/50 hover:text-red-500' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30')
                    }`}
                >
                  <Icon className={`w-5 h-5 mb-1 transition-transform ${isActive ? 'scale-110 drop-shadow-md' : 'scale-100 opacity-70'}`} />
                  <span className={`text-[8px] uppercase tracking-widest font-bold ${isActive ? 'opacity-100 shadow-white' : 'opacity-60'}`}>{tab.name}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
