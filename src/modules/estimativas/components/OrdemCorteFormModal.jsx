import React, { useState, useEffect } from 'react';
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
          setNomeColaborador('Offline (Sincronizará depois)');
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
     // Cria o colaborador se não existir e estivermos online, para o próximo acesso (opcional/melhoria futura, mas pedida pelo usuário)
     if (navigator.onLine && nomeColaborador === 'Não encontrado (Será criado)') {
         const nomeNovo = prompt("Digite o nome do novo colaborador para a matrícula " + matricula + ":");
         if (nomeNovo) {
             await setDoc(doc(firestore, `colaboradores_${companyId}`, matricula), { nome: nomeNovo });
             setNomeColaborador(nomeNovo);
             onConfirm({ frenteServico, tipoCana, tipoColheita, matricula, nomeColaborador: nomeNovo });
             return;
         }
     }

     onConfirm({ frenteServico, tipoCana, tipoColheita, matricula, nomeColaborador });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-[500px] bg-[#111a2d] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
               <Layers className="w-5 h-5" />
             </div>
             <div>
               <h2 className="text-xl font-bold text-white">Abrir Ordem de Corte</h2>
               <p className="text-sm text-gray-400">{talhoesCount} talhão(ões) selecionado(s)</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[60vh]">
           <div className="flex flex-col gap-1">
             <label className="text-sm font-medium text-gray-300">Frente de Serviço</label>
             <input
               type="text"
               value={frenteServico}
               onChange={handleFrenteChange}
               placeholder="Ex: FRENTE 1"
               className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition-colors"
             />
           </div>

           <div className="grid grid-cols-2 gap-4">
               <div className="flex flex-col gap-1">
                 <label className="text-sm font-medium text-gray-300">Tipo de Cana</label>
                 <select
                   value={tipoCana}
                   onChange={(e) => setTipoCana(e.target.value)}
                   className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition-colors appearance-none"
                 >
                   <option value="Crua" className="bg-[#111a2d]">Crua</option>
                   <option value="Queimada" className="bg-[#111a2d]">Queimada</option>
                   <option value="Bicada" className="bg-[#111a2d]">Bicada</option>
                 </select>
               </div>
               <div className="flex flex-col gap-1">
                 <label className="text-sm font-medium text-gray-300">Tipo de Colheita</label>
                 <select
                   value={tipoColheita}
                   onChange={(e) => setTipoColheita(e.target.value)}
                   className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition-colors appearance-none"
                 >
                   <option value="Manual" className="bg-[#111a2d]">Manual</option>
                   <option value="Mecanizada" className="bg-[#111a2d]">Mecanizada</option>
                 </select>
               </div>
           </div>

           <div className="flex flex-col gap-1">
             <label className="text-sm font-medium text-gray-300">Matrícula</label>
             <input
               type="text"
               value={matricula}
               onChange={(e) => setMatricula(e.target.value)}
               placeholder="Digite a matrícula"
               className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition-colors"
             />
             <div className="text-xs text-gray-400 mt-1 pl-1 flex items-center h-4">
                {isSearchingMatricula ? "Buscando..." : (matricula ? `Nome: ${nomeColaborador}` : "")}
             </div>
           </div>
        </div>

        <div className="p-5 border-t border-white/10 flex justify-end gap-3 bg-white/[0.02]">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-white font-medium hover:bg-white/10 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!frenteServico || !matricula}
            className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
          >
            Confirmar e Abrir
          </button>
        </div>
      </motion.div>
    </div>
  );
};
