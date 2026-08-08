"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { useIdioma } from "./LanguageProvider";

function formatoTiempo(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos < 0) return "0:00";
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Reemplaza el <audio controls> nativo (el reproductor gris feo que
// pone el navegador por defecto, sin relación con el resto del diseño)
// por uno propio de CoreStock: botón redondo, barra de progreso y
// tiempo, con los mismos colores que ya usa el resto de la burbuja.
export default function ReproductorAudioChat({ src, propio }: { src: string; propio?: boolean }) {
  const { t } = useIdioma();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [actual, setActual] = useState(0);
  const [duracion, setDuracion] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function alActualizar() {
      setActual(audio!.currentTime);
    }
    function alCargarDuracion() {
      // Algunos navegadores reportan Infinity para blobs hasta que
      // arrancan la reproducción — con eso la barra quedaría con un
      // rango inválido (max=Infinity) en vez de simplemente vacía.
      if (Number.isFinite(audio!.duration)) setDuracion(audio!.duration);
    }
    function alTerminar() {
      setReproduciendo(false);
      setActual(0);
    }

    audio.addEventListener("timeupdate", alActualizar);
    audio.addEventListener("loadedmetadata", alCargarDuracion);
    audio.addEventListener("durationchange", alCargarDuracion);
    audio.addEventListener("ended", alTerminar);

    return () => {
      audio.removeEventListener("timeupdate", alActualizar);
      audio.removeEventListener("loadedmetadata", alCargarDuracion);
      audio.removeEventListener("durationchange", alCargarDuracion);
      audio.removeEventListener("ended", alTerminar);
    };
  }, []);

  function alTocarPlay() {
    const audio = audioRef.current;
    if (!audio) return;

    if (reproduciendo) {
      audio.pause();
      setReproduciendo(false);
    } else {
      audio.play();
      setReproduciendo(true);
    }
  }

  function alMoverBarra(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio) return;
    const nuevo = Number(e.target.value);
    audio.currentTime = nuevo;
    setActual(nuevo);
  }

  const progreso = duracion > 0 ? (actual / duracion) * 100 : 0;
  const tiempoAMostrar = actual > 0 ? actual : duracion;

  return (
    <div className={`audio-reproductor ${propio ? "audio-reproductor-propio" : ""}`}>
      <audio ref={audioRef} src={src} preload="metadata" style={{ display: "none" }} />

      <button
        type="button"
        className="audio-reproductor-play"
        onClick={alTocarPlay}
        aria-label={reproduciendo ? t("chat.pausar_audio") : t("chat.reproducir_audio")}
      >
        {reproduciendo ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: 1 }} />}
      </button>

      <input
        type="range"
        className="audio-reproductor-barra"
        min={0}
        max={duracion || 0}
        step={0.01}
        value={actual}
        onChange={alMoverBarra}
        style={{ ["--progreso" as string]: `${progreso}%` } as React.CSSProperties}
        aria-label={t("chat.reproducir_audio")}
      />

      <span className="audio-reproductor-tiempo">{formatoTiempo(tiempoAMostrar)}</span>
    </div>
  );
}
