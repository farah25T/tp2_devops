// backend/tracing.js
const { NodeSDK } = require("@opentelemetry/sdk-node");
const {
  getNodeAutoInstrumentations,
} = require("@opentelemetry/auto-instrumentations-node");
const {
  OTLPTraceExporter,
} = require("@opentelemetry/exporter-trace-otlp-http");

// Exporter OTLP HTTP (vers Jaeger ou OTEL collector)
const exporter = new OTLPTraceExporter({
  // En local: on pointe sur OTLP HTTP (sera overridé en Docker)
  url:
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    "http://localhost:4318/v1/traces",
});

const sdk = new NodeSDK({
  traceExporter: exporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

// Dans cette version, start() ne retourne pas de Promise → pas de .then()
try {
  sdk.start();
  console.log("OpenTelemetry initialized");
} catch (err) {
  console.error("Error starting OpenTelemetry", err);
}

process.on("SIGTERM", () => {
  sdk
    .shutdown()
    .then(() => {
      console.log("OpenTelemetry shutdown complete");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Error shutting down OpenTelemetry", err);
      process.exit(1);
    });
});
