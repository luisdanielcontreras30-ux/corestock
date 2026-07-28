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
  analizarVentasMes,
  analizarCategoriaTop,
} from "./acciones";
import type { IntencionDatos } from "./deteccion";
import type { TemaConocimiento } from "./conocimiento";
import { preguntarAIa, MensajeIA } from "./ia";
import { interpretarCalculo } from "./calculadora";
import { normalizarTexto } from "../../lib/normalizarTexto";

// La base de conocimiento son ~350 KB de texto (48 temas × 7 idiomas) y
// vivía en el bundle inicial de esta pantalla: todo el mundo la
// descargaba al abrir el Asistente, incluso quien solo iba a tocar los
// botones de preguntas rápidas, que no la usan para nada.
//
// Ahora se carga bajo demanda, la primera vez que alguien escribe texto
// libre, y se guarda para las siguientes. El módulo se importa entero
// (no por idioma) porque separar los 7 obligaría a reestructurar los
// datos; esto ya evita el grueso del costo sin tocar su forma.
let conocimientoCargado: typeof import("./deteccion") | null = null;

async function cargarConocimiento() {
  if (!conocimientoCargado) {
    conocimientoCargado = await import("./deteccion");
  }
  return conocimientoCargado;
}

// Une la intención detectada con la función que consulta los datos.
// Estar en un mapa (y no en la cadena de if de antes) permite que
// deteccion.ts no sepa nada de acciones.ts: solo devuelve un nombre.
const FUNCIONES_DATOS: Record<IntencionDatos, (idioma: Idioma) => Promise<string>> = {
  que_comprar: analizarQueComprar,
  ganancias: analizarGanancias,
  baja_ventas: analizarBajaVentas,
  resumen_semana: analizarResumenSemana,
  ventas_hoy: analizarVentasHoy,
  producto_top: analizarProductoTop,
  agotados: analizarAgotados,
  inventario: analizarInventario,
  mejor_cliente: analizarMejorCliente,
  ventas_mes: analizarVentasMes,
  categoria_top: analizarCategoriaTop,
};

interface Mensaje {
  id: number;
  autor: "usuario" | "asistente";
  texto: string;
  // Si viene presente, el texto se traduce en cada render (para que
  // reaccione a cambios de idioma) en vez de quedar fijo en el idioma
  // que estaba activo cuando se generó el mensaje.
  claveTexto?: string;
}

// Los resultados de la calculadora salen como números crudos (ver
// calculadora.ts) y se formatean aquí, en el idioma activo: separador
// de miles y decimales cambian por país, y un "1,234.5" en una interfaz
// en alemán se lee mal.
const LOCALES: Record<Idioma, string> = {
  es: "es-MX",
  en: "en-US",
  pt: "pt-BR",
  fr: "fr-FR",
  de: "de-DE",
  zh: "zh-CN",
  it: "it-IT",
};

function formatearNumero(valor: number, idioma: Idioma): string {
  return new Intl.NumberFormat(LOCALES[idioma], { maximumFractionDigits: 2 }).format(valor);
}

