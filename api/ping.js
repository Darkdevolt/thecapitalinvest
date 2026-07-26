export default function handler(req) {
  try {
    return new Response(
      JSON.stringify({ pong: true, time: new Date().toISOString(), node: process.version }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
