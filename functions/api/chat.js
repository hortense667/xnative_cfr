export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "GET") {
    return new Response("ok", { status: 200 });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY missing" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const body = await request.json();
  const prompt = body.prompt ?? "";

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
    encodeURIComponent(apiKey);

  const upstream = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  const text = await upstream.text();

  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" }
  });
}
