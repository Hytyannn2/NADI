/**
 * Family Context
 * 
 * Manages household member profiles, gamification XP, and local storage sync.
 */
'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface FamilyMember {
  id: string; name: string; avatar: string; xp: number; level: number; streak: number;
}

interface FamilyContextType {
  members: FamilyMember[];
  activeId: string;
  activeMember: FamilyMember | null;
  addMember: (name: string) => void;
  removeMember: (id: string) => void;
  switchMember: (id: string) => void;
  updateMember: (id: string, data: Partial<FamilyMember>) => void;
}

const AVATARS = ['', '', '', '', ''];

const FamilyContext = createContext<FamilyContextType>({
  members: [], activeId: '', activeMember: null,
  addMember: () => {}, removeMember: () => {}, switchMember: () => {}, updateMember: () => {},
});

export function FamilyProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('nadi_family');
      if (saved) {
        const data = JSON.parse(saved);
        setMembers(data.members || []);
        setActiveId(data.activeId || '');
      }
    } catch {}
  }, []);

  const save = (m: FamilyMember[], aId: string) => {
    try { localStorage.setItem('nadi_family', JSON.stringify({ members: m, activeId: aId })); } catch {}
  };

  const addMember = (name: string) => {
    if (members.length >= 5) return;
    const newMember: FamilyMember = {
      id: `fam-${Date.now()}`, name, avatar: AVATARS[members.length % AVATARS.length],
      xp: 0, level: 1, streak: 0,
    };
    const updated = [...members, newMember];
    setMembers(updated);
    save(updated, activeId || newMember.id);
    if (!activeId) setActiveId(newMember.id);
  };

  const removeMember = (id: string) => {
    const updated = members.filter(m => m.id !== id);
    setMembers(updated);
    const newActive = activeId === id ? (updated[0]?.id || '') : activeId;
    setActiveId(newActive);
    save(updated, newActive);
  };

  const switchMember = (id: string) => {
    setActiveId(id);
    save(members, id);
  };

  const updateMember = (id: string, data: Partial<FamilyMember>) => {
    const updated = members.map(m => m.id === id ? { ...m, ...data } : m);
    setMembers(updated);
    save(updated, activeId);
  };

  const activeMember = members.find(m => m.id === activeId) || null;

  return (
    <FamilyContext.Provider value={{ members, activeId, activeMember, addMember, removeMember, switchMember, updateMember }}>
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() { return useContext(FamilyContext); }
