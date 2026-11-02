import { defineConfig } from "vite";
import { resolve } from "node:path";

// Dev only: serve the election API with an in-memory store, since plain Vite has no serverless runtime.
const electionApi = {
  name: "election-api",
  apply: "serve",
  configureServer(server) {
    process.env.ELECTION_MEMORY_STORE = "1";
    process.env.ELECTION_ADMIN_KEY ||= "dev";
    server.middlewares.use(async (req, res, next) => {
      const route = req.url.split("?")[0];
      if (route !== "/api/election" && route !== "/api/election-admin") return next();
      let raw = "";
      for await (const chunk of req) raw += chunk;
      req.body = raw ? JSON.parse(raw) : {};
      res.status = (code) => ((res.statusCode = code), res);
      res.json = (body) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(body));
      };
      const { default: handler } = await server.ssrLoadModule(`.${route}.js`);
      await handler(req, res);
    });
  },
};

export default defineConfig({
  plugins: [electionApi],
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        vybory: resolve(import.meta.dirname, "vybory/index.html"),
      },
    },
  },
  css: {
    preprocessorMaxWorkers: 0,
  },
});
