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
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Badge } from "./components/ui/badge";
import CompanyConfig from "./components/CompanyConfig";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";

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
  const [email, setEmail] = useState("admin@agrovetor.app");
  const [password, setPassword] = useState("123456");
  const [remember, setRemember] = useState(true);

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
                onClick={onLogin}
                className="w-full h-12 rounded-2xl text-base font-medium transition-all hover:scale-[1.01]"
                style={{ background: `linear-gradient(135deg, ${palette.gold} 0%, ${palette.goldLight} 100%)`, color: palette.bg }}
              >
                Entrar agora
                <ChevronRight className="w-4 h-4 ml-2" />
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [scope, setScope] = useState("talhao");
  const [selectedTalhao, setSelectedTalhao] = useState("103");
  const [activeModule, setActiveModule] = useState("estimativa"); // "estimativa" | "configuracao"
  const [geoJsonData, setGeoJsonData] = useState(null);

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
                {[["Fundo agrícola / Fazenda", selected.fazenda],["Talhão", selected.nome],["Variedade", selected.variedade],["Corte / Estágio", selected.corte]].map(([k, v]) => (
                  <div key={k} className="rounded-2xl border p-3" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)" }}>
                    <div className="text-xs" style={{ color: palette.text2 }}>{k}</div>
                    <div className="mt-1 font-semibold">{v}</div>
                  </div>
                ))}
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                {[["Safra", "2026/2027"],["Data da estimativa", "2026-03-18"],["Área (ha)", selected.area.replace(" ha", "")],["TCH estimado", "82,50"],["Toneladas estimadas", "1542,75"],["Responsável", "Carlos"]].map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-2">
                    <label className="text-xs" style={{ color: palette.text2 }}>{label}</label>
                    <input defaultValue={value} className="rounded-2xl border px-4 py-3 outline-none" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: palette.white }} />
                  </div>
                ))}
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                {[["talhao", "Talhão atual", "Grava apenas no talhão selecionado."],["selecionados", "Talhões selecionados", "Usa a seleção múltipla do mapa."],["fazenda", "Fazenda inteira", "Aplica aos talhões da fazenda após confirmação."]].map(([key, title, sub]) => (
                  <button key={key} onClick={() => setScope(key)} className="text-left rounded-[18px] border p-3" style={{ background: "rgba(255,255,255,0.05)", borderColor: scope === key ? "rgba(245,158,11,0.7)" : "rgba(255,255,255,0.12)", boxShadow: scope === key ? "inset 0 0 0 1px rgba(245,158,11,0.25)" : "none" }}>
                    <div className="font-semibold text-sm">{title}</div>
                    <div className="text-xs mt-1" style={{ color: palette.text2 }}>{sub}</div>
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs" style={{ color: palette.text2 }}>Observação</label>
                <textarea defaultValue="Ao salvar, cada reestimativa gera uma nova versão por safra sem apagar o histórico anterior." className="rounded-2xl border px-4 py-3 min-h-[110px] outline-none" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: palette.white }} />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 pb-5">
              <button className="rounded-xl border px-4 py-3" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)" }} onClick={() => setEstimateOpen(false)}>Cancelar</button>
              <button className="rounded-xl px-4 py-3" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)", color: "white" }} onClick={() => setEstimateOpen(false)}>Salvar estimativa</button>
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
              {[["Fundo agrícola / Fazenda", "12 - Santa Rita"],["Variedade", selected.variedade],["Corte / Estágio", "Todos"],["Talhão", selected.nome]].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-2">
                  <label className="text-xs" style={{ color: palette.text2 }}>{label}</label>
                  <input defaultValue={value} className="rounded-2xl border px-4 py-3 outline-none" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: palette.white }} />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 px-5 pb-5">
              <button className="rounded-xl border px-4 py-3" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)" }} onClick={() => setFiltersOpen(false)}>Limpar</button>
              <button className="rounded-xl px-4 py-3" style={{ background: `linear-gradient(135deg, ${palette.gold} 0%, ${palette.goldLight} 100%)`, color: palette.bg }} onClick={() => setFiltersOpen(false)}>Aplicar filtros</button>
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
                <MapContainer center={[-18.25, -49.35]} zoom={8.4} style={{ height: "100%", width: "100%" }} zoomControl={false}>
                  <TileLayer
                    url={`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`}
                    attribution='Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery &copy; <a href="https://www.mapbox.com/">Mapbox</a>'
                  />
                  {geoJsonData && (
                    <GeoJSON
                      data={geoJsonData}
                      style={() => ({
                        color: palette.gold,
                        weight: 2,
                        fillColor: palette.goldLight,
                        fillOpacity: 0.3,
                      })}
                    />
                  )}
                </MapContainer>
              </div>
              <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(5,5,5,0.14), rgba(5,5,5,0.08) 20%, rgba(5,5,5,0.18) 100%)" }} />

              {/* Balões/cards flutuantes de talhões fictícios removidos.
                  O mapa está preparado para receber overlays reais em GeoJSON. */}

              <div className="absolute top-4 left-4 w-[400px] rounded-[22px] border overflow-hidden" style={{ background: "rgba(17,24,39,0.88)", borderColor: "rgba(255,255,255,0.10)", boxShadow: "0 10px 30px rgba(0,0,0,0.24)", backdropFilter: "blur(16px)" }}>
                <div className="p-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[18px] font-bold leading-tight">Estimativa<br/>Safra</div>
                    <div className="mt-3 inline-flex rounded-full px-3 py-1 text-xs font-medium" style={{ background: "rgba(255,255,255,0.10)", color: "#dbe4ec" }}>Sem filtros</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }} onClick={() => setFiltersOpen(true)}><ChevronDown className="w-5 h-5" /></button>
                    <button className="rounded-xl px-4 py-3 font-semibold" style={{ background: `linear-gradient(135deg, ${palette.gold} 0%, ${palette.goldLight} 100%)`, color: palette.bg }}>Centralizar</button>
                  </div>
                </div>
              </div>

              {!summaryCollapsed ? (
                <div className="absolute left-4 bottom-4 w-[420px] rounded-[22px] border overflow-hidden" style={{ background: "rgba(17,24,39,0.88)", borderColor: "rgba(255,255,255,0.10)", boxShadow: "0 10px 30px rgba(0,0,0,0.24)", backdropFilter: "blur(16px)" }}>
                  <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] uppercase font-bold tracking-[0.08em]" style={{ color: "#c6d1dc" }}>Resumo</div>
                      <div className="text-[17px] font-bold mt-1">2993 talhões • 37894,5 ha</div>
                    </div>
                    <button className="rounded-xl px-3 py-2 text-sm font-medium" style={{ background: "rgba(255,255,255,0.08)" }} onClick={() => setSummaryCollapsed(true)}>Recolher</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 p-4 pt-2">
                    {[["Talhões", "2993"],["Área filtrada", "37894,5 ha"],["Estimados", "0"],["Pendentes", "2993"],["Toneladas", "0"]].map(([k, v]) => (
                      <div key={k} className="rounded-[16px] border p-4" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)" }}>
                        <div className="text-[11px] uppercase font-semibold" style={{ color: "#aebccb" }}>{k}</div>
                        <div className="mt-2 text-[17px] font-bold">{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <button className="absolute left-4 bottom-4 w-[52px] h-[52px] rounded-full text-[22px] flex items-center justify-center" style={{ background: "rgba(17,24,39,0.92)", border: "1px solid rgba(255,255,255,0.12)" }} onClick={() => setSummaryCollapsed(false)}>📊</button>
              )}

              {!legendCollapsed ? (
                <div className="absolute right-4 top-[130px] w-[250px] rounded-[22px] border overflow-hidden" style={{ background: "rgba(17,24,39,0.88)", borderColor: "rgba(255,255,255,0.10)", boxShadow: "0 10px 30px rgba(0,0,0,0.24)", backdropFilter: "blur(16px)" }}>
                  <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                    <div className="font-bold text-[15px]">Estágios de corte</div>
                    <div className="flex gap-2">
                      <button className="rounded-xl px-2 py-1 text-xs font-medium" style={{ background: "rgba(255,255,255,0.08)" }}>Ocultar nomes</button>
                      <button className="rounded-xl px-2 py-1 text-xs font-medium" style={{ background: "rgba(255,255,255,0.08)" }} onClick={() => setLegendCollapsed(true)}>Recolher</button>
                    </div>
                  </div>
                  <div className="px-4 pb-4 text-sm space-y-2">
                    {[["#ff2d6f", "1º corte"],["#5ad15a", "2º corte"],["#f5e11c", "3º corte"],["#4a7dff", "4º corte"],["#f58231", "5º corte"],["#a43cf0", "6º corte"],["#42d4f4", "7º corte"],["#e642f4", "8º corte"],["#c4f35a", "9º corte"],["#f4a3c1", "10º corte"],["#6bc5c5", "11º corte"],["#d1d5db", "Sem estágio"]].map(([color, label]) => (
                      <div key={label} className="grid grid-cols-[16px_1fr] gap-3 items-center">
                        <span className="w-4 h-4 rounded-md" style={{ background: color }} />
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <button className="absolute right-4 top-[130px] w-[52px] h-[52px] rounded-full text-[22px] flex items-center justify-center" style={{ background: "rgba(17,24,39,0.92)", border: "1px solid rgba(255,255,255,0.12)" }} onClick={() => setLegendCollapsed(false)}>🎨</button>
              )}
            </>
          ) : (
            <div className="absolute inset-0 z-10 overflow-auto bg-black/20 pb-16">
              <CompanyConfig />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AgroSystemModernUI() {
  const [logged, setLogged] = useState(false);

  return (
    <AnimatePresence mode="wait">
      {logged ? (
        <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <PostLoginScreen onLogout={() => setLogged(false)} />
        </motion.div>
      ) : (
        <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <LoginScreen onLogin={() => setLogged(true)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
