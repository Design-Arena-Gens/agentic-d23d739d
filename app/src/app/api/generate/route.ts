import { Buffer } from "buffer";
import { NextRequest, NextResponse } from "next/server";

type ComboInput = {
  id: string;
  shotId: string;
  shotLabel: string;
  shotPrompt: string;
  aspectRatio: string;
  modelId: string;
  modelLabel: string;
  modelPrompt: string;
  modelNotes: string;
};

type GeneratePayload = {
  productName?: string;
  highlights?: string;
  vibe: string;
  targetCustomer: string;
  pricePoint: string;
  combos: ComboInput[];
};

type ReplicateSuccess = {
  id: string;
  status: "starting" | "processing" | "canceled" | "failed" | "succeeded";
  error?: string | null;
  output?: unknown;
  urls?: { get: string };
};

type ReplicatePrediction = ReplicateSuccess | { detail?: string; error?: string };

const isReplicateSuccess = (
  payload: ReplicatePrediction,
): payload is ReplicateSuccess =>
  typeof (payload as ReplicateSuccess).id === "string" &&
  typeof (payload as ReplicateSuccess).status === "string";

const REPLICATE_API_URL = "https://api.replicate.com/v1/predictions";
const FALLBACK_MODEL = "black-forest-labs/flux-dev";
const FALLBACK_VERSION =
  "b31258cccc611453ca3b52990d4ec23bafa714a7e3f777510c232fbd65dc9b6f";
const DEFAULT_NEGATIVE =
  "low quality, distorted body, deformed hands, double limb, cropped face, cartoon, text overlay, logo watermark, frame, render artifact";

const VIBE_LIBRARY: Record<
  string,
  { prompt: string; negative: string; label: string }
> = {
  luxury: {
    label: "Luxury Studio",
    prompt:
      "flagship fashion campaign lighting, sculpted softbox highlights, charcoal seamless, medium format depth, cinematic grading",
    negative:
      "flat lighting, amateur, poor contrast, cluttered background, noisy texture",
  },
  lifestyle: {
    label: "Lifestyle Loft",
    prompt:
      "sun-drenched loft, warm bounce lighting, lifestyle storytelling, designer interior details, candid energy",
    negative:
      "overexposed, underexposed, messy background, chaotic composition, motion blur",
  },
  street: {
    label: "Street Style",
    prompt:
      "urban editorial backdrop, shallow depth of field, dusk neon accents, energetic street pose, cinematic crop",
    negative:
      "busy traffic, harsh flash, caricature, cartoon, fisheye distortion",
  },
  catalog: {
    label: "Catalog Ready",
    prompt:
      "calibrated ecommerce lighting, seamless light gray backdrop, precise color accuracy, symmetrical pose, crisp detailing",
    negative:
      "dramatic lighting, harsh shadows, tilted horizon, inconsistent color temperature",
  },
};

const TARGET_LIBRARY: Record<string, string> = {
  "premium-millennial":
    "Designed for premium millennial tastemakers who value elevated daily style.",
  "genz-trend":
    "Tailored to Gen Z trendsetters looking for bold, content-ready statement looks.",
  "bridal-edit":
    "Crafted for modern bridal and occasionwear moments with editorial romance.",
  "mens-classic":
    "Geared towards sharp menswear stylings and refined silhouettes.",
};

const PRICE_LIBRARY: Record<string, string> = {
  accessible:
    "Positioned as accessible luxury — celebrate premium details with approachable polish.",
  premium:
    "Positioned as premium designer — highlight construction, fabric pedigree and elevated finishing.",
  couture:
    "Positioned as couture tier — dramatise tailoring mastery and exclusive craftsmanship.",
};

const ASPECT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "3:4": { width: 768, height: 1024 },
  "4:3": { width: 1024, height: 768 },
  "1:1": { width: 896, height: 896 },
  "9:16": { width: 768, height: 1365 },
};

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const ensureEnv = (name: "REPLICATE_API_TOKEN") => {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Add it to your environment to enable AI generation.`,
    );
  }
  return value;
};

const parsePayload = async (request: NextRequest): Promise<{
  base64Image: string;
  mimeType: string;
  payload: GeneratePayload;
}> => {
  const formData = await request.formData();
  const imageFile = formData.get("image");
  const payloadRaw = formData.get("payload");

  if (!(imageFile instanceof File)) {
    throw new Error("Product image is required.");
  }

  if (typeof payloadRaw !== "string") {
    throw new Error("Missing generation payload.");
  }

  const bytes = Buffer.from(await imageFile.arrayBuffer());
  const mimeType = imageFile.type || "image/png";
  const base64 = bytes.toString("base64");

  let payload: GeneratePayload;
  try {
    payload = JSON.parse(payloadRaw) as GeneratePayload;
  } catch (error) {
    throw new Error("Invalid payload.");
  }

  if (!payload.combos || !Array.isArray(payload.combos)) {
    throw new Error("No generation combos provided.");
  }

  return {
    base64Image: `data:${mimeType};base64,${base64}`,
    mimeType,
    payload,
  };
};

const buildPrompt = (
  combo: ComboInput,
  payload: GeneratePayload,
): { prompt: string; negativePrompt: string } => {
  const vibePreset = VIBE_LIBRARY[payload.vibe] ?? VIBE_LIBRARY.luxury;
  const targetNarrative =
    TARGET_LIBRARY[payload.targetCustomer] ??
    "Designed for aspirational fashion consumers.";
  const priceNarrative =
    PRICE_LIBRARY[payload.pricePoint] ??
    "Highlight refined craftsmanship and premium finishing.";
  const highlights = payload.highlights
    ? `Key fabrication notes: ${payload.highlights}.`
    : "";
  const product =
    payload.productName?.trim() ||
    "the garment provided in the reference image";

  const promptSegments = [
    `Ultra realistic fashion photography of ${product} styled on ${combo.modelPrompt}.`,
    combo.modelNotes,
    combo.shotPrompt,
    vibePreset.prompt,
    priceNarrative,
    targetNarrative,
    highlights,
    "Emphasise true-to-life fabric drape, authentic fit, and tactile texture fidelity.",
    "Shot on medium format camera, impeccable retouching, 8k resolution, editorial grade color science.",
    "Ensure the garment faithfully matches the uploaded reference in color, print, and construction.",
  ].filter(Boolean);

  const negativePrompt = [
    DEFAULT_NEGATIVE,
    vibePreset.negative,
    "unrealistic body, duplicated garment, missing garment, blur, grain, noisy render, sketch, painting",
  ]
    .filter(Boolean)
    .join(", ");

  return {
    prompt: promptSegments.join(" "),
    negativePrompt,
  };
};

const fetchPrediction = async (
  token: string,
  body: Record<string, unknown>,
) => {
  const headers = {
    Authorization: `Token ${token}`,
    "Content-Type": "application/json",
  };

  const response = await fetch(REPLICATE_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Replicate request failed (${response.status}): ${detail}`,
    );
  }

  return (await response.json()) as ReplicatePrediction;
};

