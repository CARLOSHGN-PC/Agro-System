import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { palette } from '../../../constants/theme';
import { Layers } from 'lucide-react';
import db from '../../../services/localDb';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from '../../../services/firebase';

export const OrdemCorteFormModal = ({ isOpen, onClose, onConfirm, talhoesCount, companyId }) => {
  const [frenteServico, setFrenteServico] = useState('');
  const [tipoCana, setTipoCana] = useState('Crua');
  const [tipoColheita, setTipoColheita] = useState('Mecanizada');
  const [matricula, setMatricula] = useState('');
  const [nomeColaborador, setNomeColaborador] = useState('');
  const [isSearchingMatricula, setIsSearchingMatricula] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFrenteServico('');
      setTipoCana('Crua');
      setTipoColheita('Mecanizada');
      setMatricula('');
      setNomeColaborador('');
    }
  }, [isOpen]);

  const handleFrenteChange = (e) => {
    let val = e.target.value.toUpperCase();
    if (val.match(/^F\d+$/) || val.match(/^FRENTE\s?\d+$/)) {
      const num = val.replace(/\D/g, '');
      if (num) val = `FRENTE ${num}`;
    }
    setFrenteServico(val);
  };

  const buscarColaborador = async (mat) => {
    if (!mat) {
      setNomeColaborador('');
      return;
    }
    setIsSearchingMatricula(true);
    try {
      // Tenta buscar no Firebase na coleção 'colaboradores'
      if (navigator.onLine) {
         const docRef = doc(firestore, `colaboradores_${companyId}`, mat);
         const docSnap = await getDoc(docRef);
         if (docSnap.exists()) {
             setNomeColaborador(docSnap.data().nome);
         } else {
             setNomeColaborador('Não encontrado (Será criado)');
         }
      } else {
          setNomeColaborador('Offline (Será criado/sincronizado)');
      }
    } catch (err) {
      console.error(err);
      setNomeColaborador('Erro na busca');
    } finally {
      setIsSearchingMatricula(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      buscarColaborador(matricula);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [matricula, companyId]);


  const handleSubmit = async () => {
     let finalNomeColaborador = nomeColaborador;

     // Cria o colaborador se não existir (ou se offline, force prompt pra não sujar o BD)
     if (nomeColaborador === 'Não encontrado (Será criado)' || nomeColaborador === 'Offline (Será criado/sincronizado)') {
         const nomeNovo = prompt("Digite o nome do novo colaborador para a matrícula " + matricula + ":");
         if (nomeNovo) {
             finalNomeColaborador = nomeNovo;
             // Se estiver online, já salva na nuvem. Se offline, só anexa no payload pra ordem e depois lidamos.
             if (navigator.onLine) {
                 await setDoc(doc(firestore, `colaboradores_${companyId}`, matricula), { nome: nomeNovo });
             }
         } else {
             // Opcional: Impedir avanço se o usuário cancelar o prompt
             return;
         }
     }

     onConfirm({ frenteServico, tipoCana, tipoColheita, matricula, nomeColaborador: finalNomeColaborador });
  };

  // Renderiza apenas se estiver aberto
  if (!isOpen) return null;

  // Usamos createPortal para jogar o modal diretamente para o <body>
  // Isso garante que ele fuja completamente de qualquer z-index ou overflow hidden do componente pai (painel lateral).
  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-5 bg-black/60 backdrop-blur-md pointer-events-auto">
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          className="w-full max-w-[920px] max-h-[90vh] flex flex-col rounded-[26px] overflow-hidden border shadow-[0_10px_30px_rgba(0,0,0,0.28)]"
          style={{ background: "#111a2d", borderColor: "rgba(255,255,255,0.12)" }}
        >
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
            <div>
              <h2 className="text-[22px] font-semibold text-white leading-tight">Abrir Ordem de Corte</h2>
              <p className="text-sm mt-1" style={{ color: palette.text2 }}>Preencha os dados abaixo para vincular {talhoesCount} talhão(ões) à nova ordem.</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl border px-3 py-2 transition-colors hover:bg-white/10 shrink-0 text-white"
              style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)" }}
            >
              ✕
            </button>
          </div>

          <div className="p-5 flex flex-col gap-4 overflow-y-auto flex-1">
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                 <div className="flex flex-col gap-2">
                   <label className="text-xs" style={{ color: palette.text2 }}>Frente de Serviço</label>
                   <input
                     type="text"
                     value={frenteServico}
                     onChange={handleFrenteChange}
                     placeholder="Ex: FRENTE 1"
                     className="w-full rounded-2xl border px-4 py-3 outline-none appearance-none focus:border-yellow-500 transition-colors text-white"
                     style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)" }}
                   />
                 </div>

                 <div className="flex flex-col gap-2">
                   <label className="text-xs" style={{ color: palette.text2 }}>Tipo de Cana</label>
                   <select
                     value={tipoCana}
                     onChange={(e) => setTipoCana(e.target.value)}
                     className="w-full rounded-2xl border px-4 py-3 outline-none appearance-none focus:border-yellow-500 transition-colors text-white"
                     style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)" }}
                   >
                     <option value="Crua" style={{ color: "black" }}>Crua</option>
                     <option value="Queimada" style={{ color: "black" }}>Queimada</option>
                     <option value="Bicada" style={{ color: "black" }}>Bicada</option>
                   </select>
                 </div>

                 <div className="flex flex-col gap-2">
                   <label className="text-xs" style={{ color: palette.text2 }}>Tipo de Colheita</label>
                   <select
                     value={tipoColheita}
                     onChange={(e) => setTipoColheita(e.target.value)}
                     className="w-full rounded-2xl border px-4 py-3 outline-none appearance-none focus:border-yellow-500 transition-colors text-white"
                     style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)" }}
                   >
                     <option value="Manual" style={{ color: "black" }}>Manual</option>
                     <option value="Mecanizada" style={{ color: "black" }}>Mecanizada</option>
                   </select>
                 </div>

                 <div className="flex flex-col gap-2">
                   <label className="text-xs" style={{ color: palette.text2 }}>Matrícula</label>
                   <input
                     type="text"
                     value={matricula}
                     onChange={(e) => setMatricula(e.target.value)}
                     placeholder="Matrícula"
                     className="w-full rounded-2xl border px-4 py-3 outline-none appearance-none focus:border-yellow-500 transition-colors text-white"
                     style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)" }}
                   />
                 </div>
             </div>

             {/* Feedback de nome abaixo da matrícula */}
             <div className="text-xs mt-[-8px] pl-1 flex items-center h-4" style={{ color: palette.text2 }}>
                {isSearchingMatricula ? "Buscando colaborador..." : (matricula ? `Colaborador: ${nomeColaborador}` : "")}
             </div>
          </div>

          <div className="flex justify-end gap-3 px-5 py-4 border-t shrink-0" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
            <button
              onClick={onClose}
              className="rounded-xl border px-4 py-3 hover:bg-white/10 transition-colors text-white font-medium"
              style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)" }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={!frenteServico || !matricula}
              className="rounded-xl px-4 py-3 transition-transform hover:scale-[1.02] text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: `linear-gradient(135deg, ${palette.gold} 0%, ${palette.goldLight} 100%)`, color: palette.bg }}
            >
              Confirmar e Abrir
            </button>
          </div>
        </motion.div>
      </div>
  );

  return createPortal(modalContent, document.body);
};
