import React, { useState, useRef } from "react";
import { UploadCloud, CheckCircle2, AlertCircle, File, Loader2, Map, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { getUniqueTalhaoId } from "../utils/geoHelpers";
import { saveEstimate } from "../services/estimativa";
import { parseBrazilianFloat } from "../utils/formatters";
import { importShapefile, validateShapefileSet } from "../services/shpImport";
import { doc, updateDoc } from "firebase/firestore";
import { firestore as db } from "../services/firebase";
import { useCompanyConfig } from "../contexts/ConfigContext";
import { Palette, DatabaseZap } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export default function CompanyConfig({ onUploadSuccess, currentCompanyId, currentSafra, geoJsonData, allEstimates, refetchEstimates }) {
  const { user } = useAuth();
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState("idle"); // idle, processing, success, error
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef(null);
  const fileInputRefEst = useRef(null);
  const [estFile, setEstFile] = useState(null);
  const [estStatus, setEstStatus] = useState("idle");
  const [estErrorMessage, setEstErrorMessage] = useState("");
  const [estProgress, setEstProgress] = useState({ current: 0, total: 0 });
  const { logoColor } = useCompanyConfig();
  const [localColor, setLocalColor] = useState(logoColor || "#55AB52");
  const [colorStatus, setColorStatus] = useState("idle");
  const [migrationStatus, setMigrationStatus] = useState("idle");

  const handleSaveColor = async () => {
    setColorStatus("processing");
    try {
      const companyRef = doc(db, "empresas", currentCompanyId);
      await updateDoc(companyRef, { logoColor: localColor });
      setColorStatus("success");
      setTimeout(() => setColorStatus("idle"), 3000);
    } catch (err) {
      console.error(err);
      setColorStatus("error");
      setTimeout(() => setColorStatus("idle"), 3000);
    }
  };

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

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      setStatus("idle");
      setErrorMessage("");
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      setFiles(Array.from(e.dataTransfer.files));
      setStatus("idle");
      setErrorMessage("");
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setStatus("processing");
    setErrorMessage("");

    try {
      validateShapefileSet(files);

      const result = await importShapefile(files);
      if (result.success) {
        setStatus("success");
        if (onUploadSuccess) {
          onUploadSuccess(result.geoJson);
        }
      } else {
        setStatus("error");
        setErrorMessage(result.error);
      }
    } catch (err) {
      setStatus("error");
      setErrorMessage(err.message || "Erro durante o processamento do shapefile.");
    }
  };


  const handleEstFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setEstFile(e.target.files[0]);
      setEstStatus("idle");
      setEstErrorMessage("");
      setEstProgress({ current: 0, total: 0 });
    }
  };

  const removeEstFile = () => {
    setEstFile(null);
    setEstStatus("idle");
    setEstErrorMessage("");
    setEstProgress({ current: 0, total: 0 });
  };

  const handleEstUpload = async () => {
    if (!estFile) return;
    if (!geoJsonData || !geoJsonData.features || geoJsonData.features.length === 0) {
      setEstStatus("error");
      setEstErrorMessage("Nenhum mapa (Shapefile) encontrado. Importe o mapa primeiro para poder cruzar as áreas.");
      return;
    }

    setEstStatus("processing");
    setEstErrorMessage("");

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

          if (json.length === 0) {
            throw new Error("A planilha está vazia.");
          }

          // Encontra os nomes das colunas de forma flexível (ignorando case)
          const firstRow = json[0];
          const keys = Object.keys(firstRow);

          let fundoCol = keys.find(k => k.toLowerCase().includes("fundo"));
          let talhaoCol = keys.find(k => k.toLowerCase().includes("talh"));
          let tchCol = keys.find(k => k.toLowerCase().includes("tch"));

          if (!fundoCol || !talhaoCol || !tchCol) {
            throw new Error("A planilha deve conter as colunas: FUNDO_AGRICOLA, TALHAO e TCH.");
          }

          const missingLines = [];
          const linesToSave = [];
          const estimatedTalhaoIds = new Set((allEstimates || []).map(est => est.talhaoId));

          for (let i = 0; i < json.length; i++) {
            const row = json[i];
            const fundo = String(row[fundoCol] || "").trim().toUpperCase();
            const talhao = String(row[talhaoCol] || "").trim().toUpperCase();
            const tchStr = String(row[tchCol] || "").trim();
            const tch = parseBrazilianFloat(tchStr);

            if (!fundo || !talhao || isNaN(tch) || tch <= 0) continue;

            // Encontrar no geoJsonData
            let foundFeatures = geoJsonData.features.filter(f => {
              const fAgr = String(f.properties?.FUNDO_AGR || "").trim().toUpperCase();
              const fTalhao = String(f.properties?.TALHAO || "").trim().toUpperCase();
              // Como pode haver variações de nome de fundo (ex: "FUNDO 1" vs "FUNDO_1"), fazemos um include simples ou match exato
              return fAgr === fundo && fTalhao === talhao;
            });

            // Fallback de busca mais relaxada se não encontrar exato
            if (foundFeatures.length === 0) {
               foundFeatures = geoJsonData.features.filter(f => {
                  const fAgr = String(f.properties?.FUNDO_AGR || "").trim().toUpperCase();
                  const fTalhao = String(f.properties?.TALHAO || "").trim().toUpperCase();
                  // Tenta achar com replaces de espaço
                  return fAgr.replace(/\s+/g, '') === fundo.replace(/\s+/g, '') &&
                         fTalhao.replace(/^0+/, '') === talhao.replace(/^0+/, '');
               });
            }

            if (foundFeatures.length > 0) {
              // Pegamos a primeira feature correspondente. Em caso de multipoligonos, o usuário
              // pode ter que consolidar. Mas vamos associar a todas as parts do talhão se houver mais de uma
              for (const feat of foundFeatures) {
                const uniqueTalhaoId = getUniqueTalhaoId(feat);

                // Ignorar se já existe estimativa salva pra esse talhão nesta rodada (Estimativa)
                if (estimatedTalhaoIds.has(uniqueTalhaoId)) continue;

                const area = parseBrazilianFloat(feat.properties?.AREA || "0");
                const toneladas = area * tch;

                linesToSave.push({
                   uniqueTalhaoId,
                   payload: {
                      fundo_agricola: feat.properties?.FUNDO_AGR || fundo,
                      fazenda: feat.properties?.FAZENDA || "N/A",
                      variedade: feat.properties?.VARIEDADE || "N/A",
                      area: area.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                      tch: tchStr,
                      toneladas: toneladas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                      responsavel: "Importação",
                      rodada: "Estimativa"
                   }
                });
              }
            } else {
              // Não encontrou no shapefile
              missingLines.push({
                "Linha Planilha": i + 2,
                "Fundo Agricola": fundo,
                "Talhao": talhao,
                "TCH": tchStr,
                "Motivo": "Talhão não encontrado no mapa (Shapefile)"
              });
            }
          }

          // Salvar as estimativas encontradas em LOTES para não travar o navegador
          let savedCount = 0;
          if (linesToSave.length > 0) {
            const BATCH_SIZE = 50;
            setEstProgress({ current: 0, total: linesToSave.length });

            for (let i = 0; i < linesToSave.length; i += BATCH_SIZE) {
              const batch = linesToSave.slice(i, i + BATCH_SIZE);

              const promises = batch.map(item =>
                saveEstimate(currentCompanyId || "empresa_default", currentSafra || "2026/2027", item.uniqueTalhaoId, item.payload)
              );

              await Promise.all(promises);
              savedCount += batch.length;

              // Atualiza a interface
              setEstProgress({ current: savedCount, total: linesToSave.length });

              // Pausa de 50ms para permitir que o navegador (React) atualize a tela e respire
              await new Promise(resolve => setTimeout(resolve, 50));
            }

            if (refetchEstimates) await refetchEstimates();
          }

          // Gerar relatório se houver falhas
          if (missingLines.length > 0) {
            const ws = XLSX.utils.json_to_sheet(missingLines);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Falhas na Importação");
            const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
            const dataBlob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
            saveAs(dataBlob, "relatorio_falha_importacao.xlsx");

            setEstErrorMessage(`Importação finalizada. ${savedCount} talhões importados. ${missingLines.length} talhões falharam e o relatório foi baixado.`);
            setEstStatus("error"); // Usamos error pra mostrar a msg de aviso
          } else {
            setEstStatus("success");
            setEstErrorMessage(`${savedCount} talhões importados com sucesso! Nenhuma falha encontrada.`);
          }

        } catch (err) {
          setEstStatus("error");
          setEstErrorMessage("Erro ao ler o arquivo: " + err.message);
        }
      };

      reader.onerror = () => {
        setEstStatus("error");
        setEstErrorMessage("Erro ao processar a leitura do arquivo.");
      };

      reader.readAsArrayBuffer(estFile);
    } catch (err) {
      setEstStatus("error");
      setEstErrorMessage(err.message || "Erro desconhecido ao processar planilha.");
    }
  };

  const handleMigrateDates = async () => {
    setMigrationStatus("processing");
    try {
      const token = user ? await user.getIdToken() : '';
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/api/cadastros/apontamentos-insumo/migrar-datas`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ companyId: currentCompanyId || "AgroSystem_Demo" })
      });
      const data = await res.json();
      if (res.ok && data.success) {
          setMigrationStatus("success");
          alert(data.message);
      } else {
          setMigrationStatus("error");
          alert("Erro: " + data.message);
      }
    } catch (err) {
      setMigrationStatus("error");
      alert("Falha na migração: " + err.message);
    } finally {
      setTimeout(() => setMigrationStatus("idle"), 5000);
    }
  };

  const removeFile = (indexToRemove) => {
    setFiles(files.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <div className="p-4 sm:p-10 max-w-5xl mx-auto text-white">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-3xl font-semibold flex items-center gap-3">
          <Map className="w-8 h-8" style={{ color: palette.gold }} />
          Configuração da Empresa
        </h1>
        <p className="mt-2 text-sm" style={{ color: palette.text2 }}>
          Gerencie as áreas da sua fazenda importando arquivos Shapefile (SHP).
          Eles serão processados e utilizados nos módulos de Estimativa de Safra.
        </p>
      </div>

      <div
        className="rounded-[28px] border overflow-hidden shadow-2xl backdrop-blur-md relative mb-8"
        style={{
          background: "linear-gradient(180deg, rgba(22,24,28,0.78), rgba(18,20,24,0.66))",
          borderColor: "rgba(230,199,107,0.18)",
        }}
      >
        <div className="p-4 sm:p-6 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <h2 className="text-lg sm:text-xl font-medium">Manutenção do Banco de Dados</h2>
          <p className="text-sm mt-1" style={{ color: palette.text2 }}>
            Ferramentas para correção ou migração de dados antigos.
          </p>
        </div>
        <div className="p-4 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-[20px] transition-colors duration-200" style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.05)" }}>
                 <DatabaseZap className="w-6 h-6" style={{ color: palette.gold }} />
               </div>
               <div>
                 <h3 className="font-medium text-[15px]">Migração de Datas (Produção e Apontamento)</h3>
                 <p className="text-xs" style={{ color: palette.text2 }}>Converte as datas de registros antigos para o novo formato pesquisável (ISO). Rode apenas uma vez.</p>
               </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
               <button
                  onClick={handleMigrateDates}
                  disabled={migrationStatus === "processing"}
                  className="ml-auto sm:ml-4 px-4 py-2 rounded-xl text-sm font-medium transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
                  style={{
                    background: `linear-gradient(135deg, ${palette.gold} 0%, ${palette.goldLight} 100%)`,
                    color: palette.bg
                  }}
               >
                 {migrationStatus === "processing" ? <><Loader2 className="w-4 h-4 animate-spin"/> Processando...</> : migrationStatus === "success" ? "Migração Concluída!" : "Rodar Migração"}
               </button>
            </div>
          </div>
        </div>
      </div>

      <div
        className="rounded-[28px] border overflow-hidden shadow-2xl backdrop-blur-md relative mb-8"
        style={{
          background: "linear-gradient(180deg, rgba(22,24,28,0.78), rgba(18,20,24,0.66))",
          borderColor: "rgba(230,199,107,0.18)",
        }}
      >
        <div className="p-4 sm:p-6 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <h2 className="text-lg sm:text-xl font-medium">Personalização Visual</h2>
          <p className="text-sm mt-1" style={{ color: palette.text2 }}>
            Ajuste a cor principal da identidade visual da empresa no sistema.
          </p>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-[20px] transition-colors duration-200" style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.05)" }}>
                 <Palette className="w-6 h-6" style={{ color: localColor }} />
               </div>
               <div>
                 <h3 className="font-medium text-[15px]">Cor do Ícone Principal</h3>
                 <p className="text-xs" style={{ color: palette.text2 }}>Altera a cor do logo em todas as telas</p>
               </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
               <input
                 type="color"
                 value={localColor}
                 onChange={(e) => setLocalColor(e.target.value)}
                 className="w-10 h-10 p-1 rounded-lg cursor-pointer bg-transparent border-none"
                 title="Escolha uma cor"
               />
               <span className="text-sm font-mono" style={{ color: palette.text2 }}>{localColor.toUpperCase()}</span>

               <button
                  onClick={handleSaveColor}
                  disabled={colorStatus === "processing"}
                  className="ml-auto sm:ml-4 px-4 py-2 rounded-xl text-sm font-medium transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
                  style={{
                    background: `linear-gradient(135deg, ${palette.gold} 0%, ${palette.goldLight} 100%)`,
                    color: palette.bg
                  }}
               >
                 {colorStatus === "processing" ? "Salvando..." : colorStatus === "success" ? "Salvo!" : "Salvar Cor"}
               </button>
            </div>
          </div>
        </div>
      </div>

      <div
        className="rounded-[28px] border overflow-hidden shadow-2xl backdrop-blur-md relative"
        style={{
          background: "linear-gradient(180deg, rgba(22,24,28,0.78), rgba(18,20,24,0.66))",
          borderColor: "rgba(230,199,107,0.18)",
        }}
      >
        <div className="p-4 sm:p-6 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <h2 className="text-lg sm:text-xl font-medium">Importação de Contornos (Shapefile)</h2>
          <p className="text-sm mt-1" style={{ color: palette.text2 }}>
            Faça upload do arquivo .ZIP contendo o shapefile ou selecione os arquivos soltos (.shp, .shx, .dbf, .prj, etc).
          </p>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          <div
            className="border-2 border-dashed rounded-[20px] p-6 sm:p-8 text-center transition-colors duration-200"
            style={{
              borderColor: "rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.02)",
            }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <UploadCloud className="w-12 h-12 mx-auto mb-4" style={{ color: palette.goldLight }} />
            <h3 className="text-lg font-medium mb-2">Arraste seu arquivo .ZIP ou arquivos soltos aqui</h3>
            <p className="text-sm mb-4" style={{ color: palette.text2 }}>
              ou clique para procurar no seu computador
            </p>
            <input
              type="file"
              multiple
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".zip,.shp,.shx,.dbf,.prj,.cpg,.qmd"
            />
            <button
              onClick={() => fileInputRef.current.click()}
              className="px-6 py-2.5 rounded-xl text-sm font-medium transition-transform hover:scale-105"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              Procurar arquivos
            </button>
          </div>

          {files.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium" style={{ color: palette.text2 }}>Arquivos selecionados ({files.length})</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {files.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl border"
                    style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <File className="w-5 h-5 shrink-0" style={{ color: palette.text2 }} />
                      <span className="text-sm truncate">{file.name}</span>
                    </div>
                    {status !== "processing" && status !== "success" && (
                      <button
                        onClick={() => removeFile(idx)}
                        className="text-xs hover:text-red-400 p-1 rounded-md"
                        style={{ color: palette.text2 }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {status === "error" && (
                <div className="flex items-start gap-3 p-4 rounded-xl mt-4" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-red-400">Erro na importação</div>
                    <div className="text-xs text-red-300 mt-1">{errorMessage}</div>
                  </div>
                </div>
              )}

              {status === "success" && (
                <div className="flex items-start gap-3 p-4 rounded-xl mt-4" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)" }}>
                  <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-green-400">Shapefile importado com sucesso!</div>
                    <div className="text-xs text-green-300 mt-1">Os contornos foram processados e já estão prontos para o mapa de estimativa.</div>
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end">
                <button
                  onClick={handleUpload}
                  disabled={status === "processing" || status === "success"}
                  className="px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                  style={{
                    background: `linear-gradient(135deg, ${palette.gold} 0%, ${palette.goldLight} 100%)`,
                    color: palette.bg
                  }}
                >
                  {status === "processing" ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processando...
                    </>
                  ) : status === "success" ? (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Concluído
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-5 h-5" />
                      Iniciar Processamento
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>


      <div
        className="rounded-[28px] border overflow-hidden shadow-2xl backdrop-blur-md relative mt-8"
        style={{
          background: "linear-gradient(180deg, rgba(22,24,28,0.78), rgba(18,20,24,0.66))",
          borderColor: "rgba(230,199,107,0.18)",
        }}
      >
        <div className="p-4 sm:p-6 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <h2 className="text-lg sm:text-xl font-medium">Importação de Estimativa Inicial (Planilha)</h2>
          <p className="text-sm mt-1" style={{ color: palette.text2 }}>
            Faça upload de uma planilha (.XLSX ou .CSV) contendo as colunas de FUNDO, TALHÃO e TCH. O sistema vai cruzar a área com o mapa atual e salvar como primeira estimativa.
          </p>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          <div
            className="border-2 border-dashed rounded-[20px] p-6 sm:p-8 text-center transition-colors duration-200"
            style={{
              borderColor: "rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-4" style={{ color: palette.goldLight }} />
            <h3 className="text-lg font-medium mb-2">Selecione seu arquivo .XLSX ou .CSV</h3>
            <p className="text-sm mb-4" style={{ color: palette.text2 }}>
              A planilha deve conter colunas chamadas FUNDO, TALHÃO e TCH
            </p>
            <input
              type="file"
              className="hidden"
              ref={fileInputRefEst}
              onChange={handleEstFileChange}
              accept=".xlsx,.xls,.csv"
            />
            <button
              onClick={() => fileInputRefEst.current.click()}
              className="px-6 py-2.5 rounded-xl text-sm font-medium transition-transform hover:scale-105"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              Procurar planilha
            </button>
          </div>

          {estFile && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium" style={{ color: palette.text2 }}>Arquivo selecionado</h4>
              <div className="grid grid-cols-1 gap-3">
                  <div
                    className="flex items-center justify-between p-3 rounded-xl border"
                    style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <File className="w-5 h-5 shrink-0" style={{ color: palette.text2 }} />
                      <span className="text-sm truncate">{estFile.name}</span>
                    </div>
                    {estStatus !== "processing" && (
                      <button
                        onClick={removeEstFile}
                        className="text-xs hover:text-red-400 p-1 rounded-md"
                        style={{ color: palette.text2 }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
              </div>

              {estStatus === "error" && (
                <div className="flex items-start gap-3 p-4 rounded-xl mt-4" style={{ background: estErrorMessage.includes("falharam") ? "rgba(234,179,8,0.1)" : "rgba(239,68,68,0.1)", border: estErrorMessage.includes("falharam") ? "1px solid rgba(234,179,8,0.3)" : "1px solid rgba(239,68,68,0.3)" }}>
                  <AlertCircle className={`w-5 h-5 ${estErrorMessage.includes("falharam") ? 'text-yellow-400' : 'text-red-400'} shrink-0`} />
                  <div>
                    <div className={`text-sm font-medium ${estErrorMessage.includes("falharam") ? 'text-yellow-400' : 'text-red-400'}`}>Aviso / Erro na Importação</div>
                    <div className={`text-xs ${estErrorMessage.includes("falharam") ? 'text-yellow-300' : 'text-red-300'} mt-1`}>{estErrorMessage}</div>
                  </div>
                </div>
              )}

              {estStatus === "success" && (
                <div className="flex items-start gap-3 p-4 rounded-xl mt-4" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)" }}>
                  <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-green-400">Sucesso!</div>
                    <div className="text-xs text-green-300 mt-1">{estErrorMessage}</div>
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end">
                <button
                  onClick={handleEstUpload}
                  disabled={estStatus === "processing"}
                  className="px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                  style={{
                    background: `linear-gradient(135deg, ${palette.gold} 0%, ${palette.goldLight} 100%)`,
                    color: palette.bg
                  }}
                >
                  {estStatus === "processing" ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {estProgress.total > 0
                        ? `Salvando (${estProgress.current}/${estProgress.total})...`
                        : "Processando..."}
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-5 h-5" />
                      Importar Planilha
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
    </div>
  );
}
