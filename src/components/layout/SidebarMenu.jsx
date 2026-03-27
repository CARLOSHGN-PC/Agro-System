import React, { useState } from "react";
import { Leaf, Wheat, Settings, Users, FileText, FolderOpen, ChevronDown, ChevronRight, Sliders } from "lucide-react";
import { palette } from "../../constants/theme";
import { useCompanyConfig } from "../../contexts/ConfigContext";

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
  const [solicitacoesOpen, setSolicitacoesOpen] = useState(activeModule === "gerenciamentoOrdemCorte");
  const { logoColor } = useCompanyConfig();

  return (
    <div className="h-full flex flex-col" style={{ background: "linear-gradient(180deg, rgba(10,10,10,0.98), rgba(13,27,42,0.98))" }}>
      <div className="h-16 px-5 flex items-center border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3 text-white font-semibold text-[18px]">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: `rgba(${parseInt(logoColor.slice(1,3),16)},${parseInt(logoColor.slice(3,5),16)},${parseInt(logoColor.slice(5,7),16)},0.14)`, color: logoColor }}>
            <Leaf className="w-5 h-5" />
          </div>
          <span>AgroSystem - Usina Caçu</span>
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
          <span className="text-[15px] font-medium">Mapas</span>
        </button>

        <button
          onClick={() => { setActiveModule("premissas"); setMenuOpen(false); }}
          className="w-full flex items-center gap-4 rounded-2xl px-4 py-3 text-left transition-all hover:bg-white/5"
          style={{
            background: activeModule === "premissas" ? "rgba(212,175,55,0.12)" : "transparent",
            border: activeModule === "premissas" ? "1px solid rgba(230,199,107,0.18)" : "1px solid transparent",
            color: activeModule === "premissas" ? palette.white : palette.text2,
          }}
        >
          <Sliders className="w-5 h-5 shrink-0 transition-colors" style={{ color: activeModule === "premissas" ? palette.gold : palette.text2 }} />
          <span className="text-[15px] font-medium">Premissas</span>
        </button>

        <div>
          <button
            onClick={() => setSolicitacoesOpen(!solicitacoesOpen)}
            className="w-full flex items-center justify-between rounded-2xl px-4 py-3 text-left transition-all hover:bg-white/5"
            style={{ color: palette.text2 }}
          >
            <div className="flex items-center gap-4">
              <FolderOpen className="w-5 h-5 shrink-0 transition-colors" />
              <span className="text-[15px] font-medium">Solicitações</span>
            </div>
            {solicitacoesOpen ? (
              <ChevronDown className="w-4 h-4 shrink-0 transition-colors" />
            ) : (
              <ChevronRight className="w-4 h-4 shrink-0 transition-colors" />
            )}
          </button>

          {solicitacoesOpen && (
            <div className="pl-12 pr-4 pt-1 space-y-1">
              <button
                onClick={() => { setActiveModule("gerenciamentoOrdemCorte"); setMenuOpen(false); }}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-white/5"
                style={{
                  background: activeModule === "gerenciamentoOrdemCorte" ? "rgba(212,175,55,0.12)" : "transparent",
                  border: activeModule === "gerenciamentoOrdemCorte" ? "1px solid rgba(230,199,107,0.18)" : "1px solid transparent",
                  color: activeModule === "gerenciamentoOrdemCorte" ? palette.white : palette.text2,
                }}
              >
                <FileText className="w-4 h-4 shrink-0" style={{ color: activeModule === "gerenciamentoOrdemCorte" ? palette.gold : "inherit" }} />
                <span className="font-semibold text-[14px] truncate">Ordens de Corte</span>
              </button>
            </div>
          )}
        </div>

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

      </div>
    </div>
  );
}
