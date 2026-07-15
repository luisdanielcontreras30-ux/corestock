"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Bot } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { useIdioma } from "../../components/LanguageProvider";
import { Idioma } from "../../lib/i18n";
import EncabezadoModulo from "../../components/EncabezadoModulo";
import RequierePlus from "../../components/RequierePlus";
import {
  analizarQueComprar,
  analizarGanancias,
  analizarBajaVentas,
  analizarResumenSemana,
  analizarVentasHoy,
  analizarProductoTop,
  analizarAgotados,
  analizarInventario,
  analizarMejorCliente,
} from "./acciones";

interface Mensaje {
  id: number;
  autor: "usuario" | "asistente";
  texto: string;
  // Si viene presente, el texto se traduce en cada render (para que
  // reaccione a cambios de idioma) en vez de quedar fijo en el idioma
  // que estaba activo cuando se generó el mensaje.
  claveTexto?: string;
}

// Convierte **negritas** y saltos de línea en JSX simple.
function renderizarTexto(texto: string) {
  const lineas = texto.split("\n");

  return lineas.map((linea, i) => {
    const partes = linea.split(/(\*\*[^*]+\*\*)/g);

    return (
      <p key={i} style={{ margin: linea === "" ? "8px 0" : "0 0 4px 0" }}>
        {partes.map((parte, j) =>
          parte.startsWith("**") && parte.endsWith("**") ? (
            <strong key={j}>{parte.slice(2, -2)}</strong>
          ) : (
            <span key={j}>{parte}</span>
          )
        )}
      </p>
    );
  });
}

export default function AsistentePage() {
  return (
    <RequierePlus>
      <AsistenteContenido />
    </RequierePlus>
  );
}

