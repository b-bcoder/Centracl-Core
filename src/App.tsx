import React, { useEffect, useState, Suspense } from 'react';
import { Routes, Route, useNavigate, useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Gamepad2, 
  Wrench, 
  ChevronRight, 
  ArrowLeft, 
  Box, 
  FileSearch, 
  Shield, 
  Wallet, 
  FileCode,
  LayoutGrid,
  Search,
  Sparkles,
  X
} from 'lucide-react';

// Helper for classes
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

// Lazy Load wrappers
const AppComponents: Record<string, React.LazyExoticComponent<any>> = {};

const APP_LOADERS: Record<string, () => Promise<any>> = {
  'savegame-parser': () => import('../general/Games/Savegame Path Parser/App.tsx'),
  'sudoku': () => import('../general/Games/Sudoku/App.tsx'),
  'tetris': () => import('../general/Games/Tetris/App.tsx'),
  'datum-calculator': () => import('../general/Tools/Cash/Datum & Wat als calculator V1/App.tsx'),
  'eurocounter': () => import('../general/Tools/Cash/EuroCounter Pro (React-Version)/src/App.tsx'),
  'account-manager': () => import('../general/Tools/Security/Accountmanager V1.01 (met auth)/src/App.tsx'),
  'file-verification': () => import('../general/Tools/File explorer/Bestandsoverdracht verificatie/src/App.tsx'),
  'dems': () => import('../general/Tools/File explorer/DEMS — Dev Environment Migration Suite/src/App.tsx'),
  'fcp': () => import('../general/Tools/File explorer/FCP (File Converter Pro)/App.tsx')
};

const AppWrapper = ({ appId }: { appId: string }) => {
  if (!APP_LOADERS[appId]) return <div className="text-white">Invalid App Reference</div>;

  if (!AppComponents[appId]) {
    AppComponents[appId] = React.lazy(APP_LOADERS[appId]);
  }
  const AppComp = AppComponents[appId];
  
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="w-12 h-12 border-4 border-cyber-blue border-t-transparent rounded-full animate-spin"></div>
        <p className="text-cyber-blue font-mono animate-pulse">BOOTING SEQUENCE INITIATED...</p>
      </div>
    }>
      <AppComp />
    </Suspense>
  );
};

export default function App() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <div className="scanline"></div>
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyber-blue/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyber-pink/10 blur-[120px] rounded-full"></div>
      </div>

      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<Home navigate={navigate} />} />
          <Route path="/games" element={<GamesList navigate={navigate} />} />
          <Route path="/tools" element={<ToolsCategories navigate={navigate} />} />
          <Route path="/tools/:category" element={<ToolsList navigate={navigate} />} />
          
          {/* Specific App Routes */}
          <Route path="/app/games/:appId" element={<ActiveApp type="games" />} />
          <Route path="/app/tools/:appId" element={<ActiveApp type="tools" />} />
        </Routes>
      </AnimatePresence>

      {/* Global Navbar / Breadcrumbs if needed, but keeping it minimal for now */}
    </div>
  );
}

// --- Components ---

function Home({ navigate }: { navigate: any }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex-1 flex flex-col items-center justify-center p-6 space-y-12"
    >
      <div className="text-center space-y-4">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="inline-block"
        >
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-white neon-text uppercase italic">
            Central <span className="text-cyber-blue">Core</span>
          </h1>
        </motion.div>
        <p className="text-white/40 font-mono text-sm tracking-widest uppercase">System Interface V2.0 // Select Module</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">
        <CategoryCard 
          title="Games" 
          icon={<Gamepad2 className="w-12 h-12" />} 
          description="Entertainment & Strategy Modules"
          onClick={() => navigate('/games')}
          color="cyan"
        />
        <CategoryCard 
          title="Tools" 
          icon={<Wrench className="w-12 h-12" />} 
          description="Utility & Processing Engine"
          onClick={() => navigate('/tools')}
          color="pink"
        />
      </div>
    </motion.div>
  );
}

