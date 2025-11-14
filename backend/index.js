// backend/index.js
// Initialisation des traces (doit être en premier)
require("./tracing");

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const winston = require("winston");
const client = require("prom-client");

const app = express();
const port = process.env.PORT || 3000;

// ---------- Logger Winston ----------
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});
console.log("Logger initialized with level:");
// ---------- Middlewares ----------
app.use(cors());
app.use(express.json());

// Logs HTTP (morgan) redirigés vers Winston
app.use(
  morgan("combined", {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  })
);

// ---------- Metrics Prometheus ----------
const register = new client.Registry();
client.collectDefaultMetrics({ register }); // CPU, mémoire, etc.

const httpRequestCounter = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status"],
});
register.registerMetric(httpRequestCounter);

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const route = req.route && req.route.path ? req.route.path : req.path;
    httpRequestCounter.labels(req.method, route, String(res.statusCode)).inc();
    const duration = Date.now() - start;

    logger.info("request_completed", {
      method: req.method,
      route,
      status: res.statusCode,
      duration_ms: duration,
    });
  });
  next();
});

// ---------- Données /users en mémoire ----------
let users = [
  { id: 1, name: "Alice", email: "alice@example.com" },
  { id: 2, name: "Bob", email: "bob@example.com" },
];

// ---------- Routes ----------
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});
app.get("/hello", (req, res) => {
  res.json({ message: "Hello from CI/CD test!" });
});

app.get("/users", (req, res) => {
  res.json(users);
});

app.post("/users", (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    logger.warn("user_create_invalid", { body: req.body });
    return res.status(400).json({ error: "name and email required" });
  }
  const id = users.length ? users[users.length - 1].id + 1 : 1;
  const newUser = { id, name, email };
  users.push(newUser);
  logger.info("user_created", { user: newUser });
  res.status(201).json(newUser);
});

app.put("/users/:id", (req, res) => {
  const id = Number(req.params.id);
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) {
    logger.warn("user_not_found", { id });
    return res.status(404).json({ error: "User not found" });
  }
  users[index] = { ...users[index], ...req.body, id };
  logger.info("user_updated", { user: users[index] });
  res.json(users[index]);
});

app.delete("/users/:id", (req, res) => {
  const id = Number(req.params.id);
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) {
    logger.warn("user_not_found", { id });
    return res.status(404).json({ error: "User not found" });
  }
  const removed = users.splice(index, 1)[0];
  logger.info("user_deleted", { user: removed });
  res.json({ success: true });
});

// ---------- Démarrage ----------
app.listen(port, () => {
  logger.info(`Backend listening on port ${port}`, { port });
});
