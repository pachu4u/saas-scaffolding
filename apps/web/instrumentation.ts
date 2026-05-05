export async function register() {
  if (process.env['NEXT_RUNTIME'] === 'nodejs') {
    const { register: registerOtel } = await import('@platform/observability/instrumentation');
    registerOtel();
  }
}
