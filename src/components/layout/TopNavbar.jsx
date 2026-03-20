import React from "react";
import { Leaf, Menu, Bell, User, CloudOff, CloudUpload, CheckCircle2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { palette } from "../../constants/theme";
import db from "../../services/localDb";
import { showSuccess } from "../../utils/alert";

/**
 * TopNavbar.jsx
 *
 * O que este bloco faz:
 * O cabeçalho fixo superior. Mostra o logo, o botão de abrir o menu lateral e
 * os menus suspensos de Notificação e Perfil.
 *
 * Por que ele existe:
 * Separar a renderização da Toolbar superior evita sujar o componente
 * principal e torna as lógicas de dropdown e z-indexes mais fáceis de prever.
 *
 * @param {Function} setMenuOpen - Função que alterna a barra lateral (Sidebar).
 * @param {boolean} notificationsOpen - Controle do estado do popover de notificação.
 * @param {Function} setNotificationsOpen - Setter de notificação.
 * @param {boolean} profileOpen - Controle de estado do popover de perfil.
 * @param {Function} setProfileOpen - Setter do perfil.
 * @param {Array} notifications - Lista mock de notificações.
 * @param {Function} onLogout - Callback executado no click de Sair do perfil.
 */
export default function TopNavbar({
  setMenuOpen,
  notificationsOpen,
  setNotificationsOpen,
  profileOpen,
  setProfileOpen,
  notifications = [],
  onLogout
}) {
  const [isOffline, setIsOffline] = React.useState(!navigator.onLine);
  const [pendingCount, setPendingCount] = React.useState(0);
  const [isSyncing, setIsSyncing] = React.useState(false);

  // Monitora o estado da conexão e exibe toast de conclusão quando houver sync finalizado
  React.useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    const handleSyncCompleted = (e) => {
      setIsSyncing(false);
      if (e.detail && e.detail.count > 0) {
        showSuccess(
          "Sincronização Concluída",
          `${e.detail.count} estimativa(s) enviada(s) para a nuvem com sucesso!`
        );
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('sync-completed', handleSyncCompleted);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sync-completed', handleSyncCompleted);
    };
  }, []);

  // Hook no banco Dexie para mostrar a fila pendente ao vivo no ícone de nuvem
  React.useEffect(() => {
    const updatePendingCount = async () => {
      try {
        const count = await db.syncQueue.where('status').equals('pending').count();
        setPendingCount(count);
        // Se temos internet mas ainda há pendentes diminuindo, consideramos estar sincronizando
        if (!isOffline && count > 0) {
            setIsSyncing(true);
        } else if (count === 0) {
            setIsSyncing(false);
        }
      } catch (err) {
        console.error("Erro ao ler fila de sync para o badge", err);
      }
    };

    // Lê inicial
    updatePendingCount();

    // Podemos ouvir um evento que nós mesmos emitimos no app quando enfileiramos ou tentar ler num intervalo
    // No caso como Dexie LiveQuery é um pouco mais chato de usar sem hooks nativos, faremos um poll a cada 3s caso offline
    // Ou quando o app interage com o window
    const interval = setInterval(updatePendingCount, 2500);

    return () => clearInterval(interval);
  }, [isOffline]);

  return (
    <div className="sticky top-0 z-30 h-16 border-b flex items-center justify-between px-3 sm:px-6" style={{ background: "rgba(10,10,10,0.82)", borderColor: "rgba(255,255,255,0.08)", backdropFilter: "blur(18px)" }}>
      {/* Esquerda: Botão Sanduíche */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center transition-colors hover:bg-white/5"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: palette.white }}
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Centro: Logo e Status de Conexão/Sincronização */}
      <div className="flex flex-col items-center absolute left-1/2 transform -translate-x-1/2">
        <div className="flex items-center gap-2 sm:gap-3 text-white font-semibold text-lg sm:text-xl">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl flex items-center justify-center" style={{ background: "rgba(212,175,55,0.14)", color: palette.gold }}>
            <Leaf className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <span className="hidden sm:inline">AgroSystem</span>
        </div>

        {/* Indicadores dinâmicos de Rede/Sync */}
        {isOffline ? (
          <div className="flex items-center gap-1.5 mt-0.5 text-orange-400">
            <CloudOff className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="text-[10px] sm:text-xs font-medium">
              Offline {pendingCount > 0 ? `(${pendingCount} pendentes)` : ''}
            </span>
          </div>
        ) : isSyncing && pendingCount > 0 ? (
          <div className="flex items-center gap-1.5 mt-0.5 text-blue-400 animate-pulse">
            <CloudUpload className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="text-[10px] sm:text-xs font-medium">
              Sincronizando {pendingCount}...
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 mt-0.5 text-green-400 opacity-70">
            <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="text-[10px] sm:text-xs font-medium">
              Sincronizado
            </span>
          </div>
        )}
      </div>

      {/* Direita: Notificações e Perfil */}
      <div className="flex items-center gap-2 sm:gap-3 relative">
        <div className="relative">
          <button
            onClick={() => {
              setNotificationsOpen((v) => !v);
              setProfileOpen(false);
            }}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-colors hover:bg-white/5"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: palette.white }}
          >
            <Bell className="w-5 h-5" />
          </button>

          {notifications.length > 0 && (
             <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: "#ef4444", color: "white" }}>
                {notifications.length}
             </span>
          )}

          <AnimatePresence>
            {notificationsOpen && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute right-0 mt-3 w-[320px] rounded-3xl border overflow-hidden shadow-2xl z-40" style={{ background: "rgba(14,16,20,0.96)", borderColor: "rgba(255,255,255,0.08)" }}>
                <div className="px-4 py-3 border-b font-semibold" style={{ borderColor: "rgba(255,255,255,0.08)" }}>Notificações</div>
                <div className="p-3 space-y-2">
                  {notifications.map((item) => (
                    <div key={item.title} className="rounded-2xl border p-3" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.06)" }}>
                      <div className="font-medium">{item.title}</div>
                      <div className="text-sm mt-1" style={{ color: palette.text2 }}>{item.text}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative">
          <button
            onClick={() => {
              setProfileOpen((v) => !v);
              setNotificationsOpen(false);
            }}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-colors hover:bg-white/5"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: palette.white }}
          >
            <User className="w-5 h-5" />
          </button>
          <AnimatePresence>
            {profileOpen && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute right-0 mt-3 w-[260px] rounded-3xl border overflow-hidden shadow-2xl z-40" style={{ background: "rgba(14,16,20,0.96)", borderColor: "rgba(255,255,255,0.08)" }}>
                <div className="p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                  <div className="font-semibold">Carlos Henrique</div>
                  <div className="text-sm mt-1" style={{ color: palette.text2 }}>Administrador • Operações Agrícolas</div>
                </div>
                <div className="p-3 space-y-2">
                  <button className="w-full text-left rounded-2xl px-3 py-3 hover:bg-white/5 transition-colors" style={{ background: "rgba(255,255,255,0.04)" }}>Meu perfil</button>
                  <button className="w-full text-left rounded-2xl px-3 py-3 hover:bg-white/5 transition-colors" style={{ background: "rgba(255,255,255,0.04)" }}>Configurações</button>
                  <button className="w-full text-left rounded-2xl px-3 py-3 hover:bg-white/5 transition-colors text-red-400" style={{ background: "rgba(255,255,255,0.04)" }} onClick={onLogout}>Sair</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
