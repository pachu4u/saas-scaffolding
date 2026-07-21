import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { Resource } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

export function register() {
  const serviceName = process.env.OTEL_SERVICE_NAME ?? 'saas-platform';
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  if (!endpoint) return; // Observability disabled when no endpoint configured

  const sdk = new NodeSDK({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: process.env.GIT_SHA ?? 'dev',
      'deployment.environment': process.env.NODE_ENV ?? 'development',
    }),
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    // @opentelemetry/sdk-node's MetricReader type and @opentelemetry/sdk-metrics'
    // PeriodicExportingMetricReader type don't line up across these package
    // versions — a real upstream version-skew issue, not fixable here.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
      exportIntervalMillis: 30_000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
    instrumentations: [new HttpInstrumentation(), new UndiciInstrumentation()],
  });

  sdk.start();

  process.on('SIGTERM', () => {
    sdk.shutdown().catch(console.error);
  });
}
