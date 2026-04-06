import React, { Suspense, lazy } from 'react';
import { Toaster } from 'react-hot-toast';
import { useUIStore } from './stores/useUIStore';
import { usePropertyStore } from './stores/usePropertyStore';
import { useAuth } from './contexts/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy load heavy components
const PropertyListView = lazy(() => import('./components/PropertyListView').then(m => ({ default: m.PropertyListView })));
const PropertyDetails = lazy(() => import('./components/PropertyDetails').then(m => ({ default: m.PropertyDetails })));
const PropertyForm = lazy(() => import('./components/PropertyForm').then(m => ({ default: m.PropertyForm })));

import { useMemoryMonitor } from './hooks/usePerformanceDiagnostic';

function App() {
  const { view } = useUIStore();
  const { selectedProperty } = usePropertyStore();
  const { user, loading } = useAuth();
  
  // Performance Monitoring
  useMemoryMonitor();

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return null; 
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-stone-50 flex" dir="rtl">
        <Sidebar />
        
        <main className="flex-1 flex flex-col min-w-0 transition-all duration-300">
          <Header />
          
          <div className="flex-1 overflow-auto relative leading-normal">
            <Suspense fallback={<LoadingSpinner />}>
              {view === 'list' && <PropertyListView />}
              {view === 'details' && <PropertyDetails />}
              {view === 'add' && <PropertyForm />}
              {view === 'edit' && <PropertyForm />}
              
              {/* Fallback for views not yet modularized */}
              {['notifications', 'pending-properties', 'trash', 'my-listings', 'my-favorites', 'user-listings'].includes(view) && (
                <PropertyListView />
              )}

              {!['list', 'details', 'add', 'edit', 'notifications', 'pending-properties', 'trash', 'my-listings', 'my-favorites', 'user-listings'].includes(view) && (
                <div className="flex items-center justify-center h-full text-stone-400 font-bold">
                  قريباً: {view}
                </div>
              )}
            </Suspense>
          </div>
        </main>

        <Toaster position="top-center" />
      </div>
    </ErrorBoundary>
  );
}

export default App;
