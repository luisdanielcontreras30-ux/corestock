"use client";

import ProductoCard from "./ProductoCard";

interface ProductoGrafica {
  id: number;
  nombre: string;
  ventas: number;
  unidades: number;
  historial: {
    nombre: string;
    ventas: number;
  }[];
}

interface Props {
  productos: ProductoGrafica[];
}

export default function ProductosGrid({
  productos,
}: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit,minmax(320px,1fr))",
        gap: 20,
        marginTop: 24,
      }}
    >
      {productos.map((producto) => (
        <ProductoCard
          key={producto.id}
          nombre={producto.nombre}
          ventas={producto.ventas}
          unidades={producto.unidades}
          data={producto.historial}
        />
      ))}
    </div>
  );
}