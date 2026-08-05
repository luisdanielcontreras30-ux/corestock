"use client";

import { useEffect, useRef, useState } from "react";

// Anima un número de su valor anterior hasta el nuevo cuando cambia.
export default function ContadorAnimado({
  valor,
  decimales = 0,
}: {
  valor: number;
  decimales?: number;
}) {
  const [mostrado, setMostrado] = useState(0);
  // paso() se reprograma a sí mismo con cada cuadro — sin guardar el id
  // más reciente en un ref, el cleanup solo podía cancelar el PRIMER
  // requestAnimationFrame agendado. En cuanto ese primer cuadro corría
  // y se reprogramaba, un cambio de "valor" (ej. cambiar el filtro de
  // fechas) dejaba ese ciclo viejo corriendo en paralelo con el nuevo,
  // los dos escribiendo sobre el mismo estado y compitiendo por el
  // número final que se ve en pantalla.
  const cuadroRef = useRef<number | null>(null);

  useEffect(() => {
    let inicio: number | null = null;
    const desde = mostrado;
    const duracionMs = 700;

    function paso(marca: number) {
      if (inicio === null) inicio = marca;
      const progreso = Math.min((marca - inicio) / duracionMs, 1);
      const facilitado = 1 - Math.pow(1 - progreso, 3);

      setMostrado(desde + (valor - desde) * facilitado);

      if (progreso < 1) {
        cuadroRef.current = requestAnimationFrame(paso);
      } else {
        setMostrado(valor);
      }
    }

    cuadroRef.current = requestAnimationFrame(paso);
    return () => {
      if (cuadroRef.current !== null) cancelAnimationFrame(cuadroRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  return (
    <>
      {mostrado.toLocaleString("en-US", {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales,
      })}
    </>
  );
}
