import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Leaf,
  ShieldCheck,
  BarChart3,
  CloudSun,
  User,
  Lock,
  ChevronRight,
  CheckCircle2,
  ChevronDown,
  Calculator,
  Wheat,
  CalendarRange,
  MapPinned,
  ClipboardList,
  LineChart,
  Menu,
  Bell,
  Settings,
  MousePointerSquareDashed,
  Pencil,
  History,
  X,
  PieChart,
  Palette
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Badge } from "./components/ui/badge";
import CompanyConfig from "./components/CompanyConfig";
import Map, { Source, Layer, Popup } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as turf from "@turf/turf"; // To calculate bounds
import { saveEstimate, getEstimate, getEstimateHistory, getAllEstimates } from "./services/estimativa";
import { fetchLatestGeoJson } from "./services/storage";
import { showSuccess, showError, showConfirm } from "./utils/alert";
import { auth } from "./services/firebase";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";

const palette = {
  bg: "#050505",
  bg2: "#0A0A0A",
  tech: "#0D1B2A",
  tech2: "#1B263B",
  gold: "#D4AF37",
  goldLight: "#E6C76B",
  white: "#FFFFFF",
  text2: "#B0BEC5",
};

function GlowOrb({ className = "", size = 280, delay = 0 }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl opacity-30 ${className}`}
      style={{ width: size, height: size }}
      animate={{ x: [0, 24, -16, 0], y: [0, -20, 14, 0], scale: [1, 1.08, 0.96, 1] }}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay }}
    />
  );
}

function PremiumBadge({ children }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1 text-xs tracking-[0.18em] uppercase"
      style={{
        borderColor: `${palette.gold}55`,
        background: "rgba(212,175,55,0.08)",
        color: palette.goldLight,
      }}
    >
      {children}
    </span>
  );
}


function AnimatedBackground() {
  const lines = [
    { top: "10%", left: "-4%", width: 320 },
    { top: "18%", right: "-3%", width: 280 },
    { top: "72%", left: "-2%", width: 360 },
    { top: "84%", right: "-2%", width: 320 },
    { top: "50%", left: "8%", width: 180 },
    { top: "38%", right: "12%", width: 220 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {lines.map((line, index) => (
        <motion.div
          key={index}
          className="absolute h-px"
          style={{
            ...line,
            background: `linear-gradient(90deg, transparent 0%, ${palette.gold} 25%, ${palette.goldLight} 50%, transparent 100%)`,
            boxShadow: "0 0 10px rgba(212,175,55,0.45)",
          }}
          animate={{ opacity: [0.08, 0.38, 0.12], x: [0, index % 2 === 0 ? 18 : -18, 0] }}
          transition={{ duration: 6 + index, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}

      {[...Array(22)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 2 + (i % 2),
            height: 2 + (i % 2),
            background: i % 5 === 0 ? "rgba(255,255,255,0.7)" : palette.goldLight,
            top: `${8 + ((i * 9) % 84)}%`,
            left: `${4 + ((i * 13) % 92)}%`,
            boxShadow: `0 0 10px ${i % 5 === 0 ? "rgba(255,255,255,0.45)" : "rgba(230,199,107,0.55)"}`,
          }}
          animate={{ opacity: [0.06, 0.75, 0.12], scale: [0.9, 1.35, 1], y: [0, -6, 0] }}
          transition={{ duration: 4 + (i % 5), repeat: Infinity, ease: "easeInOut", delay: i * 0.14 }}
        />
      ))}

      <motion.div
        className="absolute inset-x-0 bottom-[10%] h-24"
        style={{
          background: "radial-gradient(ellipse at center, rgba(212,175,55,0.14), rgba(212,175,55,0.03) 36%, transparent 72%)",
          filter: "blur(12px)",
        }}
        animate={{ opacity: [0.18, 0.36, 0.22], scaleX: [0.98, 1.02, 0.99] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleFirebaseLogin = async () => {
    if (!email || !password) {
      showError("Atenção", "Preencha o e-mail e a senha para entrar.");
      return;
    }

    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // The onAuthStateChanged listener in the main component will trigger the layout shift
    } catch (error) {
      console.error(error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        showError("Acesso Negado", "E-mail ou senha incorretos.");
      } else if (error.code === 'auth/invalid-email') {
        showError("Formato Inválido", "O endereço de e-mail é inválido.");
      } else if (error.code === 'auth/too-many-requests') {
        showError("Bloqueado", "Muitas tentativas sem sucesso. Tente novamente mais tarde.");
      } else {
        showError("Erro no Login", "Não foi possível conectar: " + error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{
        backgroundImage: "url('./assets/login-bg.jpeg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        color: palette.white,
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(135deg, rgba(3,3,3,0.92) 0%, rgba(6,6,6,0.88) 34%, rgba(10,18,28,0.82) 100%)",
        }}
      />

      <AnimatedBackground />
      <GlowOrb className="top-[-60px] right-[-60px] bg-yellow-300/40" size={240} delay={0.2} />
      <GlowOrb className="bottom-[8%] left-[-60px] bg-blue-500/30" size={320} delay={0.8} />
      <GlowOrb className="top-[28%] left-[36%] bg-slate-400/20" size={220} delay={1.4} />

      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
          maskImage: "radial-gradient(circle at center, black 42%, transparent 88%)",
        }}
      />

      <div className="relative z-10 min-h-screen grid lg:grid-cols-2">
        <div className="hidden lg:flex flex-col justify-between p-10 xl:p-14 border-r" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="flex items-center gap-3"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl"
                style={{
                  background: `linear-gradient(135deg, ${palette.gold} 0%, ${palette.goldLight} 100%)`,
                  color: palette.bg,
                }}
              >
                <Leaf className="w-7 h-7" />
              </div>
              <div>
                <div className="text-2xl font-semibold tracking-wide">AgroSystem Modern</div>
                <div className="text-sm" style={{ color: palette.text2 }}>
                  Gestão agrícola com experiência premium
                </div>
              </div>
            </motion.div>
          </div>

          <div className="max-w-xl space-y-6">
            <PremiumBadge>Experiência redesenhada</PremiumBadge>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.15 }}
              className="text-5xl xl:text-6xl font-semibold leading-tight"
            >
              Controle do campo com visual futurista e operação real.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.3 }}
              className="text-lg leading-8"
              style={{ color: palette.text2 }}
            >
              Uma interface moderna inspirada no AgroVetor, com foco em velocidade, clareza de dados, sincronização e produtividade no uso diário.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.45 }}
              className="grid sm:grid-cols-3 gap-4 pt-4"
            >
              {[
                { icon: ShieldCheck, title: "Acesso seguro", desc: "Camada premium" },
                { icon: CloudSun, title: "Ambiente inteligente", desc: "Visual dinâmico" },
                { icon: BarChart3, title: "Dados vivos", desc: "Experiência moderna" },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl p-4 backdrop-blur-md border shadow-xl"
                  style={{
                    background: "rgba(16,18,22,0.52)",
                    borderColor: "rgba(255,255,255,0.08)",
                  }}
                >
                  <item.icon className="w-5 h-5 mb-3" style={{ color: palette.gold }} />
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm mt-1" style={{ color: palette.text2 }}>{item.desc}</div>
                </div>
              ))}
            </motion.div>
          </div>

          <div className="text-sm" style={{ color: "rgba(176,190,197,0.75)" }}>
            UI premium • motion design • login animado
          </div>
        </div>

        <div className="flex items-center justify-center p-6 sm:p-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.75 }}
            className="w-full max-w-md rounded-[28px] border backdrop-blur-2xl shadow-2xl overflow-hidden"
            style={{
              background: "linear-gradient(180deg, rgba(22,24,28,0.78), rgba(18,20,24,0.66))",
              borderColor: "rgba(230,199,107,0.18)",
              boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
            }}
          >
            <div className="p-7 sm:p-8 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <div className="flex items-center justify-between mb-6">
                <PremiumBadge>Login</PremiumBadge>
                <Badge className="rounded-full border px-3 py-1" style={{ background: "rgba(27,38,59,0.75)", borderColor: "rgba(255,255,255,0.08)", color: palette.white }}>
                  vNext
                </Badge>
              </div>
              <h2 className="text-3xl font-semibold">Entrar na plataforma</h2>
              <p className="mt-2 text-sm" style={{ color: palette.text2 }}>
                Acesse o ambiente operacional com uma interface fluida, elegante e pronta para uso.
              </p>
            </div>

            <div className="p-7 sm:p-8 space-y-5">
              <div className="space-y-2">
                <label className="text-sm" style={{ color: palette.text2 }}>E-mail</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2" style={{ color: palette.gold }} />
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11 h-12 rounded-2xl border-0"
                    style={{ background: "rgba(255,255,255,0.06)", color: palette.white }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm" style={{ color: palette.text2 }}>Senha</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2" style={{ color: palette.gold }} />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11 h-12 rounded-2xl border-0"
                    style={{ background: "rgba(255,255,255,0.06)", color: palette.white }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <button
                  onClick={() => setRemember(!remember)}
                  className="flex items-center gap-2 transition-opacity hover:opacity-90"
                  style={{ color: palette.text2 }}
                >
                  <span className="w-4 h-4 rounded border flex items-center justify-center" style={{ borderColor: remember ? palette.gold : "rgba(255,255,255,0.2)", background: remember ? "rgba(212,175,55,0.15)" : "transparent" }}>
                    {remember ? <div className="w-2 h-2 rounded-full" style={{ background: palette.gold }} /> : null}
                  </span>
                  Manter conectado
                </button>
                <button className="hover:underline" style={{ color: palette.goldLight }}>
                  Esqueci a senha
                </button>
              </div>

              <Button
                onClick={handleFirebaseLogin}
                disabled={isLoading}
                className="w-full h-12 rounded-2xl text-base font-medium transition-all hover:scale-[1.01] disabled:opacity-70 disabled:hover:scale-100"
                style={{ background: `linear-gradient(135deg, ${palette.gold} 0%, ${palette.goldLight} 100%)`, color: palette.bg }}
              >
                {isLoading ? "Conectando..." : (
                  <>
                    Entrar agora
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>

              <div className="grid grid-cols-3 gap-3 pt-2">
                {[
                  { icon: Leaf, label: "Campo" },
                  { icon: CloudSun, label: "Clima" },
                  { icon: ShieldCheck, label: "Seguro" },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl p-3 text-center border"
                    style={{ background: "rgba(16,18,22,0.52)", borderColor: "rgba(255,255,255,0.08)" }}
                  >
                    <item.icon className="w-4 h-4 mx-auto mb-2" style={{ color: palette.gold }} />
                    <span className="text-xs" style={{ color: palette.text2 }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function PostLoginScreen({ onLogout }) {
  const MAPBOX_TOKEN = "pk.eyJ1IjoiY2FybG9zaGduIiwiYSI6ImNtZDk0bXVxeTA0MTcyam9sb2h1dDhxaG8ifQ.uf0av4a0WQ9sxM1RcFYT2w";
  const mapRef = React.useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [legendCollapsed, setLegendCollapsed] = useState(true);
  const [summaryCollapsed, setSummaryCollapsed] = useState(true);
  const [summaryData, setSummaryData] = useState({
    talhoes: 0,
    area: 0,
    estimados: 0,
    pendentes: 0,
    toneladas: 0,
  });

  const [estimateOpen, setEstimateOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [selectedTalhao, setSelectedTalhao] = useState(null);
  const [selectedTalhoes, setSelectedTalhoes] = useState([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(true);

  // Default scope depends on selection
  const [scope, setScope] = useState("talhao");
  const [activeModule, setActiveModule] = useState("estimativa"); // "estimativa" | "configuracao"
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [hoveredTalhao, setHoveredTalhao] = useState(null);

  // Estimativa state
  const [currentEstimate, setCurrentEstimate] = useState(null);
  const [estimateHistory, setEstimateHistory] = useState([]);
  const [allEstimates, setAllEstimates] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [formEstimativa, setFormEstimativa] = useState({ area: "", tch: "", toneladas: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingEstimate, setIsLoadingEstimate] = useState(false);

  // Mock company / safra defaults
  const currentCompanyId = "empresa_default";
  const currentSafra = "2026/2027";

  // Fetch GeoJSON and all estimates on load
  const fetchEstimates = async () => {
    const res = await getAllEstimates(currentCompanyId, currentSafra);
    if (res.success) {
      setAllEstimates(res.data);
    }
  };

  React.useEffect(() => {
    async function loadData() {
      const res = await fetchLatestGeoJson(currentCompanyId);
      if (res.error) {
        showError("Erro ao carregar mapa", res.error);
      } else if (res.data) {
        // Assign stable numeric IDs once on load so selections don't break when filtering
        const featuresWithIds = res.data.features.map((f, i) => ({
          ...f,
          id: i,
          properties: {
            ...f.properties,
            featureId: i
          }
        }));
        setGeoJsonData({ ...res.data, features: featuresWithIds });
      } else {
        // No maps found in Storage
        setActiveModule("configuracao");
      }
      await fetchEstimates();
    }
    loadData();
  }, []);

  // Filters state
  const [filters, setFilters] = useState({
    fazenda: "",
    variedade: "",
    corte: "",
    talhao: ""
  });


  // Helper to generate a truly unique talhao ID for Firestore
  const getUniqueTalhaoId = (feature) => {
    if (!feature || !feature.properties) return `mock_invalid_id`;
    const p = feature.properties;
    const f_agr = p.FUNDO_AGR ? String(p.FUNDO_AGR).trim() : "N-A";
    const faz = p.FAZENDA ? String(p.FAZENDA).trim() : "N-A";
    const talhao = p.TALHAO ? String(p.TALHAO).trim() : `mock_${feature.id}`;

    // We append the stable featureId assigned on load.
    // This solves the problem where a shapefile has multiple distinct geometries (split polygons)
    // with the exact same Fundo, Fazenda, and Talhao string values. Without this, estimating
    // one polygon overwrites the other in the database.
    const uniqueIndex = p.featureId !== undefined ? p.featureId : feature.id;
    return `${f_agr}_${faz}_${talhao}_SEQ${uniqueIndex}`.replace(/\//g, '-').replace(/ /g, '_').toUpperCase();
  };

  // Derived filter options based on geoJsonData
  const filterOptions = React.useMemo(() => {
    if (!geoJsonData || !geoJsonData.features) return { fazendas: [], variedades: [], cortes: [], talhoes: [] };

    const fazendasSet = new Set();
    const variedadesSet = new Set();
    const cortesSet = new Set();
    const talhoesSet = new Set();

    geoJsonData.features.forEach(f => {
      const p = f.properties || {};

      // Calculate Fazenda concatenated string
      const f_agr = p.FUNDO_AGR ? String(p.FUNDO_AGR).trim() : "";
      const faz = p.FAZENDA ? String(p.FAZENDA).trim() : "";
      let fazendaName = "";
      if (f_agr && faz) fazendaName = `${f_agr} - ${faz}`;
      else if (faz) fazendaName = faz;
      else if (f_agr) fazendaName = f_agr;

      const variedade = p.VARIEDADE ? String(p.VARIEDADE).trim() : "";
      const corte = p.ECORTE ? String(p.ECORTE).trim() : "";
      const talhao = p.TALHAO ? String(p.TALHAO).trim() : "";

      // Only add to options if it matches current higher-level filters
      let matchesFazenda = true;
      let matchesVariedade = true;
      let matchesCorte = true;

      // Match current temporary filter checks
      if (filters.fazenda && filters.fazenda !== "all" && fazendaName !== filters.fazenda) matchesFazenda = false;
      if (filters.variedade && filters.variedade !== "all" && variedade !== filters.variedade) matchesVariedade = false;
      if (filters.corte && filters.corte !== "all" && corte !== filters.corte) matchesCorte = false;

      // Populate Fazendas (independent)
      if (fazendaName) fazendasSet.add(fazendaName);

      // Populate Variedades (depends on Fazenda)
      if (variedade && matchesFazenda) variedadesSet.add(variedade);

      // Populate Cortes (depends on Fazenda and Variedade)
      if (corte && matchesFazenda && matchesVariedade) cortesSet.add(corte);

      // Populate Talhoes (depends on all above)
      if (talhao && matchesFazenda && matchesVariedade && matchesCorte) talhoesSet.add(talhao);
    });

    // Helper to extract numbers for better sorting
    const naturalSort = (a, b) => {
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    };

    return {
      fazendas: Array.from(fazendasSet).sort(naturalSort),
      variedades: Array.from(variedadesSet).sort(naturalSort),
      cortes: Array.from(cortesSet).sort(naturalSort),
      talhoes: Array.from(talhoesSet).sort(naturalSort),
    };
  }, [geoJsonData, filters.fazenda, filters.variedade, filters.corte]);

  // Applied filters state (to trigger map updates)
  const [appliedFilters, setAppliedFilters] = useState({
    fazenda: "",
    variedade: "",
    corte: "",
    talhao: ""
  });

  const talhoes = [
    { id: "101", nome: "Talhão 101", corte: "1º corte", area: "15,4 ha", variedade: "CTC 20", status: "Estimado", fazenda: "12 - Santa Rita", bg: "rgba(255,225,25,0.88)", color: "#111111", style: { left: "8%", top: "19%", width: "21%", height: "15%" } },
    { id: "102", nome: "Talhão 102", corte: "2º corte", area: "16,8 ha", variedade: "RB966928", status: "Estimado", fazenda: "12 - Santa Rita", bg: "rgba(245,130,49,0.88)", color: "#111111", style: { left: "35%", top: "13%", width: "18%", height: "18%" } },
    { id: "103", nome: "Talhão 103", corte: "3º corte", area: "18,7 ha", variedade: "CTC 4", status: "Sem estimativa", fazenda: "12 - Santa Rita", bg: "rgba(145,30,180,0.88)", color: "#FFFFFF", style: { left: "58%", top: "19%", width: "24%", height: "16%" } },
    { id: "104", nome: "Talhão 104", corte: "4º corte", area: "17,2 ha", variedade: "CTC 9001", status: "Estimado", fazenda: "12 - Santa Rita", bg: "rgba(240,50,230,0.88)", color: "#111111", style: { left: "15%", top: "45%", width: "24%", height: "16%" } },
    { id: "105", nome: "Talhão 105", corte: "5º corte", area: "18,1 ha", variedade: "SP80", status: "Estimado", fazenda: "12 - Santa Rita", bg: "rgba(66,212,244,0.88)", color: "#111111", style: { left: "46%", top: "48%", width: "28%", height: "16%" } },
  ];

  const notifications = [
    { title: "Estimativa pendente", text: "Talhão 103 está sem estimativa para a safra atual." },
    { title: "Filtro aplicado", text: "Mapa centralizado para Fazenda Santa Rita." },
    { title: "Sincronização concluída", text: "Última atualização enviada com sucesso." },
  ];

  const selected = talhoes.find((t) => t.id === selectedTalhao) || talhoes[2];

  // We add an id property to every feature to easily track hover/selection states
  // We also apply filters here
  const enhancedGeoJson = React.useMemo(() => {
    if (!geoJsonData) return null;

    // Filter features based on appliedFilters
    const filteredFeatures = geoJsonData.features.filter(feature => {
      const p = feature.properties || {};

      const f_agr = p.FUNDO_AGR ? String(p.FUNDO_AGR).trim() : "";
      const faz = p.FAZENDA ? String(p.FAZENDA).trim() : "";
      let fazendaName = "";
      if (f_agr && faz) fazendaName = `${f_agr} - ${faz}`;
      else if (faz) fazendaName = faz;
      else if (f_agr) fazendaName = f_agr;

      if (appliedFilters.fazenda && fazendaName !== appliedFilters.fazenda) {
        return false;
      }
      if (appliedFilters.variedade && (!p.VARIEDADE || String(p.VARIEDADE).trim() !== appliedFilters.variedade)) {
        return false;
      }
      if (appliedFilters.corte && (!p.ECORTE || String(p.ECORTE).trim() !== appliedFilters.corte)) {
        return false;
      }
      if (appliedFilters.talhao && (!p.TALHAO || String(p.TALHAO).trim() !== appliedFilters.talhao)) {
        return false;
      }

      return true;
    });

    // Helper to normalize "1 Corte", "1º Corte", "1CORTE", etc. to "1º corte"
    const normalizeCorte = (val) => {
      if (!val) return "Sem estágio";
      const str = String(val).toLowerCase().trim();
      const match = str.match(/(\d+)/); // Find the number
      if (match) {
        return `${match[1]}º corte`;
      }
      return "Sem estágio";
    };

    return {
      ...geoJsonData,
      features: filteredFeatures.map((feature) => {
        const normalizedCorte = normalizeCorte(feature.properties?.ECORTE);
        const uniqueTalhaoId = getUniqueTalhaoId(feature);
        const isEstimated = allEstimates.some(est => est.talhaoId === uniqueTalhaoId);

        return {
          ...feature,
          // Do not mutate id or featureId here as that breaks selection stability
          properties: {
            ...feature.properties,
            // Add a normalized property just for mapbox styling match,
            // without modifying the original ECORTE so the popup still shows the original
            _normalized_ecorte: normalizedCorte,
            _is_estimated: isEstimated
          }
        };
      })
    };
  }, [geoJsonData, appliedFilters, allEstimates]);

  // Calculate dynamic legend items based on current view's present and estimated features
  const legendItems = React.useMemo(() => {
    if (!enhancedGeoJson || !enhancedGeoJson.features) return [];

    const colors = {
      "1º corte": "#ff2d6f",
      "2º corte": "#5ad15a",
      "3º corte": "#f5e11c",
      "4º corte": "#4a7dff",
      "5º corte": "#f58231",
      "6º corte": "#a43cf0",
      "7º corte": "#42d4f4",
      "8º corte": "#e642f4",
      "9º corte": "#c4f35a",
      "10º corte": "#f4a3c1",
      "11º corte": "#6bc5c5",
      "Sem estágio": "#d1d5db"
    };

    const presentStages = new Set();
    enhancedGeoJson.features.forEach(f => {
      // Only show legend for estimated features because those are the only ones getting colored!
      if (f.properties._is_estimated) {
        presentStages.add(f.properties._normalized_ecorte);
      }
    });

    const items = [];
    Array.from(presentStages).forEach(stage => {
      items.push([colors[stage] || "#d1d5db", stage]);
    });

    // Helper to extract numbers for sorting
    const naturalSort = (a, b) => {
      return a[1].localeCompare(b[1], undefined, { numeric: true, sensitivity: 'base' });
    };

    return items.sort(naturalSort);
  }, [enhancedGeoJson]);


  // Effect to calculate summary data based on the enhancedGeoJson (which responds to filters)
  React.useEffect(() => {
    if (!enhancedGeoJson || !enhancedGeoJson.features) return;

    let totalArea = 0;
    let estimadosCount = 0;
    let pendentesCount = 0;
    let totalToneladas = 0;
    const totalTalhoes = enhancedGeoJson.features.length;

    enhancedGeoJson.features.forEach(f => {
      const p = f.properties || {};
      const area = parseFloat(String(p.AREA || 0).replace(',', '.'));
      if (!isNaN(area)) {
        totalArea += area;
      }

      if (p._is_estimated) {
        estimadosCount++;
        const uniqueTalhaoId = getUniqueTalhaoId(f);
        const est = allEstimates.find(e => e.talhaoId === uniqueTalhaoId);
        if (est && est.toneladas) {
          const tons = parseFloat(String(est.toneladas).replace(/\./g, '').replace(',', '.'));
          if (!isNaN(tons)) totalToneladas += tons;
        }
      } else {
        pendentesCount++;
      }
    });

    setSummaryData({
      talhoes: totalTalhoes,
      area: totalArea,
      estimados: estimadosCount,
      pendentes: pendentesCount,
      toneladas: totalToneladas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    });
  }, [enhancedGeoJson, allEstimates]);

  const loadEstimateData = async (feature) => {
    if (!feature || !feature.properties) return;
    setIsLoadingEstimate(true);
    setCurrentEstimate(null);
    setEstimateHistory([]);
    const uniqueTalhaoId = getUniqueTalhaoId(feature);

    // Default form values
    setFormEstimativa({
      area: feature.properties.AREA ? String(feature.properties.AREA) : "",
      tch: "",
      toneladas: ""
    });

    try {
      const res = await getEstimate(currentCompanyId, currentSafra, uniqueTalhaoId);
      if (res.success && res.data) {
        setCurrentEstimate(res.data);
        setFormEstimativa({
          area: res.data.area || feature.properties.AREA || "",
          tch: res.data.tch || "",
          toneladas: res.data.toneladas || ""
        });
      }
    } catch (err) {
      console.error("Failed to load estimate", err);
    } finally {
      setIsLoadingEstimate(false);
    }
  };

  const handleSaveEstimate = async () => {
    setIsSaving(true);
    let successCount = 0;

    try {
      const talhoesToSave = [];
      if (scope === "talhao" && selectedTalhao) {
        talhoesToSave.push(selectedTalhao);
      } else if (scope === "selecionados" && selectedTalhoes.length > 0) {
        // Collect features based on their IDs
        selectedTalhoes.forEach(id => {
          const feat = enhancedGeoJson.features.find(f => f.id === id);
          if (feat) talhoesToSave.push(feat);
        });
      } else if (scope === "filtro" && enhancedGeoJson) {
        talhoesToSave.push(...enhancedGeoJson.features);
      } else if (scope === "fazenda" && geoJsonData) {
        // Simple mock for all farm: just use all geojson data
        talhoesToSave.push(...geoJsonData.features);
      }

      // Save for all selected talhões concurrently
      await Promise.all(talhoesToSave.map(async (feat) => {
        const uniqueTalhaoId = getUniqueTalhaoId(feat);

        // Calculate the relative area vs the form area if multiple talhoes are selected.
        // If single, use the form directly.
        // For multiple, since form shows total, we might need a sophisticated split or assume per-talhão input.
        // But for this demo, calculating proportional could be complex, so we will recalculate TCH * featureArea.
        const featureAreaStr = feat.properties.AREA ? String(feat.properties.AREA).replace(/\./g, '').replace(',', '.') : "0";
        const formAreaStr = String(formEstimativa.area).replace(/\./g, '').replace(',', '.');
        const formTchStr = String(formEstimativa.tch).replace(/\./g, '').replace(',', '.');

        const areaToUse = talhoesToSave.length === 1 ? (parseFloat(formAreaStr) || 0) : parseFloat(featureAreaStr);
        const tchToUse = parseFloat(formTchStr) || 0;
        const toneladasCalcVal = areaToUse * tchToUse;
        const toneladasCalc = toneladasCalcVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const areaToSave = talhoesToSave.length === 1 ? formEstimativa.area : areaToUse.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const res = await saveEstimate(currentCompanyId, currentSafra, uniqueTalhaoId, {
          fundo_agricola: feat.properties.FUNDO_AGR || "N/A",
          fazenda: feat.properties.FAZENDA || "N/A",
          variedade: feat.properties.VARIEDADE || "N/A",
          area: areaToSave,
          tch: formEstimativa.tch,
          toneladas: talhoesToSave.length === 1 ? formEstimativa.toneladas : toneladasCalc,
          responsavel: "Carlos"
        });
        if (res.success) successCount++;
      }));

      showSuccess("Sucesso!", `Estimativa salva com sucesso para ${successCount} talhões!`);
      setEstimateOpen(false);

      // Auto-clear selection after multiple estimates
      if (scope === "selecionados") {
        setSelectedTalhoes([]);
        setSelectedTalhao(null);
      } else {
        // Reload current if one was selected
        if (selectedTalhao && scope === "talhao") {
          loadEstimateData(selectedTalhao);
        }
      }

      // Refresh all estimates
      await fetchEstimates();

    } catch (err) {
      if (err.message && (err.message.includes("permission") || err.message.includes("Missing or insufficient permissions"))) {
        showError("Acesso Negado", "Erro de permissão no Firebase. Por favor, vá ao Console do Firebase > Firestore > Rules e configure para: allow read, write: if true;");
      } else {
        showError("Erro", "Erro ao salvar estimativa: " + err.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Recalculate toneladas whenever tch or area change
  React.useEffect(() => {
    const areaStr = String(formEstimativa.area || "").replace(/\./g, '').replace(',', '.');
    const tchStr = String(formEstimativa.tch || "").replace(/\./g, '').replace(',', '.');

    const area = parseFloat(areaStr) || 0;
    const tch = parseFloat(tchStr) || 0;

    if (area > 0 && tch > 0) {
      const toneladasVal = area * tch;
      const toneladasFormatted = toneladasVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      if (formEstimativa.toneladas !== toneladasFormatted) {
        setFormEstimativa(prev => ({ ...prev, toneladas: toneladasFormatted }));
      }
    } else if (formEstimativa.toneladas !== "") {
      setFormEstimativa(prev => ({ ...prev, toneladas: "" }));
    }
  }, [formEstimativa.area, formEstimativa.tch]);

  // Recalculate totals when scope changes
  React.useEffect(() => {
    if (!estimateOpen) return;

    let totalArea = 0;

    if (scope === "talhao" && selectedTalhao) {
      totalArea = parseFloat(String(selectedTalhao.properties?.AREA || 0).replace(',', '.'));
    } else if (scope === "selecionados") {
      selectedTalhoes.forEach(id => {
        const feat = enhancedGeoJson?.features?.find(f => f.id === id);
        if (feat) {
          totalArea += parseFloat(String(feat.properties?.AREA || 0).replace(',', '.'));
        }
      });
    } else if (scope === "filtro" && enhancedGeoJson) {
      enhancedGeoJson.features.forEach(feat => {
        totalArea += parseFloat(String(feat.properties?.AREA || 0).replace(',', '.'));
      });
    } else if (scope === "fazenda" && geoJsonData) {
      geoJsonData.features.forEach(feat => {
        totalArea += parseFloat(String(feat.properties?.AREA || 0).replace(',', '.'));
      });
    }

    setFormEstimativa(prev => ({ ...prev, area: totalArea ? totalArea.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "" }));
  }, [scope, selectedTalhao, selectedTalhoes, enhancedGeoJson, geoJsonData, estimateOpen]);

  const [showLabels, setShowLabels] = useState(true);

  const openHistory = async () => {
    if (!selectedTalhao) return;
    setHistoryOpen(true);
    const uniqueTalhaoId = getUniqueTalhaoId(selectedTalhao);
    const res = await getEstimateHistory(currentCompanyId, currentSafra, uniqueTalhaoId);
    if (res.success) {
      setEstimateHistory(res.data);
    }
  };

  const onMapClick = (e) => {
    const feature = e.features && e.features[0];
    if (feature && feature.properties) {
      const featureId = feature.properties.featureId;

      setSelectedTalhoes(prev => {
        const newSelection = prev.includes(featureId) ? prev.filter(id => id !== featureId) : [...prev, featureId];

        // Se após clicar, a seleção tiver apenas 1 item, carregue seus dados de estimativa
        if (newSelection.length === 1) {
          const singleFeature = enhancedGeoJson.features.find(f => f.id === newSelection[0]);
          if (singleFeature) {
            setSelectedTalhao(singleFeature);
            loadEstimateData(singleFeature);
          }
        } else if (newSelection.length === 0) {
          setSelectedTalhao(null);
        } else {
          // Quando houver mais de um selecionado, exibimos informações do último clicado apenas no contexto de painel, ou de múltiplos.
          setSelectedTalhao(feature);
          loadEstimateData(feature); // Carrega do ultimo por enquanto
        }

        return newSelection;
      });
      setHoveredTalhao(null);
    } else {
      // Clicked outside any feature
      setSelectedTalhoes([]);
      setSelectedTalhao(null);
    }
  };

  const menuContent = (
    <div className="h-full flex flex-col" style={{ background: "linear-gradient(180deg, rgba(10,10,10,0.98), rgba(13,27,42,0.98))" }}>
      <div className="h-16 px-5 flex items-center border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3 text-white font-semibold text-[18px]">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "rgba(212,175,55,0.14)", color: palette.gold }}>
            <Leaf className="w-5 h-5" />
          </div>
          <span>AgroSystem</span>
        </div>
      </div>
      <div className="p-4 space-y-1 overflow-y-auto">
        <button
          onClick={() => { setActiveModule("estimativa"); setMenuOpen(false); }}
          className="w-full flex items-center gap-4 rounded-2xl px-4 py-3 text-left transition-all"
          style={{
            background: activeModule === "estimativa" ? "rgba(212,175,55,0.12)" : "transparent",
            border: activeModule === "estimativa" ? "1px solid rgba(230,199,107,0.18)" : "1px solid transparent",
            color: activeModule === "estimativa" ? palette.white : palette.text2,
          }}
        >
          <Wheat className="w-5 h-5 shrink-0" style={{ color: activeModule === "estimativa" ? palette.gold : palette.text2 }} />
          <span className="text-[15px] font-medium">Estimativa Safra</span>
        </button>
        <button
          onClick={() => { setActiveModule("configuracao"); setMenuOpen(false); }}
          className="w-full flex items-center gap-4 rounded-2xl px-4 py-3 text-left transition-all"
          style={{
            background: activeModule === "configuracao" ? "rgba(212,175,55,0.12)" : "transparent",
            border: activeModule === "configuracao" ? "1px solid rgba(230,199,107,0.18)" : "1px solid transparent",
            color: activeModule === "configuracao" ? palette.white : palette.text2,
          }}
        >
          <Settings className="w-5 h-5 shrink-0" style={{ color: activeModule === "configuracao" ? palette.gold : palette.text2 }} />
          <span className="text-[15px] font-medium">Configuração da Empresa</span>
        </button>
      </div>
    </div>
  );

  const modalShell = (children) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ background: "rgba(3,7,18,0.55)" }}>
      {children}
    </div>
  );

  React.useEffect(() => {
    if (enhancedGeoJson && enhancedGeoJson.features.length > 0 && mapRef.current) {
      try {
        const [minLng, minLat, maxLng, maxLat] = turf.bbox(enhancedGeoJson);
        mapRef.current.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
          { padding: 40, duration: 1000 }
        );
      } catch (err) {
        console.error("Error calculating bounds from enhancedGeoJson:", err);
      }
    }
  }, [enhancedGeoJson]);

  // Handle mapbox feature state for hover/selection
  React.useEffect(() => {
    if (!mapRef.current || !enhancedGeoJson) return;
    const map = mapRef.current.getMap();

    // Make sure source exists before setting state
    if (!map.getSource('talhoes')) return;

    // Clear all feature states
    enhancedGeoJson.features.forEach(f => {
      map.setFeatureState({ source: 'talhoes', id: f.id }, { hover: false, selected: false });
    });

    if (hoveredTalhao !== null) {
      map.setFeatureState({ source: 'talhoes', id: hoveredTalhao }, { hover: true });
    }

    if (isMultiSelectMode) {
      selectedTalhoes.forEach(id => {
        map.setFeatureState({ source: 'talhoes', id }, { selected: true });
      });
    } else if (selectedTalhao && selectedTalhao.id !== undefined) {
      map.setFeatureState({ source: 'talhoes', id: selectedTalhao.id }, { selected: true });
    }
  }, [hoveredTalhao, selectedTalhao, selectedTalhoes, isMultiSelectMode, enhancedGeoJson]);

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: `linear-gradient(160deg, ${palette.bg2} 0%, ${palette.tech} 60%, ${palette.tech2} 100%)`, color: palette.white }}>
      <AnimatedBackground />
      <GlowOrb className="top-[-70px] right-[-70px] bg-yellow-300/20" size={260} delay={0.2} />
      <GlowOrb className="bottom-[8%] left-[-60px] bg-blue-500/20" size={300} delay={0.8} />

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
              {menuContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {estimateOpen && modalShell(
          <motion.div initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} className="w-full max-w-[920px] rounded-[26px] overflow-hidden border" style={{ background: "#111a2d", borderColor: "rgba(255,255,255,0.12)", boxShadow: "0 10px 30px rgba(0,0,0,0.28)" }}>
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
              <div>
                <h2 className="text-[22px] font-semibold">Nova estimativa</h2>
                <p className="text-sm mt-1" style={{ color: palette.text2 }}>Revise o escopo da estimativa e confirme os dados antes de salvar.</p>
              </div>
              <button className="rounded-xl border px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)" }} onClick={() => setEstimateOpen(false)}>✕</button>
            </div>
            <div className="p-5 max-h-[70vh] overflow-auto space-y-4">
              <div className="grid md:grid-cols-4 gap-3">
                {[
                  ["Fundo agrícola / Fazenda", scope === "talhao" ? ((selectedTalhao?.properties?.FUNDO_AGR && selectedTalhao?.properties?.FAZENDA) ? `${selectedTalhao.properties.FUNDO_AGR} - ${selectedTalhao.properties.FAZENDA}` : selectedTalhao?.properties?.FAZENDA || selectedTalhao?.properties?.FUNDO_AGR || "N/A") : (scope === "selecionados" && selectedTalhoes.length > 0 ? ((enhancedGeoJson.features.find(f => f.id === selectedTalhoes[0])?.properties?.FUNDO_AGR && enhancedGeoJson.features.find(f => f.id === selectedTalhoes[0])?.properties?.FAZENDA) ? `${enhancedGeoJson.features.find(f => f.id === selectedTalhoes[0]).properties.FUNDO_AGR} - ${enhancedGeoJson.features.find(f => f.id === selectedTalhoes[0]).properties.FAZENDA}` : "Múltiplos/Variados") : "Várias")],
                  ["Talhão", scope === "talhao" ? (selectedTalhao?.properties?.TALHAO || "N/A") : (scope === "selecionados" ? `${selectedTalhoes.length} selecionados` : "Múltiplos")],
                  ["Variedade", scope === "talhao" ? (selectedTalhao?.properties?.VARIEDADE || "N/A") : "Várias"],
                  ["Corte / Estágio", scope === "talhao" ? (selectedTalhao?.properties?.ECORTE || "N/A") : "Vários"]
                ].map(([k, v]) => (
                  <div key={k} className="rounded-2xl border p-3" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)" }}>
                    <div className="text-xs" style={{ color: palette.text2 }}>{k}</div>
                    <div className="mt-1 font-semibold truncate">{v}</div>
                  </div>
                ))}
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                <div className="flex flex-col gap-2">
                  <label className="text-xs" style={{ color: palette.text2 }}>Safra</label>
                  <input readOnly value={currentSafra} className="rounded-2xl border px-4 py-3 outline-none opacity-60" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: palette.white }} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs" style={{ color: palette.text2 }}>Data da estimativa</label>
                  <input readOnly value={new Date().toISOString().split('T')[0]} className="rounded-2xl border px-4 py-3 outline-none opacity-60" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: palette.white }} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs" style={{ color: palette.text2 }}>Área (ha)</label>
                  <input value={formEstimativa.area} onChange={(e) => setFormEstimativa({...formEstimativa, area: e.target.value})} className="rounded-2xl border px-4 py-3 outline-none" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: palette.white }} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs" style={{ color: palette.text2 }}>TCH estimado</label>
                  <input value={formEstimativa.tch} onChange={(e) => setFormEstimativa({...formEstimativa, tch: e.target.value})} className="rounded-2xl border px-4 py-3 outline-none" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: palette.white }} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs" style={{ color: palette.text2 }}>Toneladas estimadas</label>
                  <input value={formEstimativa.toneladas} onChange={(e) => setFormEstimativa({...formEstimativa, toneladas: e.target.value})} className="rounded-2xl border px-4 py-3 outline-none" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: palette.white }} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs" style={{ color: palette.text2 }}>Responsável</label>
                  <input readOnly value="Carlos" className="rounded-2xl border px-4 py-3 outline-none opacity-60" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: palette.white }} />
                </div>
              </div>
              <div className="grid md:grid-cols-4 gap-3">
                {[
                  ["talhao", "Talhão atual", "Grava apenas no talhão selecionado."],
                  ["selecionados", "Selecionados", "Usa a seleção múltipla do mapa."],
                  ["filtro", "Filtro atual", "Aplica a todos os talhões no filtro atual."],
                  ["fazenda", "Fazenda inteira", "Aplica aos talhões da fazenda após confirmação."]
                ].map(([key, title, sub]) => (
                  <button
                    key={key}
                    onClick={async () => {
                      if (key === "fazenda" || key === "filtro") {
                        const confirmResult = await showConfirm(
                          "Aplicar em massa",
                          `Tem certeza que deseja aplicar a estimativa para a ${title}? Essa ação impactará vários talhões.`
                        );
                        if (!confirmResult.isConfirmed) {
                          return;
                        }
                      }
                      setScope(key);
                    }}
                    className="text-left rounded-[18px] border p-3 transition-colors"
                    style={{ background: "rgba(255,255,255,0.05)", borderColor: scope === key ? "rgba(245,158,11,0.7)" : "rgba(255,255,255,0.12)", boxShadow: scope === key ? "inset 0 0 0 1px rgba(245,158,11,0.25)" : "none" }}
                  >
                    <div className="font-semibold text-sm">{title}</div>
                    <div className="text-xs mt-1" style={{ color: palette.text2 }}>{sub}</div>
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs" style={{ color: palette.text2 }}>Observação</label>
                <textarea placeholder="Ao salvar, cada reestimativa gera uma nova versão por safra sem apagar o histórico anterior." className="rounded-2xl border px-4 py-3 min-h-[110px] outline-none" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: palette.white }} />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 pb-5">
              <button className="rounded-xl border px-4 py-3 hover:bg-white/5 transition-colors" style={{ borderColor: "rgba(255,255,255,0.12)", background: "transparent" }} onClick={() => setEstimateOpen(false)}>Cancelar</button>
              <button disabled={isSaving} className="rounded-xl px-4 py-3 transition-transform hover:scale-[1.02] disabled:opacity-50" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)", color: "white" }} onClick={handleSaveEstimate}>
                {isSaving ? "Salvando..." : "Salvar estimativa"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {historyOpen && modalShell(
          <motion.div initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} className="w-full max-w-[620px] rounded-[26px] overflow-hidden border" style={{ background: "#111a2d", borderColor: "rgba(255,255,255,0.12)", boxShadow: "0 10px 30px rgba(0,0,0,0.28)" }}>
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
              <div>
                <h2 className="text-[22px] font-semibold">Histórico de Estimativas</h2>
                <p className="text-sm mt-1" style={{ color: palette.text2 }}>Safra {currentSafra}</p>
              </div>
              <button className="rounded-xl border px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)" }} onClick={() => setHistoryOpen(false)}>✕</button>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
              {estimateHistory.length === 0 ? (
                <div className="text-center py-8 text-sm" style={{ color: palette.text2 }}>Nenhum histórico encontrado para esta safra.</div>
              ) : (
                estimateHistory.map((item, idx) => (
                  <div key={idx} className="rounded-2xl border p-4" style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)" }}>
                    <div className="flex justify-between items-center mb-2">
                      <div className="font-semibold text-[15px]">Versão {item.version}</div>
                      <div className="text-xs" style={{ color: palette.text2 }}>{new Date(item.updatedAt?.seconds * 1000).toLocaleString()}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div><span style={{ color: palette.text2 }}>Área:</span> {item.area} ha</div>
                      <div><span style={{ color: palette.text2 }}>TCH:</span> {item.tch}</div>
                      <div><span style={{ color: palette.text2 }}>Toneladas:</span> {item.toneladas}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {filtersOpen && modalShell(
          <motion.div initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} className="w-full max-w-[620px] rounded-[26px] overflow-hidden border" style={{ background: "#111a2d", borderColor: "rgba(255,255,255,0.12)", boxShadow: "0 10px 30px rgba(0,0,0,0.28)" }}>
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
              <div>
                <h2 className="text-[22px] font-semibold">Filtros do mapa</h2>
                <p className="text-sm mt-1" style={{ color: palette.text2 }}>Selecione o fundo agrícola/fazenda, variedade, corte e talhão que deseja visualizar.</p>
              </div>
              <button className="rounded-xl border px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)" }} onClick={() => setFiltersOpen(false)}>✕</button>
            </div>
            <div className="p-5 grid sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs" style={{ color: palette.text2 }}>Fundo agrícola / Fazenda</label>
                <div className="relative">
                  <select
                    value={filters.fazenda}
                    onChange={(e) => setFilters({...filters, fazenda: e.target.value, variedade: "", corte: "", talhao: ""})}
                    className="w-full rounded-2xl border px-4 py-3 outline-none appearance-none"
                    style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: palette.white }}
                  >
                    <option value="" style={{ color: "black" }}>Todas as Fazendas</option>
                    {filterOptions.fazendas.map(f => <option key={f} value={f} style={{ color: "black" }}>{f}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: palette.text2 }} />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs" style={{ color: palette.text2 }}>Variedade</label>
                <div className="relative">
                  <select
                    value={filters.variedade}
                    onChange={(e) => setFilters({...filters, variedade: e.target.value, corte: "", talhao: ""})}
                    className="w-full rounded-2xl border px-4 py-3 outline-none appearance-none"
                    style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: palette.white }}
                  >
                    <option value="" style={{ color: "black" }}>Todas as Variedades</option>
                    {filterOptions.variedades.map(v => <option key={v} value={v} style={{ color: "black" }}>{v}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: palette.text2 }} />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs" style={{ color: palette.text2 }}>Corte / Estágio</label>
                <div className="relative">
                  <select
                    value={filters.corte}
                    onChange={(e) => setFilters({...filters, corte: e.target.value, talhao: ""})}
                    className="w-full rounded-2xl border px-4 py-3 outline-none appearance-none"
                    style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: palette.white }}
                  >
                    <option value="" style={{ color: "black" }}>Todos os Cortes</option>
                    {filterOptions.cortes.map(c => <option key={c} value={c} style={{ color: "black" }}>{c}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: palette.text2 }} />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs" style={{ color: palette.text2 }}>Talhão</label>
                <div className="relative">
                  <select
                    value={filters.talhao}
                    onChange={(e) => setFilters({...filters, talhao: e.target.value})}
                    className="w-full rounded-2xl border px-4 py-3 outline-none appearance-none"
                    style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: palette.white }}
                  >
                    <option value="" style={{ color: "black" }}>Todos os Talhões</option>
                    {filterOptions.talhoes.map(t => <option key={t} value={t} style={{ color: "black" }}>{t}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: palette.text2 }} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 pb-5">
              <button className="rounded-xl border px-4 py-3" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)" }} onClick={() => {
                setFilters({fazenda: "", variedade: "", corte: "", talhao: ""});
                setAppliedFilters({fazenda: "", variedade: "", corte: "", talhao: ""});
                setFiltersOpen(false);
              }}>Limpar</button>
              <button className="rounded-xl px-4 py-3" style={{ background: `linear-gradient(135deg, ${palette.gold} 0%, ${palette.goldLight} 100%)`, color: palette.bg }} onClick={() => {
                setAppliedFilters(filters);
                setFiltersOpen(false);
              }}>Aplicar filtros</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 min-h-screen flex flex-col">
        <div className="sticky top-0 z-30 h-16 border-b flex items-center justify-between px-4 sm:px-6" style={{ background: "rgba(10,10,10,0.82)", borderColor: "rgba(255,255,255,0.08)", backdropFilter: "blur(18px)" }}>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: palette.white }}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-3 text-white font-semibold text-xl">
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: "rgba(212,175,55,0.14)", color: palette.gold }}>
              <Leaf className="w-5 h-5" />
            </div>
            <span>AgroSystem</span>
          </div>

          <div className="flex items-center gap-3 relative">
            <div className="relative">
              <button
                onClick={() => {
                  setNotificationsOpen((v) => !v);
                  setProfileOpen(false);
                }}
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: palette.white }}
              >
                <Bell className="w-5 h-5" />
              </button>
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: "#ef4444", color: "white" }}>3</span>
              <AnimatePresence>
                {notificationsOpen && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute right-0 mt-3 w-[320px] rounded-3xl border overflow-hidden" style={{ background: "rgba(14,16,20,0.96)", borderColor: "rgba(255,255,255,0.08)", boxShadow: "0 20px 40px rgba(0,0,0,0.35)" }}>
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
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: palette.white }}
              >
                <User className="w-5 h-5" />
              </button>
              <AnimatePresence>
                {profileOpen && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute right-0 mt-3 w-[260px] rounded-3xl border overflow-hidden" style={{ background: "rgba(14,16,20,0.96)", borderColor: "rgba(255,255,255,0.08)", boxShadow: "0 20px 40px rgba(0,0,0,0.35)" }}>
                    <div className="p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                      <div className="font-semibold">Carlos Henrique</div>
                      <div className="text-sm mt-1" style={{ color: palette.text2 }}>Administrador • Operações Agrícolas</div>
                    </div>
                    <div className="p-3 space-y-2">
                      <button className="w-full text-left rounded-2xl px-3 py-3" style={{ background: "rgba(255,255,255,0.04)" }}>Meu perfil</button>
                      <button className="w-full text-left rounded-2xl px-3 py-3" style={{ background: "rgba(255,255,255,0.04)" }}>Configurações</button>
                      <button className="w-full text-left rounded-2xl px-3 py-3" style={{ background: "rgba(255,255,255,0.04)" }} onClick={onLogout}>Sair</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="relative flex-1 min-h-[calc(100vh-64px)] overflow-hidden">
          {activeModule === "estimativa" ? (
            <>
              <div className="absolute inset-0 w-full h-full" style={{ filter: "saturate(0.95) contrast(1.02) brightness(0.88)" }}>
                <Map
                  ref={mapRef}
                  mapboxAccessToken={MAPBOX_TOKEN}
                  initialViewState={{
                    longitude: -49.35,
                    latitude: -18.25,
                    zoom: 8.4
                  }}
                  style={{ width: "100%", height: "100%" }}
                  mapStyle="mapbox://styles/mapbox/satellite-v9"
                  attributionControl={false}
                  onClick={onMapClick}
                  interactiveLayerIds={['talhoes-fill']}
                  onMouseMove={(e) => {
                    if (e.features && e.features.length > 0) {
                      setHoveredTalhao(e.features[0].id);
                    } else {
                      setHoveredTalhao(null);
                    }
                  }}
                  onMouseLeave={() => setHoveredTalhao(null)}
                >
                  {enhancedGeoJson && (
                    <Source id="talhoes" type="geojson" data={enhancedGeoJson}>
                      <Layer
                        id="talhoes-fill"
                        type="fill"
                        paint={{
                          "fill-color": [
                            "case",
                            ["boolean", ["feature-state", "selected"], false],
                            "#eab308", // Bright yellow marking color for selected talhoes (not blue)
                            ["boolean", ["feature-state", "hover"], false],
                            palette.goldLight,
                            ["boolean", ["get", "_is_estimated"], false],
                            [
                              "match",
                              ["get", "_normalized_ecorte"],
                              "1º corte", "#ff2d6f",
                              "2º corte", "#5ad15a",
                              "3º corte", "#f5e11c",
                              "4º corte", "#4a7dff",
                              "5º corte", "#f58231",
                              "6º corte", "#a43cf0",
                              "7º corte", "#42d4f4",
                              "8º corte", "#e642f4",
                              "9º corte", "#c4f35a",
                              "10º corte", "#f4a3c1",
                              "11º corte", "#6bc5c5",
                              "#d1d5db" // Default (Sem estágio)
                            ],
                            "transparent" // Unestimated polygons have no fill color
                          ],
                          "fill-opacity": [
                            "case",
                            ["boolean", ["feature-state", "selected"], false],
                            1.0,
                            ["boolean", ["feature-state", "hover"], false],
                            0.95,
                            ["boolean", ["get", "_is_estimated"], false],
                            0.85,
                            0 // Transparent if not estimated and not selected/hovered
                          ]
                        }}
                      />
                      <Layer
                        id="talhoes-outline"
                        type="line"
                        paint={{
                          "line-color": [
                            "case",
                            ["boolean", ["feature-state", "selected"], false],
                            "#000000", // Strong black border for selected
                            palette.white
                          ],
                          "line-opacity": [
                            "case",
                            ["boolean", ["feature-state", "selected"], false],
                            1.0,
                            0.5
                          ],
                          "line-width": [
                            "case",
                            ["boolean", ["feature-state", "selected"], false],
                            6, // Thicker border for selected
                            1.5
                          ]
                        }}
                      />
                      {showLabels && (
                        <Layer
                          id="talhoes-labels"
                          type="symbol"
                          layout={{
                            "text-field": ["get", "TALHAO"],
                            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
                            "text-size": 12,
                            "text-anchor": "center",
                            "text-allow-overlap": false
                          }}
                          paint={{
                            "text-color": "#ffffff",
                            "text-halo-color": "#000000",
                            "text-halo-width": 1.5
                          }}
                        />
                      )}
                    </Source>
                  )}
                </Map>
              </div>
              <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(5,5,5,0.14), rgba(5,5,5,0.08) 20%, rgba(5,5,5,0.18) 100%)" }} />

              <div className="absolute top-4 left-4 w-[400px] rounded-[22px] border overflow-hidden z-10" style={{ background: "rgba(17,24,39,0.88)", borderColor: "rgba(255,255,255,0.10)", boxShadow: "0 10px 30px rgba(0,0,0,0.24)", backdropFilter: "blur(16px)" }}>
                <div className="p-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[18px] font-bold leading-tight">Estimativa<br/>Safra</div>
                    <div className="mt-3 inline-flex rounded-full px-3 py-1 text-xs font-medium" style={{ background: "rgba(255,255,255,0.10)", color: "#dbe4ec" }}>Sem filtros</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }} onClick={() => setFiltersOpen(true)}>
                      <ChevronDown className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tap Info Panel */}
              {selectedTalhoes.length > 0 && (
                <div className="absolute right-4 top-4 w-[340px] rounded-3xl border overflow-hidden z-20 shadow-2xl flex flex-col" style={{ background: "rgba(23, 29, 43, 0.95)", borderColor: "rgba(255,255,255,0.08)", backdropFilter: "blur(16px)" }}>
                  <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                    <div>
                      <div className="text-[11px] uppercase font-bold tracking-[0.08em]" style={{ color: palette.text2 }}>{selectedTalhoes.length > 1 ? "TALHÕES" : "TALHÃO"}</div>
                      <div className="text-[20px] font-bold mt-1 text-white">{selectedTalhoes.length > 1 ? `${selectedTalhoes.length} Selecionados` : (selectedTalhao?.properties?.TALHAO || "N/A")}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="px-3 py-1.5 rounded-full text-xs font-medium border" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.12)", color: palette.text2 }} onClick={() => setSelectedTalhoes([])}>Limpar</button>
                      <button onClick={() => setSelectedTalhoes([])} className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
                        <X className="w-4 h-4 text-white/60" />
                      </button>
                    </div>
                  </div>

                  <div className="p-4 grid grid-cols-2 gap-3 overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
                    {[
                      { label: "Fazenda", value: selectedTalhoes.length > 1 ? "Múltiplas" : (selectedTalhao?.properties?.FAZENDA || "N/A") },
                      { label: "Variedade", value: selectedTalhoes.length > 1 ? "Múltiplas" : (selectedTalhao?.properties?.VARIEDADE || "N/A") },
                      { label: "Estágio", value: selectedTalhoes.length > 1 ? "Múltiplos" : (selectedTalhao?.properties?.ECORTE || "N/A") },
                      { label: "Área Total", value: (() => {
                          let totalArea = 0;
                          selectedTalhoes.forEach(id => {
                            const feat = enhancedGeoJson?.features?.find(f => f.id === id);
                            if (feat) {
                              totalArea += parseFloat(String(feat.properties?.AREA || 0).replace(',', '.'));
                            }
                          });
                          return `${totalArea.toFixed(2).replace('.', ',')} ha`;
                        })()
                      },
                      { label: "Status", value: selectedTalhoes.length > 1 ? "-" : (isLoadingEstimate ? "Carregando..." : (currentEstimate ? "Estimado" : "Pendente")) },
                      { label: "Última estimativa", value: selectedTalhoes.length > 1 ? "-" : (isLoadingEstimate ? "..." : (currentEstimate ? `${currentEstimate.toneladas} ton` : "Não estimado")) },
                    ].map((item, idx) => (
                      <div key={idx} className="rounded-2xl p-3 flex flex-col justify-center" style={{ background: "rgba(31, 38, 53, 0.7)" }}>
                        <span className="text-xs mb-1" style={{ color: palette.text2 }}>{item.label}</span>
                        <span className="text-sm font-bold text-white break-words">{item.value}</span>
                      </div>
                    ))}

                    <div className="col-span-2 grid grid-cols-2 gap-3 mt-2">
                      <button
                        className="rounded-2xl py-3 flex items-center justify-center gap-2 font-semibold text-[15px] transition-transform hover:scale-[1.02]"
                        style={{ background: "#22c55e", color: "#ffffff" }}
                        onClick={() => {
                          if (selectedTalhoes.length > 1) {
                            setScope("selecionados");
                          } else {
                            setScope("talhao");
                          }
                          setEstimateOpen(true);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                        {(() => {
                           let hasEstimated = false;
                           selectedTalhoes.forEach(id => {
                              const feat = enhancedGeoJson?.features?.find(f => f.id === id);
                              if (feat && feat.properties?._is_estimated) hasEstimated = true;
                           });
                           return hasEstimated ? "Reestimar" : "Estimar";
                        })()}
                      </button>
                      <button
                        onClick={openHistory}
                        disabled={selectedTalhoes.length > 1}
                        className="rounded-2xl py-3 flex items-center justify-center gap-2 font-semibold text-[15px] transition-transform hover:scale-[1.02] border disabled:opacity-50"
                        style={{ background: "rgba(31, 38, 53, 0.7)", borderColor: "rgba(255,255,255,0.08)", color: "#ffffff" }}
                      >
                        <History className="w-4 h-4" />
                        Histórico
                      </button>
                    </div>

                    <div className="col-span-2 mt-1">
                      <button
                        className="w-full rounded-2xl py-3 flex items-center justify-center gap-2 font-semibold text-[15px] border transition-colors hover:bg-white/5"
                        style={{ background: "transparent", borderColor: "rgba(255,255,255,0.12)", color: "#ffffff" }}
                        onClick={() => { setSelectedTalhao(null); setSelectedTalhoes([]); }}
                      >
                        <X className="w-4 h-4" />
                        Limpar seleção
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="absolute left-4 bottom-4 z-20 flex flex-col gap-3">
                {!legendCollapsed ? (
                  <div className="w-[250px] rounded-[22px] border overflow-hidden" style={{ background: "rgba(17,24,39,0.88)", borderColor: "rgba(255,255,255,0.10)", boxShadow: "0 10px 30px rgba(0,0,0,0.24)", backdropFilter: "blur(16px)" }}>
                    <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                      <div className="font-bold text-[15px]">Estágios de corte</div>
                      <div className="flex gap-2">
                        <button className="rounded-xl px-2 py-1 text-xs font-medium" style={{ background: "rgba(255,255,255,0.08)" }} onClick={() => setShowLabels(!showLabels)}>{showLabels ? "Ocultar nomes" : "Exibir nomes"}</button>
                        <button className="rounded-xl px-2 py-1 text-xs font-medium" style={{ background: "rgba(255,255,255,0.08)" }} onClick={() => setLegendCollapsed(true)}>Recolher</button>
                      </div>
                    </div>
                    <div className="px-4 pb-4 text-sm space-y-2 max-h-[40vh] overflow-y-auto">
                      {legendItems.length > 0 ? (
                        legendItems.map(([color, label]) => (
                          <div key={label} className="grid grid-cols-[16px_1fr] gap-3 items-center">
                            <span className="w-4 h-4 rounded-md" style={{ background: color }} />
                            <span>{label}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs" style={{ color: palette.text2 }}>
                          Nenhum talhão estimado na visualização atual.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <button className="w-[52px] h-[52px] rounded-full flex items-center justify-center transition-transform hover:scale-105" style={{ background: "#0c1527", border: "1px solid rgba(255,255,255,0.12)", color: palette.white, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }} onClick={() => setLegendCollapsed(false)}>
                    <Palette className="w-6 h-6 opacity-90" />
                  </button>
                )}

                {!summaryCollapsed ? (
                  <div className="w-[420px] rounded-[22px] border overflow-hidden" style={{ background: "rgba(17,24,39,0.88)", borderColor: "rgba(255,255,255,0.10)", boxShadow: "0 10px 30px rgba(0,0,0,0.24)", backdropFilter: "blur(16px)" }}>
                    <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                      <div>
                        <div className="text-[11px] uppercase font-bold tracking-[0.08em]" style={{ color: "#c6d1dc" }}>Resumo</div>
                        <div className="text-[17px] font-bold mt-1">{summaryData.talhoes} talhões • {summaryData.area.toFixed(2).replace('.', ',')} ha</div>
                      </div>
                      <button className="rounded-xl px-3 py-2 text-sm font-medium" style={{ background: "rgba(255,255,255,0.08)" }} onClick={() => setSummaryCollapsed(true)}>Recolher</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 p-4 pt-2">
                      {[
                        ["Talhões", String(summaryData.talhoes)],
                        ["Área filtrada", `${summaryData.area.toFixed(2).replace('.', ',')} ha`],
                        ["Estimados", String(summaryData.estimados)],
                        ["Pendentes", String(summaryData.pendentes)],
                        ["Toneladas", String(summaryData.toneladas)]
                      ].map(([k, v]) => (
                        <div key={k} className="rounded-[16px] border p-4" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)" }}>
                          <div className="text-[11px] uppercase font-semibold" style={{ color: "#aebccb" }}>{k}</div>
                          <div className="mt-2 text-[17px] font-bold">{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <button className="w-[52px] h-[52px] rounded-full flex items-center justify-center transition-transform hover:scale-105" style={{ background: "#0c1527", border: "1px solid rgba(255,255,255,0.12)", color: palette.white, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }} onClick={() => setSummaryCollapsed(false)}>
                    <PieChart className="w-6 h-6 opacity-90" />
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="absolute inset-0 z-10 overflow-auto bg-black/20 pb-16">
              <CompanyConfig onUploadSuccess={(data) => {
                setGeoJsonData(data);
                setActiveModule("estimativa");
              }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AgroSystemModernUI() {
  const [logged, setLogged] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setLogged(!!user);
      setIsInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erro ao sair", error);
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: palette.bg, color: palette.gold }}>
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Leaf className="w-12 h-12" />
          <div className="text-xl font-semibold">AgroSystem</div>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {logged ? (
        <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <PostLoginScreen onLogout={handleLogout} />
        </motion.div>
      ) : (
        <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <LoginScreen />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
