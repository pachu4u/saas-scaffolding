// Must live in src/ (this app uses the src/ layout): Next.js only picks up
// instrumentation.ts next to app/, so at the project root it never ran and
// no traces or metrics were ever exported.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { register: registerOtel } = await import('@platform/observability/instrumentation');
    registerOtel();
  }
}
