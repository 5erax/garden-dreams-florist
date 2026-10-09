import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { checkEnvironment } from "./src/environment.js";

export default defineConfig(({ mode, command }) => {
  const config = checkEnvironment(
    {
      ...loadEnv(mode, process.cwd(), ""),
      ...process.env,
    },
    { command },
  );
  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_APP_ENV": JSON.stringify(config.environment),
    },
  };
});