function CategoryCard({ title, icon, description, onClick, color }: any) {
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -5 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "group relative p-8 rounded-3xl text-left transition-all duration-500 overflow-hidden",
        "glass-card border-white/5 hover:border-white/20",
        color === 'cyan' ? 'hover:shadow-[0_0_40px_rgba(0,242,255,0.15)]' : 'hover:shadow-[0_0_40px_rgba(255,0,234,0.15)]'
      )}
    >
      <div className={cn(
        "absolute top-0 right-0 w-32 h-32 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500",
        color === 'cyan' ? 'bg-cyber-blue/20' : 'bg-cyber-pink/20'
      )} />
      
      <div className={cn(
        "mb-6 p-4 inline-block rounded-2xl transition-transform duration-500 group-hover:rotate-12",
        color === 'cyan' ? 'bg-cyber-blue/10 text-cyber-blue' : 'bg-cyber-pink/10 text-cyber-pink'
      )}>
        {icon}
      </div>
      
      <h2 className="text-3xl font-bold text-white mb-2 tracking-tight group-hover:translate-x-2 transition-transform duration-500">
        {title}
      </h2>
      <p className="text-white/50 text-sm font-mono tracking-wide leading-relaxed group-hover:translate-x-2 transition-transform duration-500 delay-75">
        {description}
      </p>

      <div className="mt-8 flex items-center gap-2 text-white/30 text-xs font-bold uppercase tracking-widest group-hover:text-white transition-colors">
        Access Module <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </div>
    </motion.button>
  );
}

function GamesList({ navigate }: { navigate: any }) {
  const games = [
    { id: 'savegame-parser', name: 'Savegame Path Parser', description: 'Extract file paths from save states', icon: <FileSearch /> },
    { id: 'sudoku', name: 'Sudoku', description: 'Classic number puzzle challenge', icon: <LayoutGrid /> },
    { id: 'tetris', name: 'Tetris', description: 'Classic block stacking action', icon: <Box /> },
  ];

  return (
    <PageWrapper title="Games Library" onBack={() => navigate('/')}>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {games.map(game => (
          <AppCard 
            key={game.id}
            app={game}
            onClick={() => navigate(`/app/games/${game.id}`)}
          />
        ))}
      </div>
    </PageWrapper>
  );
}

function ToolsCategories({ navigate }: { navigate: any }) {
  const categories = [
    { id: 'Cash', name: 'Cash', icon: <Wallet />, items: 2 },
    { id: 'Security', name: 'Security', icon: <Shield />, items: 1 },
    { id: 'Windows Verkenner', name: 'Windows Verkenner', icon: <FileCode />, items: 3 },
  ];

  return (
    <PageWrapper title="Utility Core" onBack={() => navigate('/')}>
      <div className="grid md:grid-cols-3 gap-8">
        {categories.map(cat => (
          <motion.button
            key={cat.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(`/tools/${cat.id}`)}
            className="flex flex-col items-center p-10 glass-card rounded-[40px] group border-white/5 hover:border-cyber-blue/30 transition-all hover:shadow-[0_0_50px_rgba(0,242,255,0.1)]"
          >
            <div className="p-6 bg-white/5 rounded-3xl text-white/50 group-hover:text-cyber-blue group-hover:bg-cyber-blue/10 transition-all duration-500 group-hover:scale-110 mb-6">
              {React.cloneElement(cat.icon as any, { size: 48 })}
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">{cat.name}</h3>
            <span className="text-white/30 font-mono text-xs uppercase tracking-tighter">{cat.items} Modules Active</span>
          </motion.button>
        ))}
      </div>
    </PageWrapper>
  );
}

