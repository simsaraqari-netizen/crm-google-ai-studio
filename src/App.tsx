import React, { Suspense, lazy } from 'react';
import { Toaster } from 'react-hot-toast';
import { useStore } from './store/useStore';
import { useAuth } from './contexts/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy load heavy components
const PropertyListView = lazy(() => import('./components/PropertyListView').then(m => ({ default: m.PropertyListView })));
const PropertyDetails = lazy(() => import('./components/PropertyDetails').then(m => ({ default: m.PropertyDetails })));
const PropertyForm = lazy(() => import('./components/PropertyForm').then(m => ({ default: m.PropertyForm })));
// Add more lazy components as needed (UserManagement, CompanyManagement, etc.)

import { useMemoryMonitor } from './hooks/usePerformanceDiagnostic';

function App() {
  const { view, selectedProperty } = useStore();
  const { user, isInitialized } = useAuth();
  
  // Performance Monitoring
  useMemoryMonitor();

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    // AuthContext handles the redirect to login or shows the login form
    // If we're here and no user, we might be in a loading state or AuthContext is still working
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
