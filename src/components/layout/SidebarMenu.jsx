import React from "react";
import { Leaf, Wheat, Settings, Users, FileText } from "lucide-react";
import { palette } from "../../constants/theme";

/**
 * SidebarMenu.jsx
 *
 * O que este bloco faz:
 * Menu de navegação lateral exibido quando o usuário clica no botão "hambúrguer".
 * Alterna as visualizações entre os módulos da plataforma.
 *
 * Por que ele existe:
 * Concentrar a renderização dos links de navegação para que o `AgroSystemModernUI`
 * não fique gigante misturando Navbar, Menu, Mapa e Estado.
 *
 * @param {string} activeModule - Indica qual módulo está ativo ("estimativa" ou "configuracao").
 * @param {Function} setActiveModule - Callback para alterar o módulo de visualização principal.
 * @param {Function} setMenuOpen - Callback para fechar o menu ao selecionar um item.
 * @returns {JSX.Element} O painel lateral estilizado, ocupando 100% da altura e exibindo opções de módulos.
 */
export default function SidebarMenu({ activeModule, setActiveModule, setMenuOpen }) {
  return (
    <div className="h-full flex flex-col" style={{ background: "linear-gradient(180deg, rgba(10,10,10,0.98), rgba(13,27,42,0.98))" }}>
      <div className="h-16 px-5 flex items-center border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3 text-white font-semibold text-[18px]">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "rgba(212,175,55,0.14)", color: palette.gold }}>
            <Leaf className="w-5 h-5" />
          </div>
          <span>AgroSystem</span>
        </div>
      </div>

      <div className="p-4 space-y-2 overflow-y-auto flex-1">
        <button
          onClick={() => { setActiveModule("estimativa"); setMenuOpen(false); }}
          className="w-full flex items-center gap-4 rounded-2xl px-4 py-3 text-left transition-all hover:bg-white/5"
          style={{
            background: activeModule === "estimativa" ? "rgba(212,175,55,0.12)" : "transparent",
            border: activeModule === "estimativa" ? "1px solid rgba(230,199,107,0.18)" : "1px solid transparent",
            color: activeModule === "estimativa" ? palette.white : palette.text2,
          }}
        >
          <Wheat className="w-5 h-5 shrink-0 transition-colors" style={{ color: activeModule === "estimativa" ? palette.gold : palette.text2 }} />
          <span className="text-[15px] font-medium">Estimativa Safra</span>
        </button>

        <button
          onClick={() => { setActiveModule("configuracao"); setMenuOpen(false); }}
          className="w-full flex items-center gap-4 rounded-2xl px-4 py-3 text-left transition-all hover:bg-white/5"
          style={{
            background: activeModule === "configuracao" ? "rgba(212,175,55,0.12)" : "transparent",
            border: activeModule === "configuracao" ? "1px solid rgba(230,199,107,0.18)" : "1px solid transparent",
            color: activeModule === "configuracao" ? palette.white : palette.text2,
          }}
        >
          <Settings className="w-5 h-5 shrink-0 transition-colors" style={{ color: activeModule === "configuracao" ? palette.gold : palette.text2 }} />
          <span className="text-[15px] font-medium">Configuração da Empresa</span>
        </button>

        <button
          onClick={() => { setActiveModule("cadastroProfissional"); setMenuOpen(false); }}
          className="w-full flex items-center gap-4 rounded-2xl px-4 py-3 text-left transition-all hover:bg-white/5"
          style={{
            background: activeModule === "cadastroProfissional" ? "rgba(212,175,55,0.12)" : "transparent",
            border: activeModule === "cadastroProfissional" ? "1px solid rgba(230,199,107,0.18)" : "1px solid transparent",
            color: activeModule === "cadastroProfissional" ? palette.white : palette.text2,
          }}
        >
          <Users className="w-5 h-5 shrink-0 transition-colors" style={{ color: activeModule === "cadastroProfissional" ? palette.gold : palette.text2 }} />
          <span className="text-[15px] font-medium">Cadastro Profissional</span>
        </button>

        <button
          onClick={() => { setActiveModule("relatorioEstimativa"); setMenuOpen(false); }}
          className="w-full flex items-center gap-4 rounded-2xl px-4 py-3 text-left transition-all hover:bg-white/5"
          style={{
            background: activeModule === "relatorioEstimativa" ? "rgba(212,175,55,0.12)" : "transparent",
            border: activeModule === "relatorioEstimativa" ? "1px solid rgba(230,199,107,0.18)" : "1px solid transparent",
            color: activeModule === "relatorioEstimativa" ? palette.white : palette.text2,
          }}
        >
          <FileText className="w-5 h-5 shrink-0 transition-colors" style={{ color: activeModule === "relatorioEstimativa" ? palette.gold : palette.text2 }} />
          <span className="text-[15px] font-medium">Relatórios</span>
        </button>
      </div>
    </div>
  );
}
