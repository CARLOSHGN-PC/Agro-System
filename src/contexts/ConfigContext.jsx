import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { firestore as db } from '../services/firebase';

const ConfigContext = createContext();

export function ConfigProvider({ children, currentCompanyId }) {
  const [logoColor, setLogoColor] = useState("#55AB52");

  useEffect(() => {
    if (!currentCompanyId) return;

    const companyRef = doc(db, "empresas", currentCompanyId);

    // Subscribe to company config changes
    const unsubscribe = onSnapshot(companyRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().logoColor) {
        setLogoColor(docSnap.data().logoColor);
      } else {
        setLogoColor("#55AB52"); // fallback
      }
    }, (error) => {
      console.error("Erro ao ouvir config da empresa:", error);
    });

    return () => unsubscribe();
  }, [currentCompanyId]);

  return (
    <ConfigContext.Provider value={{ logoColor, setLogoColor }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useCompanyConfig() {
  return useContext(ConfigContext);
}
