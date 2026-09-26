
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="py-8 text-center border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
      <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 sm:text-5xl">
        Savegame Path Parser
      </h1>
      <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto px-4">
        Plak je Windows Verkenner paden hieronder om ze automatisch te ontleden in een overzichtelijk tekstbestand.
      </p>
    </header>
  );
};

export default Header;
