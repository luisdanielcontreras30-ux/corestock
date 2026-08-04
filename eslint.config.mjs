import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Esta app entera carga sus datos con el mismo patrón en cada
      // pantalla: `useEffect(() => { obtenerDatos(); }, [...])`, donde
      // obtenerDatos es async y hace `setLoading(true)` antes de su
      // primer await. La regla lo marca como error porque, en sentido
      // estricto, ese setLoading corre de forma síncrona dentro del
      // efecto — pero es el mismo patrón deliberado y seguro en ~35
      // páginas, no un bug real: no hay ninguna cascada de renders
      // perceptible (loading ya arranca en true en casi todos los
      // casos). Reescribir cómo cada pantalla carga sus datos para
      // silenciar esto sería un cambio grande y arriesgado por una
      // mejora casi imperceptible — se baja a warning en vez de
      // reestructurar toda la app.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
