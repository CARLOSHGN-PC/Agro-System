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
  // `logged` agora representa se a interface foi "desbloqueada" pelo usuário através da tela de login,
  // seja por hash offline ou login real online. Não destrói a sessão nativa do Firebase.
  const [logged, setLogged] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Nós apenas aguardamos o Firebase inicializar seu estado interno para sabermos se ele já
    // estava autenticado ou não. Não forçamos signOut() aqui porque isso mataria a sessão
    // offline, impedindo o envio do sync queue pro Firestore quando a internet voltar.
    // Em vez disso, a variável `logged` inicia como false, exibindo a LoginScreen.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // Note que intencionalmente não definimos setLogged(true) aqui.
      // O usuário sempre tem que passar pela tela de login ao abrir o app para provar que é ele (ou offline com hash).
      setIsInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Esta função é chamada pela LoginScreen quando a senha é confirmada
   * (seja localmente via hash offline, seja via login online bem sucedido).
   */
  const forceLoginState = () => {
      setLogged(true);
  };

  /**
   * Executa o log-out.
   */
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setLogged(false);
    } catch (error) {
      console.error("Erro ao sair", error);
    }
  };

  return { logged, isInitializing, handleLogout, forceLoginState };
}
