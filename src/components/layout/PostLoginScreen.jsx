import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { palette } from "../../constants/theme";

// Components Layout
import AnimatedBackground from "../layout/AnimatedBackground";
import GlowOrb from "../layout/GlowOrb";
import TopNavbar from "../layout/TopNavbar";
import SidebarMenu from "../layout/SidebarMenu";
import CompanyConfig from "../CompanyConfig";

// Components Estimativas
import EstimativaMap from "../../modules/estimativas/EstimativaMap";
import EstimativaPanels from "../../modules/estimativas/EstimativaPanels";
import EstimativaModals from "../../modules/estimativas/EstimativaModals";

// Components Cadastro Profissional
import CadastroProfissionalPage from "../../modules/cadastroProfissional/CadastroProfissionalPage";

// Relatório Estimativa
import RelatorioEstimativaPage from "../../modules/relatorioEstimativa/components/RelatorioEstimativaPage";

// Gerenciamento Ordem de Corte
import GerenciamentoOrdemCortePage from "../../modules/gerenciamentoOrdemCorte/GerenciamentoOrdemCortePage";

// Hooks Customizados (Lógica Isolada)
import { useEstimativasData } from "../../hooks/useEstimativasData";
import { useMapFilters } from "../../hooks/useMapFilters";
import { useMapSummary } from "../../hooks/useMapSummary";
import { useOrdensCorte } from "../../hooks/estimativas/useOrdensCorte";
import { useOrdemCorteMapState } from "../../hooks/estimativas/useOrdemCorteMapState";

/**
 * PostLoginScreen.jsx
 *
 * O que este bloco faz:
 * Orquestra todo o ambiente "logado" da plataforma.
 * Conecta a barra superior (Navbar), a barra lateral (SidebarMenu) e decide qual
 * módulo renderizar no centro (Estimativa Safra vs Configuração).
 *
 * Por que ele existe:
 * Aqui fazemos a "cola" (Binding) entre o Model (useEstimativasData, etc) e a View (EstimativaMap, etc).
 * Ele injeta os "estados lógicos" nos "componentes visuais puramente declarativos".
 *
 * O que entra e o que sai:
 * @param {Function} onLogout - Handler de saída passado pelo componente Root.
 * @returns {JSX.Element} Todo o layout envolto da Dashboard.
 */
