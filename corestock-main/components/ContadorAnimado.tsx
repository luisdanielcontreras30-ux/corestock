"use client";

import { useEffect, useState } from "react";

// Anima un número de su valor anterior hasta el nuevo cuando cambia.
export default function ContadorAnimado({
  valor,
  decimales = 0,
}: {
  valor: number;
  decimales?: number;
}) {
  const [mostrado, setMostrado] = useState(0);

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
        requestAnimationFrame(paso);
      } else {
        setMostrado(valor);
      }
    }

    const cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
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
