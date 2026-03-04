import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav.tsx';

export default function AppLayout() {
  return (
    <div className="flex flex-col min-h-dvh max-w-md mx-auto bg-slate-50 relative shadow-xl overflow-hidden">
      {/* 
        This is a mobile-first PWA envelope.
        On desktop, it restricts width to max-w-md and centers it.
      */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>
      
      {/* Fixed Navigation at the bottom */}
      <BottomNav />
    </div>
  );
}
