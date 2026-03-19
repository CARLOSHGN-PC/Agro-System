import React, { useState, useRef } from "react";
import { UploadCloud, CheckCircle2, AlertCircle, File, Loader2, Map } from "lucide-react";
import { importShapefile, validateShapefileSet } from "../services/shpImport";

export default function CompanyConfig({ onUploadSuccess }) {
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState("idle"); // idle, processing, success, error
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef(null);

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

  const removeFile = (indexToRemove) => {
    setFiles(files.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <div className="p-6 sm:p-10 max-w-5xl mx-auto text-white">
      <div className="mb-8">
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
        className="rounded-[28px] border overflow-hidden shadow-2xl backdrop-blur-md relative"
        style={{
          background: "linear-gradient(180deg, rgba(22,24,28,0.78), rgba(18,20,24,0.66))",
          borderColor: "rgba(230,199,107,0.18)",
        }}
      >
        <div className="p-6 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <h2 className="text-xl font-medium">Importação de Contornos (Shapefile)</h2>
          <p className="text-sm mt-1" style={{ color: palette.text2 }}>
            Faça upload do arquivo .ZIP contendo o shapefile ou selecione os arquivos soltos (.shp, .shx, .dbf, .prj, etc).
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div
            className="border-2 border-dashed rounded-[20px] p-8 text-center transition-colors duration-200"
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
      </div>
    </div>
  );
}