function AsistenteContenido() {
  const { user } = useAuth();
  const { t, idioma } = useIdioma();

  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [entrada, setEntrada] = useState("");
  const [pensando, setPensando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMensajes([
      { id: 0, autor: "asistente", texto: "", claveTexto: "asistente.saludo_inicial" },
    ]);
  }, []);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, pensando]);

  const preguntas = [
    { texto: t("asistente.q_hoy"), fn: analizarVentasHoy },
    { texto: t("asistente.q_comprar"), fn: analizarQueComprar },
    { texto: t("asistente.q_ganancias"), fn: analizarGanancias },
    { texto: t("asistente.q_bajaron"), fn: analizarBajaVentas },
    { texto: t("asistente.q_resumen"), fn: analizarResumenSemana },
    { texto: t("asistente.q_topproducto"), fn: analizarProductoTop },
    { texto: t("asistente.q_agotados"), fn: analizarAgotados },
    { texto: t("asistente.q_inventario"), fn: analizarInventario },
    { texto: t("asistente.q_mejorcliente"), fn: analizarMejorCliente },
  ];

  async function enviarPregunta(
    texto: string,
    calcular: (userId: string, idioma: Idioma) => Promise<string>
  ) {
    if (!user || pensando) return;

    // eslint-disable-next-line react-hooks/purity -- id de mensaje generado en un manejador de clic, no durante el render
    const idUsuario = Date.now();
    setMensajes((prev) => [
      ...prev,
      { id: idUsuario, autor: "usuario", texto },
    ]);
    setEntrada("");
    setPensando(true);

    // Pequeña pausa artificial: hace tangible que "está pensando",
    // aunque el cálculo real ya se está haciendo detrás.
    const [respuesta] = await Promise.all([
      calcular(user.id, idioma),
      new Promise((r) => setTimeout(r, 450)),
    ]);

    setMensajes((prev) => [
      ...prev,
      { id: idUsuario + 1, autor: "asistente", texto: respuesta },
    ]);
    setPensando(false);
  }

  function detectarFuncion(texto: string) {
    const t = texto.toLowerCase().trim();

    // Las intenciones de negocio van primero: un mensaje como "hey,
    // ¿cuánto vendí hoy?" o "gracias, ¿cómo va mi inventario?" debe
    // resolver la pregunta real, no quedarse en el saludo/despedida.
    if (
      (t.includes("compr") || t.includes("buy") || t.includes("reabastec")) &&
      !t.includes("gana")
    ) {
      return analizarQueComprar;
    }
    if (t.includes("ganan") || t.includes("profit") || t.includes("margen") || t.includes("lucro")) {
      return analizarGanancias;
    }
    if (
      (t.includes("baj") || t.includes("cay") || t.includes("down") || t.includes("drop")) &&
      (t.includes("venta") || t.includes("sale"))
    ) {
      return analizarBajaVentas;
    }
    if (t.includes("resum") || t.includes("summary") || (t.includes("semana") && t.includes("venta")) || t.includes("week")) {
      return analizarResumenSemana;
    }
    if ((t.includes("hoy") || t.includes("today")) && (t.includes("vend") || t.includes("sold") || t.includes("sale"))) {
      return analizarVentasHoy;
    }
    if (
      (t.includes("más vendido") || t.includes("mas vendido") || t.includes("best sell") || t.includes("estrella") || t.includes("top product"))
    ) {
      return analizarProductoTop;
    }
    if (t.includes("agotad") || t.includes("out of stock") || t.includes("sin stock")) {
      return analizarAgotados;
    }
    if (t.includes("inventario") || t.includes("catálogo") || t.includes("catalogo") || t.includes("cuántos productos") || t.includes("cuantos productos")) {
      return analizarInventario;
    }
    if (t.includes("mejor cliente") || t.includes("mejores clientes") || t.includes("best customer") || t.includes("top cliente") || t.includes("top client")) {
      return analizarMejorCliente;
    }

    // Saludos y small talk solo si no hay ninguna intención de negocio.
    const saludos = ["hola", "hi", "hello", "hey", "buenas", "buenos días", "buenos dias", "buenas tardes", "buenas noches", "qué tal", "que tal", "oi", "olá", "salut", "hallo", "你好"];
    if (saludos.some((s) => t === s || t.startsWith(s + " ") || t.startsWith(s + "!") || t.startsWith(s + ","))) {
      return "saludo" as const;
    }

    const despedidas = ["gracias", "thanks", "thank you", "adiós", "adios", "bye", "nos vemos", "obrigado", "merci", "danke", "谢谢"];
    if (despedidas.some((s) => t.includes(s))) {
      return "despedida" as const;
    }

    const ayuda = ["ayuda", "help", "qué puedes hacer", "que puedes hacer", "qué sabes hacer", "aide", "hilfe", "帮助"];
    if (ayuda.some((s) => t.includes(s))) {
      return "ayuda" as const;
    }

    return null;
  }

  async function alEnviarLibre() {
    const texto = entrada.trim();
    if (!texto) return;

    const resultado = detectarFuncion(texto);

    if (resultado === "saludo") {
      setMensajes((prev) => [
        ...prev,
        { id: Date.now(), autor: "usuario", texto },
        { id: Date.now() + 1, autor: "asistente", texto: t("asistente.saludo_respuesta") },
      ]);
      setEntrada("");
      return;
    }

    if (resultado === "despedida") {
      setMensajes((prev) => [
        ...prev,
        { id: Date.now(), autor: "usuario", texto },
        { id: Date.now() + 1, autor: "asistente", texto: t("asistente.despedida_respuesta") },
      ]);
      setEntrada("");
      return;
    }

    if (resultado === "ayuda") {
      setMensajes((prev) => [
        ...prev,
        { id: Date.now(), autor: "usuario", texto },
        { id: Date.now() + 1, autor: "asistente", texto: t("asistente.ayuda_respuesta") },
      ]);
      setEntrada("");
      return;
    }

    if (!resultado) {
      setMensajes((prev) => [
        ...prev,
        { id: Date.now(), autor: "usuario", texto },
        {
          id: Date.now() + 1,
          autor: "asistente",
          texto: t("asistente.no_entendi"),
        },
      ]);
      setEntrada("");
      return;
    }

    await enviarPregunta(texto, resultado);
  }

  return (
    <main className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 20, height: "calc(100vh - 64px)" }}>
      <EncabezadoModulo
        Icono={Sparkles}
        color="#a855f7"
        titulo={t("asistente.titulo")}
        subtitulo={t("asistente.subtitulo")}
      />

      {/* CHIPS DE PREGUNTAS SUGERIDAS */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {preguntas.map((p) => (
          <button
            key={p.texto}
            onClick={() => enviarPregunta(p.texto, p.fn)}
            disabled={pensando}
            className="btn-secondary"
            style={{ fontSize: 13, borderRadius: 999 }}
          >
            {p.texto}
          </button>
        ))}
      </div>

      {/* HILO DE CONVERSACIÓN */}
      <div
        className="card"
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          padding: 24,
        }}
      >
        {mensajes.map((m) => (
          <div
            key={m.id}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              flexDirection: m.autor === "usuario" ? "row-reverse" : "row",
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                background:
                  m.autor === "asistente" ? "var(--primary)" : "var(--card-hover)",
                color: m.autor === "asistente" ? "#fff" : "var(--text-primary)",
              }}
            >
              {m.autor === "asistente" ? (
                <Bot size={16} />
              ) : (
                (user?.email?.charAt(0) ?? "U").toUpperCase()
              )}
            </div>

            <div
              style={{
                maxWidth: "72%",
                background:
                  m.autor === "asistente" ? "var(--glass-bg)" : "var(--primary-soft)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: "12px 16px",
                fontSize: 13.5,
                color: "var(--text-primary)",
                lineHeight: 1.5,
              }}
            >
              {renderizarTexto(m.claveTexto ? t(m.claveTexto) : m.texto)}
            </div>
          </div>
        ))}

        {pensando && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                background: "var(--primary)",
                color: "#fff",
              }}
            >
              <Bot size={16} />
            </div>
            <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              {t("asistente.pensando")}
            </span>
          </div>
        )}

        <div ref={finRef} />
      </div>

      {/* ENTRADA DE TEXTO LIBRE */}
      <div style={{ display: "flex", gap: 10 }}>
        <input
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") alEnviarLibre();
          }}
          placeholder={t("asistente.placeholder")}
          disabled={pensando}
        />
        <button
          className="btn-primary"
          onClick={alEnviarLibre}
          disabled={pensando}
          style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
        >
          <Send size={15} />
        </button>
      </div>
    </main>
  );
}
