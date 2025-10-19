// src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("AuthProvider: Checking initial session..."); // Log start
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("AuthProvider: Initial session received.", session); // Log session result
      setUser(session?.user ?? null);
      setLoading(false);
      console.log("AuthProvider: Initial loading complete. User:", session?.user ?? null); // Log state update
    }).catch(error => {
      console.error("AuthProvider: Error getting initial session:", error); // Log errors
      setUser(null);
      setLoading(false);
      console.log("AuthProvider: Initial loading complete (error case). User: null");
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("AuthProvider: Auth state changed.", session); // Log auth change
      setUser(session?.user ?? null);
      // If the auth state changes, we are definitely not loading the initial state anymore
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => {
      console.log("AuthProvider: Unsubscribing auth listener."); // Log cleanup
      subscription.unsubscribe()
    };
  }, []); // Empty dependency array means this runs only once on mount

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Optional: Log when the provider itself renders
  // console.log("AuthProvider: Rendering context. Loading:", loading, "User:", user);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}