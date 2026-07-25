export default function handler() {
  return new Response(JSON.stringify({ pong: true, time: new Date().toISOString() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