const pollPrediction = async (token: string, id: string) => {
  const headers = {
    Authorization: `Token ${token}`,
  };

  const response = await fetch(`${REPLICATE_API_URL}/${id}`, {
    headers,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Polling failed (${response.status}): ${detail}`,
    );
  }

  return (await response.json()) as ReplicatePrediction;
};

const runGeneration = async ({
  combo,
  payload,
  base64Image,
  token,
}: {
  combo: ComboInput;
  payload: GeneratePayload;
  base64Image: string;
  token: string;
}) => {
  const { prompt, negativePrompt } = buildPrompt(combo, payload);
  const dims =
    ASPECT_DIMENSIONS[combo.aspectRatio] ?? ASPECT_DIMENSIONS["3:4"];
  const seed = Math.floor(Math.random() * 1_000_000_000);

  const model = process.env.REPLICATE_MODEL ?? FALLBACK_MODEL;
  const version = process.env.REPLICATE_MODEL_VERSION ?? FALLBACK_VERSION;

  const requestBody = {
    version,
    input: {
      prompt,
      negative_prompt: negativePrompt,
      image: base64Image,
      guidance_scale: 4,
      output_format: "png",
      num_inference_steps: 30,
      width: dims.width,
      height: dims.height,
      seed,
      num_outputs: 1,
      apply_watermark: false,
      disable_safety_checker: true,
    },
  };

  const initial = await fetchPrediction(token, requestBody);

  if (!isReplicateSuccess(initial)) {
    const detail =
      "error" in initial && initial.error
        ? initial.error
        : "detail" in initial && initial.detail
          ? initial.detail
          : "Unexpected response from Replicate when starting generation.";
    throw new Error(
      typeof detail === "string" ? detail : JSON.stringify(detail),
    );
  }

  let current: ReplicateSuccess = initial;
  const startedAt = Date.now();

  while (
    current.status === "starting" ||
    current.status === "processing"
  ) {
    if (Date.now() - startedAt > 120_000) {
      throw new Error("Generation timed out.");
    }
    await sleep(2500);
    const candidate = await pollPrediction(token, current.id);
    if (!isReplicateSuccess(candidate)) {
      const detail =
        "error" in candidate && candidate.error
          ? candidate.error
          : "detail" in candidate && candidate.detail
            ? candidate.detail
            : "Replicate returned an unexpected payload while polling.";
      throw new Error(
        typeof detail === "string" ? detail : JSON.stringify(detail),
      );
    }
    current = candidate;
  }

  if (current.status !== "succeeded") {
    const detail =
      "error" in current && current.error ? current.error : "Unknown failure.";
    throw new Error(
      typeof detail === "string" ? detail : JSON.stringify(detail),
    );
  }

  const outputs = Array.isArray(current.output)
    ? current.output
    : current.output
      ? [current.output]
      : [];

  const imageUrl = outputs.find((item) => typeof item === "string") as
    | string
    | undefined;

  if (!imageUrl) {
    throw new Error("Model completed without returning an image URL.");
  }

  return {
    imageUrl,
    prompt,
    negativePrompt,
    seed,
  };
};

export async function POST(request: NextRequest) {
  try {
    const token = ensureEnv("REPLICATE_API_TOKEN");
    const { base64Image, payload } = await parsePayload(request);

    const results = [];

    for (const combo of payload.combos) {
      try {
        const result = await runGeneration({
          combo,
          payload,
          base64Image,
          token,
        });

        results.push({
          id: combo.id,
          status: "succeeded" as const,
          imageUrl: result.imageUrl,
          prompt: result.prompt,
          negativePrompt: result.negativePrompt,
          seed: result.seed,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Generation error";
        results.push({
          id: combo.id,
          status: "failed" as const,
          prompt: "",
          negativePrompt: "",
          seed: 0,
          error: message,
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json(
      { error: message },
      {
        status: 500,
      },
    );
  }
}