export default function PostLoginScreen({ onLogout }) {
  // === ESTADOS ESTRUTURAIS DA UI GLOBAL ===
  const [activeModule, setActiveModule] = useState("estimativa"); // "estimativa" | "configuracao"
  const [activeMapModule, setActiveMapModule] = useState("estimativa"); // "estimativa" | "tratosCulturais"
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [showLabels, setShowLabels] = useState(true);

  // Mocks de dados globais
  const currentCompanyId = "empresa_default";
  const currentSafra = "2026/2027";
  const notificationsMock = [
    { title: "Estimativa pendente", text: "Talhão 103 está sem estimativa para a safra atual." },
    { title: "Sincronização concluída", text: "Última atualização enviada com sucesso." },
  ];

  // === ESTADOS DO MAPA DE SELEÇÃO ===
  const mapRef = useRef(null);
  const [selectedTalhao, setSelectedTalhao] = useState(null);
  const [selectedTalhoes, setSelectedTalhoes] = useState([]);
  const [hoveredTalhao, setHoveredTalhao] = useState(null);
  const isMultiSelectMode = true; // Por enquanto fixo como true na especificação

  // === HOOKS LÓGICOS DE NEGÓCIO ===
  // 4. Gerencia as Ordens de Corte
  const ordensState = useOrdensCorte(currentCompanyId, currentSafra);
  const ordensMapState = useOrdemCorteMapState(ordensState.vinculosSafra);

  // 1. Gerencia dados do Firestore (Carregamento e Salvamento)
  const estData = useEstimativasData(currentCompanyId, currentSafra, setActiveModule);

  // 2. Gerencia a Filtragem do GeoJSON baseando-se nos inputs
  // Agora passamos o activeMapModule e os idsOcultos para filtrar as opções disponíveis dinamicamente
  const mapFilters = useMapFilters(
    estData.geoJsonData,
    estData.allEstimates,
    activeMapModule,
    ordensMapState.idsOcultosSet,
    ordensMapState.idsAbertosSet
  );

  // 3. Gerencia o painel de Resumo e a Legenda baseando-se no que está ativo
  const mapSummary = useMapSummary(mapFilters.enhancedGeoJson, estData.allEstimates);

  // 5. Injeta a flag visual _has_open_ordem no GeoJSON sem quebrar o hook useMapFilters
  const mapboxGeoJson = React.useMemo(() => {
     if (!mapFilters.enhancedGeoJson) return null;
     return {
        ...mapFilters.enhancedGeoJson,
        features: mapFilters.enhancedGeoJson.features.map(f => ({
            ...f,
            properties: {
                ...f.properties,
                _has_open_ordem: ordensMapState.idsAbertosSet.has(f.id)
            }
        }))
     };
  }, [mapFilters.enhancedGeoJson, ordensMapState.idsAbertosSet]);

  // Removemos mock de notificações
  // const notificationsMock = [...]

  /**
   * Handler de Clique no Mapa.
   * Aciona a inclusão/exclusão de IDs de talhões do vetor `selectedTalhoes`
   * e chama o loading da estimativa salva para eles via Firestore.
   */
  const onMapClick = (e) => {
    const feature = e.features && e.features[0];
    if (feature && feature.properties) {
      const featureId = feature.properties.featureId;

      setSelectedTalhoes(prev => {
        const newSelection = prev.includes(featureId) ? prev.filter(id => id !== featureId) : [...prev, featureId];

        // Se após clicar, a seleção tiver apenas 1 item, carregue seus dados de estimativa
        if (newSelection.length === 1) {
          const singleFeature = mapFilters.enhancedGeoJson.features.find(f => f.id === newSelection[0]);
          if (singleFeature) {
            setSelectedTalhao(singleFeature);
            estData.loadEstimateData(singleFeature);
          }
        } else if (newSelection.length === 0) {
          setSelectedTalhao(null);
        } else {
          // Quando houver mais de um selecionado, exibimos informações do último clicado apenas no contexto do form
          setSelectedTalhao(feature);
          estData.loadEstimateData(feature);
        }

        return newSelection;
      });
      setHoveredTalhao(null);
    } else {
      // Clicou fora de qualquer feature: limpa tudo
      setSelectedTalhoes([]);
      setSelectedTalhao(null);
    }
  };

  return (
    <div
      className="h-screen relative overflow-hidden flex flex-col"
      style={{
        // 100dvh garante altura real, safe-area-inset-bottom evita o map ficar atrás da barrinha de gesto de iPhones e Androids
        height: "100dvh",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        background: `linear-gradient(160deg, ${palette.bg2} 0%, ${palette.tech} 60%, ${palette.tech2} 100%)`,
        color: palette.white
      }}
    >
      <AnimatedBackground />
      <GlowOrb className="top-[-70px] right-[-70px] bg-yellow-300/20" size={260} delay={0.2} />
      <GlowOrb className="bottom-[8%] left-[-60px] bg-blue-500/20" size={300} delay={0.8} />

      {/* --- MENU LATERAL ESQUERDO --- */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/45"
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className="fixed inset-y-0 left-0 z-50 w-[285px] shadow-2xl"
            >
              <SidebarMenu activeModule={activeModule} setActiveModule={setActiveModule} setMenuOpen={setMenuOpen} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* --- MODAIS PRINCIPAIS DA ESTIMATIVA SAFRA --- */}
      {activeModule === "estimativa" && (
        <EstimativaModals
          estimateOpen={estData.estimateOpen} setEstimateOpen={estData.setEstimateOpen}
          historyOpen={estData.historyOpen} setHistoryOpen={estData.setHistoryOpen}
          filtersOpen={mapFilters.filtersOpen} setFiltersOpen={mapFilters.setFiltersOpen}

          currentSafra={currentSafra}
          currentRodada={estData.currentRodada}
          allEstimates={estData.allEstimates}

          scope={estData.scope} setScope={estData.setScope}
          selectedTalhao={selectedTalhao} selectedTalhoes={selectedTalhoes}
          setSelectedTalhao={setSelectedTalhao} setSelectedTalhoes={setSelectedTalhoes}
          enhancedGeoJson={mapFilters.enhancedGeoJson} geoJsonData={estData.geoJsonData}

          formEstimativa={estData.formEstimativa} setFormEstimativa={estData.setFormEstimativa}
          isSaving={estData.isSaving} submitEstimate={estData.submitEstimate}
          estimateHistory={estData.estimateHistory}

          filters={mapFilters.filters} setFilters={mapFilters.setFilters}
          setAppliedFilters={mapFilters.setAppliedFilters} filterOptions={mapFilters.filterOptions}
          updateFormAreaFromScope={estData.updateFormAreaFromScope}
        />
      )}

      {/* --- CORPO DA PÁGINA (NAVBAR + CONTEÚDO) --- */}
      <div className="relative z-10 h-full flex flex-col">
        <TopNavbar
          setMenuOpen={setMenuOpen}
          notificationsOpen={notificationsOpen}
          setNotificationsOpen={setNotificationsOpen}
          profileOpen={profileOpen}
          setProfileOpen={setProfileOpen}
          onLogout={onLogout}
        />

        <div className="relative flex-1 overflow-hidden">
          {activeModule === "cadastroProfissional" ? (
            <div className="absolute inset-0 z-10 overflow-hidden bg-black/20">
              <CadastroProfissionalPage companyId={currentCompanyId} />
            </div>
          ) : activeModule === "relatorioEstimativa" ? (
            <div className="absolute inset-0 z-10 overflow-auto bg-black/20">
              <RelatorioEstimativaPage />
            </div>
          ) : activeModule === "gerenciamentoOrdemCorte" ? (
            <div className="absolute inset-0 w-full h-full bg-[#f8fafc] overflow-y-auto">
              <GerenciamentoOrdemCortePage
                 companyId={currentCompanyId}
                 safra={currentSafra}
                 setActiveModule={setActiveModule}
              />
            </div>
          ) : activeModule === "estimativa" ? (
            <>
              {/* O componente de renderização pura do WebGL via Mapbox */}
              <EstimativaMap
                mapRef={mapRef}
                enhancedGeoJson={mapboxGeoJson}
                onMapClick={onMapClick}
                setHoveredTalhao={setHoveredTalhao}
                showLabels={showLabels}
                hoveredTalhao={hoveredTalhao}
                isMultiSelectMode={isMultiSelectMode}
                selectedTalhoes={selectedTalhoes}
                selectedTalhao={selectedTalhao}
                idsAbertosSet={ordensMapState.idsAbertosSet}
                idsOcultosSet={ordensMapState.idsOcultosSet}
                activeMapModule={activeMapModule}
              />

              <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(5,5,5,0.14), rgba(5,5,5,0.08) 20%, rgba(5,5,5,0.18) 100%)" }} />

              {/* Os painéis flutuantes em cima do mapa (Título, Legend, Talhões selecionados) */}
              <EstimativaPanels
                idsOcultosSet={ordensMapState.idsOcultosSet}
                activeMapModule={activeMapModule}
                setActiveMapModule={setActiveMapModule}
                currentRodada={estData.currentRodada}
                setCurrentRodada={estData.setCurrentRodada}
                availableRodadas={estData.availableRodadas}
                createNewRodada={() => estData.createNewRodada(ordensMapState.idsAbertosSet)}
                nextRodadaName={estData.nextRodadaName}
                setFiltersOpen={mapFilters.setFiltersOpen}
                selectedTalhoes={selectedTalhoes}
                selectedTalhao={selectedTalhao}
                setSelectedTalhoes={setSelectedTalhoes}
                setSelectedTalhao={setSelectedTalhao}
                enhancedGeoJson={mapFilters.enhancedGeoJson}
                isLoadingEstimate={estData.isLoadingEstimate}
                currentEstimate={estData.currentEstimate}
                setScope={estData.setScope}
                setEstimateOpen={estData.setEstimateOpen}
                openHistory={estData.openHistory}

                legendCollapsed={mapSummary.legendCollapsed}
                setLegendCollapsed={mapSummary.setLegendCollapsed}
                showLabels={showLabels}
                setShowLabels={setShowLabels}
                legendItems={mapSummary.legendItems}

                summaryCollapsed={mapSummary.summaryCollapsed}
                setSummaryCollapsed={mapSummary.setSummaryCollapsed}
                summaryData={mapSummary.summaryData}

                vinculosSafra={ordensState.vinculosSafra}
                companyId={currentCompanyId}
                safra={currentSafra}
              />
            </>
          ) : (
            <div className="absolute inset-0 z-10 overflow-auto bg-black/20 pb-16">
              <CompanyConfig
                currentCompanyId={currentCompanyId}
                currentSafra={currentSafra}
                geoJsonData={estData.geoJsonData}
                allEstimates={estData.allEstimates}
                refetchEstimates={estData.refetchEstimates}
                onUploadSuccess={(data) => {
                estData.setGeoJsonData(data);
                setActiveModule("estimativa");
              }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
