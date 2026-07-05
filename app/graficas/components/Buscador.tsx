"use client";

interface Props {
  busqueda: string;
  setBusqueda: (valor: string) => void;
}

export default function Buscador({
  busqueda,
  setBusqueda,
}: Props) {
  return (
    <div
      className="card"
      style={{
        marginTop: 24,
        display: "flex",
        gap: 16,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <input
        type="text"
        placeholder="🔍 Buscar producto..."
        value={busqueda}
        onChange={(e) =>
          setBusqueda(e.target.value)
        }
        style={{
          flex: 1,
          minWidth: 260,
        }}
      />

      <select
        style={{
          width: 220,
        }}
      >
        <option>
          Todos los productos
        </option>

        <option>
          Más vendidos
        </option>

        <option>
          Menos vendidos
        </option>
      </select>
    </div>
  );
}
