import path from "node:path";
import { serverRoot } from "../config.js";
import { normalize } from "./similarity.js";

// Model keluarga E5 dilatih dengan awalan berbeda untuk pertanyaan dan dokumen.
function prefixesFor(model) {
  return /e5/i.test(model)
    ? { query: "query: ", passage: "passage: " }
    : { query: "", passage: "" };
}

function createLocalEmbedder({ model }) {
  let extractorPromise;
  const prefixes = prefixesFor(model);

  async function getExtractor() {
    if (!extractorPromise) {
      extractorPromise = (async () => {
        const { pipeline, env } = await import("@huggingface/transformers");
        env.cacheDir = path.join(serverRoot, ".cache");
        return pipeline("feature-extraction", model, { dtype: "q8" });
      })();
      extractorPromise.catch(() => {
        extractorPromise = undefined;
      });
    }
    return extractorPromise;
  }

  async function embed(texts) {
    const extractor = await getExtractor();
    const output = await extractor(texts, { pooling: "mean", normalize: true });
    return output.tolist();
  }

  return {
    model,
    warmup: () => getExtractor().then(() => undefined),
    embedQuery: async (text) => (await embed([prefixes.query + text]))[0],
    embedDocuments: (texts) =>
      embed(texts.map((text) => prefixes.passage + text)),
  };
}

function createApiEmbedder({ model, baseUrl, apiKey }) {
  if (!baseUrl)
    throw new Error(
      "EMBEDDING_BASE_URL wajib diisi untuk EMBEDDING_PROVIDER=api",
    );
  const prefixes = prefixesFor(model);

  async function embed(texts) {
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ model, input: texts }),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error(`API embedding gagal (${response.status}): ${detail}`);
    }
    const payload = await response.json();
    return payload.data
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((item) => normalize(item.embedding));
  }

  return {
    model,
    warmup: async () => {},
    embedQuery: async (text) => (await embed([prefixes.query + text]))[0],
    embedDocuments: (texts) =>
      embed(texts.map((text) => prefixes.passage + text)),
  };
}

export function createEmbedder(embeddingConfig) {
  switch (embeddingConfig.provider) {
    case "local":
      return createLocalEmbedder(embeddingConfig);
    case "api":
      return createApiEmbedder(embeddingConfig);
    default:
      throw new Error(
        `EMBEDDING_PROVIDER "${embeddingConfig.provider}" tidak dikenal. Pilihan: local, api`,
      );
  }
}
