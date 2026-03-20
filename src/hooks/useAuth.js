import { useState, useEffect } from "react";
import { auth } from "../services/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

/**
 * useAuth.js
 *
 * O que este bloco faz:
 * Hook customizado para gerenciar o estado global de autenticação do usuário.
 *
 * Por que ele existe:
 * Centraliza o listener do Firebase Authentication (`onAuthStateChanged`).
 * Remove a sujeira de efeitos colaterais de autenticação do componente `AgroSystemModernUI`,
 * mantendo as views focadas apenas em mostrar "Login" ou "Painel Principal".
 *
 * O que entra e o que sai:
 * @returns {Object} { logged (bool), isInitializing (bool), handleLogout (function) }
 */
export function useAuth() {
  const [logged, setLogged] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Inscreve-se nas mudanças de estado de autenticação.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setLogged(!!user);
      setIsInitializing(false); // Uma vez resolvido o callback inicial, paramos de mostrar a tela de carregamento.
    });

    // Limpa o listener quando o componente raiz desmontar.
    return () => unsubscribe();
  }, []);

  /**
   * Executa o log-out via Firebase SDK.
   */
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erro ao sair", error);
    }
  };

  return { logged, isInitializing, handleLogout };
}