function ToolsList({ navigate }: { navigate: any }) {
  const { category } = useParams();
  
  const tools: Record<string, any[]> = {
    'Cash': [
      { id: 'datum-calculator', name: 'Datum & Wat als calculator V1', description: 'Financial & Date simulation tool' },
      { id: 'eurocounter', name: 'Eurocounter Pro', description: 'Professional Cash Management & Count System' },
    ],
    'Security': [
      { id: 'account-manager', name: 'Accountmanager V1.01 (met auth)', description: 'Secure account & authentication manager' },
    ],
    'Windows Verkenner': [
      { id: 'file-verification', name: 'Bestandsoverdracht verificatie', description: 'Deep file integrity checking engine' },
      { id: 'dems', name: 'DEMS - Dev Environment Migration Suite', description: 'Robocopy & Symlink automation suite' },
      { id: 'fcp', name: 'FCP (File Converter Pro)', description: 'Professional file format conversion utility' },
    ]
  };

  const activeTools = tools[category || ''] || [];

  return (
    <PageWrapper title={category || 'Tools'} onBack={() => navigate('/tools')}>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeTools.map(tool => (
          <AppCard 
            key={tool.id}
            app={tool}
            onClick={() => navigate(`/app/tools/${tool.id}`)}
          />
        ))}
      </div>
    </PageWrapper>
  );
}

function AppCard({ app, onClick }: any) {
  return (
    <motion.button
      whileHover={{ scale: 1.03, y: -5 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="p-6 glass-card rounded-3xl text-left border-white/5 hover:border-white/20 transition-all group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 bg-white/5 rounded-2xl text-white/40 group-hover:text-cyber-blue transition-colors">
          {app.icon || <Sparkles className="w-6 h-6" />}
        </div>
        <div className="h-2 w-2 rounded-full bg-cyber-blue animate-pulse shadow-[0_0_10px_#00f2ff]"></div>
      </div>
      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cyber-blue transition-colors">{app.name}</h3>
      <p className="text-white/40 text-sm leading-relaxed mb-6">{app.description}</p>
      <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-white/20 uppercase group-hover:text-white/60 transition-colors">
        Initialize <ChevronRight className="w-3 h-3" />
      </div>
    </motion.button>
  );
}

function PageWrapper({ title, children, onBack }: any) {
  const [accountName, setAccountName] = useState('SYS');

  useEffect(() => {
    window.centralCore?.getLocalUsername()
      .then(username => setAccountName(username.toUpperCase()))
      .catch(() => undefined);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 p-6 md:p-12 lg:p-20 overflow-y-auto"
    >
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="flex items-center justify-between">
          <button 
            onClick={onBack}
            className="group flex items-center gap-3 text-white/40 hover:text-white transition-colors"
          >
            <div className="p-2 bg-white/5 rounded-xl group-hover:bg-white/10 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </div>
            <span className="font-mono text-xs uppercase tracking-widest">Return</span>
          </button>
          
          <div className="flex items-center gap-3">
             <div className="text-right hidden md:block">
               <div className="text-white font-bold leading-none">ROOTUSER_{accountName}</div>
             </div>
             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyber-blue to-cyber-pink p-[1px]">
               <div className="w-full h-full rounded-xl bg-cyber-dark flex items-center justify-center">
                 <Shield className="w-5 h-5 text-white" />
               </div>
             </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-5xl md:text-7xl font-black text-white italic tracking-tighter uppercase neon-text italic">
            {title}
          </h2>
          <div className="flex items-center gap-4">
            <div className="h-[2px] flex-1 bg-gradient-to-r from-cyber-blue to-transparent"></div>
            <span className="text-white/20 font-mono text-xs uppercase tracking-widest">Modules Online</span>
          </div>
        </div>

        {children}
      </div>
    </motion.div>
  );
}

function ActiveApp({ type }: { type: string }) {
  const { appId } = useParams();
  const navigate = useNavigate();

  if (!appId || !APP_LOADERS[appId]) return <div className="text-white">App Not Found</div>;

  return (
    <div className="flex-1 flex flex-col min-h-screen relative">
      <div className="absolute top-4 left-4 z-[999] flex items-center gap-4">
        <button 
          onClick={() => navigate(type === 'games' ? '/games' : `/tools`)}
          className="p-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-full text-white/50 hover:text-white hover:scale-110 transition-all opacity-40 hover:opacity-100"
          title="Exit App"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
      <AppWrapper appId={appId} />
    </div>
  );
}
