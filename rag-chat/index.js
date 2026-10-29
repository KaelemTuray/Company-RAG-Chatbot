const REGION = "us-east-1";
const KB_ID = "XWGIVLOJ61";
const MODEL_ID = "us.amazon.nova-pro-v1:0";

const SYSTEM =
  "You answer questions using ONLY the provided context. " +
  "If the context does not contain the answer, say you don't have that " +
  "information. Be concise and mention which source file you used.";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json", ...CORS });
  res.end(JSON.stringify(body));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 10000) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });

const fileName = (c) =>
  (c.location?.s3Location?.uri || "unknown").split("/").pop();

let clientsPromise;
const getClients = () =>
  (clientsPromise ??= (async () => {
    const a = await import("@aws-sdk/client-bedrock-agent-runtime");
    const b = await import("@aws-sdk/client-bedrock-runtime");
    return {
      a,
      b,
      agent: new a.BedrockAgentRuntimeClient({ region: REGION }),
      bedrock: new b.BedrockRuntimeClient({ region: REGION }),
    };
  })().catch((err) => {
    clientsPromise = undefined;
    throw err;
  }));

async function ask(question) {
  const { a, b, agent, bedrock } = await getClients();

  const r = await agent.send(
    new a.RetrieveCommand({
      knowledgeBaseId: KB_ID,
      retrievalQuery: { text: question },
      retrievalConfiguration: {
        vectorSearchConfiguration: { numberOfResults: 5 },
      },
    })
  );
  const chunks = r.retrievalResults || [];
  const context = chunks
    .map((c) => `[Source: ${fileName(c)}]\n${c.content.text}`)
    .join("\n\n");
  const sources = [...new Set(chunks.map(fileName))].sort();

  const resp = await bedrock.send(
    new b.ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: SYSTEM }],
      messages: [
        {
          role: "user",
          content: [{ text: `Context:\n${context}\n\nQuestion: ${question}` }],
        },
      ],
      inferenceConfig: { maxTokens: 800 },
    })
  );
  return { answer: resp.output.message.content[0].text, sources };
}

async function main() {
  const { createServer } = await import("node:http");

  const server = createServer(async (req, res) => {
    try {
      if (req.method === "OPTIONS") {
        res.writeHead(204, CORS);
        return res.end();
      }
      if (req.method === "GET") return send(res, 200, { status: "ok" });
      if (req.method !== "POST") return send(res, 405, { error: "Use POST" });

      let body;
      try {
        body = JSON.parse((await readBody(req)) || "{}");
      } catch {
        return send(res, 400, { error: "Body must be valid JSON" });
      }
      const question = (body.question || "").trim();
      if (!question) return send(res, 400, { error: "Missing 'question'" });
      if (question.length > 1000)
        return send(res, 400, { error: "Question too long" });

      send(res, 200, await ask(question));
    } catch (err) {
      console.error(err);
      send(res, 500, { error: "Something went wrong", detail: String(err.message || err) });
    }
  });

  const [host, port] = (process.env.AWS_LAMBDA_HTTP_ENDPOINT || "127.0.0.1:3000").split(":");
  server.listen(Number(port), host, () => console.log(`Listening on ${host}:${port}`));

  process.on("SIGTERM", () => process.exit(0));
}

main();