// Rellena los huecos {a}, {b}, {r}... de la plantilla traducida con los
// números que calculó el motor.
function rellenarPlantilla(
  plantilla: string,
  valores: Record<string, number>,
  idioma: Idioma
): string {
  let texto = plantilla;
  for (const [clave, valor] of Object.entries(valores)) {
    texto = texto.split(`{${clave}}`).join(formatearNumero(valor, idioma));
  }
  return texto;
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
  // Memoria mínima de la conversación: sobre qué se habló al final,
  // para que "cuéntame más" o "dame un ejemplo" tengan a qué referirse.
  const [ultimoTema, setUltimoTema] = useState<string | null>(null);
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
    { texto: t("asistente.q_mes"), fn: analizarVentasMes },
    { texto: t("asistente.q_topproducto"), fn: analizarProductoTop },
    { texto: t("asistente.q_categoria"), fn: analizarCategoriaTop },
    { texto: t("asistente.q_agotados"), fn: analizarAgotados },
    { texto: t("asistente.q_inventario"), fn: analizarInventario },
    { texto: t("asistente.q_mejorcliente"), fn: analizarMejorCliente },
  ];

  async function enviarPregunta(
    texto: string,
    calcular: (idioma: Idioma) => Promise<string>
  ) {
    if (!user || pensando) return;

    agregarMensaje("usuario", texto);
    setEntrada("");
    setPensando(true);

    // Los botones de preguntas rápidas también cambian de qué se está
    // hablando. Sin esto, preguntar "¿qué es el margen?", tocar luego
    // un botón de datos y escribir "cuéntame más" seguía respondiendo
    // sobre el margen — el mismo fallo que ya se arregló para el texto
    // libre, pero por la otra entrada.
    setUltimoTema(null);

    try {
      // Pequeña pausa artificial: hace tangible que "está pensando",
      // aunque el cálculo real ya se está haciendo detrás.
      const [respuesta] = await Promise.all([
        calcular(idioma),
        new Promise((r) => setTimeout(r, 450)),
      ]);

      agregarMensaje("asistente", respuesta);
    } catch (error) {
      console.error(error);
      agregarMensaje("asistente", t("asistente.msg_error"));
    } finally {
      setPensando(false);
    }
  }

  function buscarTema(temas: TemaConocimiento[], id: string) {
    return temas.find((x) => x.id === id) ?? null;
  }

  // Añade al final de la respuesta los temas relacionados. Es lo que
  // convierte respuestas sueltas en una conversación: la persona ve
  // hacia dónde puede seguir en vez de quedarse sin saber qué preguntar.
  function nombresRelacionados(temas: TemaConocimiento[], tema: TemaConocimiento): string[] {
    return (tema.relacionados ?? [])
      .map((id) => buscarTema(temas, id)?.titulo?.[idioma])
      .filter((n): n is string => !!n);
  }

  function conRelacionados(temas: TemaConocimiento[], respuesta: string, tema: TemaConocimiento): string {
    const nombres = nombresRelacionados(temas, tema);
    if (nombres.length === 0) return respuesta;
    return `${respuesta}\n\n${t("asistente.tambien_te_sirve")} ${nombres.join(" · ")}`;
  }

  // El id se deriva del último mensaje en vez de Date.now(): así la
  // función es pura (nada de relojes) y los ids siguen siendo únicos y
  // crecientes aunque se mezclen con los que genera enviarPregunta.
  function agregarMensaje(autor: "usuario" | "asistente", texto: string) {
    setMensajes((prev) => {
      const id = (prev.length > 0 ? prev[prev.length - 1].id : 0) + 1;
      return [...prev, { id, autor, texto }];
    });
  }

  async function alEnviarLibre() {
    const texto = entrada.trim();
    if (!texto || pensando) return;

    // El mensaje se muestra y la caja se limpia ANTES de nada más: la
    // base de conocimiento se descarga bajo demanda y en una conexión
    // lenta eso tarda, así que sin esto la persona escribía, pulsaba
    // enviar y no pasaba nada visible durante segundos. Además,
    // "pensando" bloquea el segundo envío, que antes sí pasaba porque
    // durante la descarga la guarda de arriba no se activaba.
    agregarMensaje("usuario", texto);
    setEntrada("");
    setPensando(true);

    try {
      // Las CUENTAS van antes que la IA, y a propósito.
      //
      // Un modelo de lenguaje no calcula: predice el texto que suele
      // seguir, y con eso se equivoca en aritmética cada tanto — casi
      // siempre por poco, que es lo peor, porque un "18% de 4,350 =
      // 792" se ve razonable y nadie lo revisa. Aquí se está hablando
      // de precios y márgenes: un número casi correcto es un número
      // mal cobrado.
      //
      // La calculadora (calculadora.ts) opera de verdad, así que su
      // resultado es exacto siempre. Además responde al instante y sin
      // gastar saldo. Cuando no reconoce la frase devuelve null y la
      // pregunta sigue su camino normal hacia la IA.
      const calculo = interpretarCalculo(normalizarTexto(texto).trim());

      if (calculo) {
        agregarMensaje(
          "asistente",
          rellenarPlantilla(t(calculo.clave), calculo.valores, idioma)
        );
        return;
      }

      // Después sí, la IA de verdad. Recibe los últimos mensajes para
      // que "cuéntame más" signifique algo, y del lado del servidor se
      // le suman los números reales del negocio.
      //
      // preguntarAIa() nunca lanza: devuelve null cuando no hay llave,
      // se acabó el saldo, falló la red o el modelo no respondió. Ese
      // null cae al motor de reglas de abajo, que es gratis y funciona
      // sin conexión al servicio. Así el Asistente nunca se queda mudo
      // por un problema de la IA.
      const historialIA: MensajeIA[] = mensajes
        .filter((m) => !m.claveTexto)
        .map((m) => ({ rol: m.autor, texto: m.texto }));

      const respuestaIA = await preguntarAIa(texto, historialIA, idioma);

      if (respuestaIA) {
        // La IA lleva su propio hilo en el historial, así que el tema
        // recordado del motor de reglas dejaría de tener sentido.
        setUltimoTema(null);
        agregarMensaje("asistente", respuestaIA);
        return;
      }

      let modulo;
      try {
        modulo = await cargarConocimiento();
      } catch (error) {
        // Un chunk que no carga es un caso real, no teórico: tras cada
        // despliegue las rutas viejas dejan de existir, y esta app se
        // queda abierta como PWA durante días. Sin este aviso la
        // persona pulsaba enviar y no ocurría absolutamente nada.
        console.error(error);
        agregarMensaje("asistente", t("asistente.msg_error_carga"));
        return;
      }

      const { detectarIntencion, TODOS_LOS_TEMAS } = modulo;
      const resultado = detectarIntencion(texto);

      if (!resultado) {
        agregarMensaje("asistente", t("asistente.no_entendi"));
        return;
      }

      if (resultado.tipo === "saludo") {
        agregarMensaje("asistente", t("asistente.saludo_respuesta"));
        return;
      }

      if (resultado.tipo === "despedida") {
        agregarMensaje("asistente", t("asistente.despedida_respuesta"));
        return;
      }

      if (resultado.tipo === "ayuda") {
        agregarMensaje("asistente", t("asistente.ayuda_respuesta"));
        return;
      }

      if (resultado.tipo === "identidad") {
        agregarMensaje("asistente", t("asistente.identidad_respuesta"));
        return;
      }

      if (resultado.tipo === "estado_animo") {
        agregarMensaje("asistente", t("asistente.animo_respuesta"));
        return;
      }

      // Una cuenta resuelta al vuelo. No pasa por la base de temas, así
      // que tampoco cambia de qué se está hablando: preguntar "¿cuánto
      // es el 15% de 800?" a media conversación sobre márgenes no
      // debería borrar el hilo.
      if (resultado.tipo === "calculo") {
        agregarMensaje(
          "asistente",
          rellenarPlantilla(t(resultado.clave), resultado.valores, idioma)
        );
        return;
      }

      // "Cuéntame más" solo significa algo si hay un tema anterior. Si
      // no lo hay, se responde con la ayuda en vez de con un "no
      // entendí" que dejaría a la persona sin saber qué hacer.
      if (resultado.tipo === "seguimiento") {
        const anterior = ultimoTema ? buscarTema(TODOS_LOS_TEMAS, ultimoTema) : null;
        if (!anterior) {
          agregarMensaje("asistente", t("asistente.ayuda_respuesta"));
          return;
        }

        // Reenviar la MISMA respuesta palabra por palabra se sentía
        // roto: se ofrecen los caminos por los que sí hay más que
        // contar, que es lo que la persona está pidiendo.
        const nombres = nombresRelacionados(TODOS_LOS_TEMAS, anterior);
        const titulo = anterior.titulo?.[idioma] ?? "";

        agregarMensaje(
          "asistente",
          nombres.length > 0
            ? `${t("asistente.seguimiento_respuesta").replace("{tema}", titulo)}\n\n${nombres
                .map((n) => `• ${n}`)
                .join("\n")}`
            : t("asistente.seguimiento_sin_mas").replace("{tema}", titulo)
        );
        return;
      }

      if (resultado.tipo === "sugerencia") {
        const nombres = resultado.temaIds
          .map((id) => buscarTema(TODOS_LOS_TEMAS, id)?.titulo?.[idioma])
          .filter((n): n is string => !!n);

        agregarMensaje(
          "asistente",
          nombres.length > 0
            ? `${t("asistente.quizas_te_referias")}\n\n${nombres.map((n) => `• ${n}`).join("\n")}`
            : t("asistente.no_entendi")
        );
        return;
      }

      if (resultado.tipo === "conocimiento") {
        const tema = buscarTema(TODOS_LOS_TEMAS, resultado.temaId);
        if (!tema) {
          agregarMensaje("asistente", t("asistente.no_entendi"));
          return;
        }
        setUltimoTema(tema.id);
        agregarMensaje("asistente", conRelacionados(TODOS_LOS_TEMAS, tema.respuesta[idioma], tema));
        return;
      }

      // Conversación que no pide información: alguien que está mal,
      // alguien que celebra, quien pide una opinión o un chiste. No
      // limpia el tema anterior a propósito — quien dice "eres un
      // genio" a media explicación quiere seguir donde iba.
      //
      // En este punto ya solo quedan la charla y "datos", así que
      // descartar "datos" deja el tipo exacto y el mapa de abajo tiene
      // que cubrirlo entero: si mañana se agrega una intención de
      // charla y se olvida su respuesta, no compila.
      if (resultado.tipo !== "datos") {
        const RESPUESTAS_CHARLA: Record<typeof resultado.tipo, string> = {
          desahogo: "asistente.desahogo_respuesta",
          celebracion: "asistente.celebracion_respuesta",
          opinion: "asistente.opinion_respuesta",
          chiste: "asistente.chiste_respuesta",
          afecto: "asistente.afecto_respuesta",
        };

        agregarMensaje("asistente", t(RESPUESTAS_CHARLA[resultado.tipo]));
        return;
      }

      // Una pregunta sobre los datos cambia de qué se está hablando: si
      // no se limpiara, un "cuéntame más" posterior seguiría
      // respondiendo sobre el último tema teórico.
      setUltimoTema(null);

      try {
        agregarMensaje("asistente", await FUNCIONES_DATOS[resultado.intencion](idioma));
      } catch (error) {
        console.error(error);
        agregarMensaje("asistente", t("asistente.msg_error"));
      }
    } finally {
      setPensando(false);
    }
  }

  return (
    <main className="fade-up asistente-main" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
        className="card asistente-hilo"
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
                minWidth: 0,
                overflowWrap: "anywhere",
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
          aria-label={t("asistente.enviar")}
          style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
        >
          <Send size={15} />
        </button>
      </div>
    </main>
  );
}
