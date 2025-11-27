"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Loader2, RefreshCw, UploadCloud, Wand2 } from "lucide-react";

type GenerationStatus = "pending" | "processing" | "succeeded" | "failed";

type ComboConfig = {
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

type GenerationItem = ComboConfig & {
  prompt: string;
  negativePrompt: string;
  seed: number;
  status: GenerationStatus;
  imageUrl?: string;
  error?: string;
};

type ServerGeneration = {
  id: string;
  status: GenerationStatus;
  imageUrl?: string;
  prompt: string;
  negativePrompt: string;
  seed: number;
  error?: string;
};

const SHOT_PRESETS = [
  {
    id: "front-hero",
    label: "Front Hero",
    description: "Clean ecommerce hero shot, full body, neutral pose.",
    prompt:
      "front-facing full body hero shot, garment perfectly fitted, subtle pose showcasing silhouette, crisp seamless background, soft edge lighting",
    aspectRatio: "3:4",
  },
  {
    id: "three-quarter",
    label: "3/4 Look",
    description: "Dynamic 3/4 angle for a more editorial feel.",
    prompt:
      "three-quarter angle, model looking slightly past camera, gentle movement in fabric, editorial pose, subtle shadow play",
    aspectRatio: "3:4",
  },
  {
    id: "detail",
    label: "Detail Close-up",
    description: "Focus on craftsmanship and fabric texture.",
    prompt:
      "tight crop highlighting garment craftsmanship, macro lens depth of field, fine fabric texture, hands softly interacting with garment",
    aspectRatio: "1:1",
  },
  {
    id: "movement",
    label: "Motion Shot",
    description: "Adds energy with walking or spinning movement.",
    prompt:
      "dynamic walking movement, flowing fabric captured mid motion, cinematic streaked lighting, runway-inspired energy",
    aspectRatio: "9:16",
  },
] as const;

const MODEL_PRESETS = [
  {
    id: "editorial",
    label: "Editorial Muse",
    prompt:
      "tall editorial runway model, sharp cheekbones, confident expression, poised posture",
    notes: "Runway-ready aesthetic for high-fashion positioning.",
  },
  {
    id: "inclusive",
    label: "Inclusive Fit",
    prompt:
      "curvy plus-size model with glowing skin, natural curls, warm and inviting smile, inclusive beauty standards",
    notes: "Shows size diversity with an aspirational tone.",
  },
  {
    id: "street",
    label: "Streetstyle Creative",
    prompt:
      "streetwear model, short natural curls, expressive pose, energetic attitude, contemporary vibe",
    notes: "Ideal for Gen Z and fashion-forward positioning.",
  },
  {
    id: "masculine",
    label: "Menswear Icon",
    prompt:
      "masculine model with athletic build, clean grooming, charismatic gaze, relaxed confidence",
    notes: "Use for tailored fits or gender-neutral garments.",
  },
] as const;

const VIBE_PRESETS = {
  luxury: {
    label: "Luxury Studio",
    prompt:
      "flagship fashion campaign lighting, sculpted softbox highlights, muted charcoal seamless, medium format photography",
    negative:
      "cartoonish, low detail, distorted body, extra limbs, watermark, text overlay, uncanny hands, blurry",
  },
  lifestyle: {
    label: "Lifestyle Loft",
    prompt:
      "sun-drenched loft, diffused natural light, designer interior styling, candid storytelling",
    negative:
      "low contrast, gloomy, messy background, washed out colors, low-res, logo watermark",
  },
  street: {
    label: "Street Style",
    prompt:
      "urban environment, shallow depth of field, cinematic dusk lighting, neon accents, editorial street shot",
    negative:
      "noisy background, chaotic composition, cartoon, illustration, distorted proportions",
  },
  catalog: {
    label: "Catalog Ready",
    prompt:
      "crisp ecommerce lighting, seamless light gray background, calibrated colors, perfectly centered framing",
    negative:
      "dramatic shadow, motion blur, oversaturated colors, background clutter, pixelation",
  },
} as const;

const TARGET_PROFILES = [
  {
    id: "premium-millennial",
    label: "Premium Millennial",
    description: "Urban professionals investing in quality wardrobe essentials.",
  },
  {
    id: "genz-trend",
    label: "Gen Z Trendsetter",
    description: "Statement making looks for content creators and trend leaders.",
  },
  {
    id: "bridal-edit",
    label: "Modern Bridal",
    description: "Elegant occasionwear with refined, timeless styling.",
  },
  {
    id: "mens-classic",
    label: "Menswear Classic",
    description: "Tailored fits designed for sharp, clean styling.",
  },
] as const;

const PRICE_POINTS = [
  {
    id: "accessible",
    label: "Accessible Luxury",
    narrative:
      "focus on attainable sophistication, highlight value-driven craftsmanship",
  },
  {
    id: "premium",
    label: "Premium Designer",
    narrative:
      "spotlight artisanal details, emphasize premium materials and finishings",
  },
  {
    id: "couture",
    label: "Couture Tier",
    narrative:
      "infuse storytelling with high-fashion drama, couture tailoring and exclusivity",
  },
] as const;

const DEFAULT_NEGATIVE_PROMPT =
  "low quality, deformed, cropped limb, imperfect hands, double body, extra limbs, low resolution, motion blur, watermark, text, logo";

const ASPECT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "3:4": { width: 768, height: 1024 },
  "4:3": { width: 1024, height: 768 },
  "1:1": { width: 896, height: 896 },
  "9:16": { width: 768, height: 1365 },
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [highlights, setHighlights] = useState("");
  const [vibe, setVibe] =
    useState<keyof typeof VIBE_PRESETS>("luxury");
  const [targetCustomer, setTargetCustomer] = useState<string>(
    TARGET_PROFILES[0]?.id ?? "",
  );
  const [pricePoint, setPricePoint] = useState<string>(PRICE_POINTS[1]?.id ?? "");
  const [selectedShots, setSelectedShots] = useState<string[]>(
    SHOT_PRESETS.map((preset) => preset.id),
  );
  const [selectedModels, setSelectedModels] = useState<string[]>(
    MODEL_PRESETS.map((preset) => preset.id),
  );
  const [results, setResults] = useState<GenerationItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const shotOptions = useMemo(() => SHOT_PRESETS, []);
  const modelOptions = useMemo(() => MODEL_PRESETS, []);

  const vibePreset = useMemo(() => VIBE_PRESETS[vibe], [vibe]);
  const targetPreset = useMemo(
    () => TARGET_PROFILES.find((option) => option.id === targetCustomer),
    [targetCustomer],
  );
  const pricePreset = useMemo(
    () => PRICE_POINTS.find((option) => option.id === pricePoint),
    [pricePoint],
  );

  const toggleShot = (id: string) => {
    setSelectedShots((current) =>
      current.includes(id)
        ? current.filter((shotId) => shotId !== id)
        : [...current, id],
    );
  };

  const toggleModel = (id: string) => {
    setSelectedModels((current) =>
      current.includes(id)
        ? current.filter((modelId) => modelId !== id)
        : [...current, id],
    );
  };

  const buildCombos = (): ComboConfig[] => {
    const activeShots = shotOptions.filter((option) =>
      selectedShots.includes(option.id),
    );
    const activeModels = modelOptions.filter((option) =>
      selectedModels.includes(option.id),
    );

    const combos: ComboConfig[] = [];

    activeModels.forEach((model) => {
      activeShots.forEach((shot) => {
        combos.push({
          id: `${model.id}-${shot.id}-${crypto.randomUUID()}`,
          shotId: shot.id,
          shotLabel: shot.label,
          shotPrompt: shot.prompt,
          aspectRatio: shot.aspectRatio,
          modelId: model.id,
          modelLabel: model.label,
          modelPrompt: model.prompt,
          modelNotes: model.notes,
        });
      });
    });

    return combos;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) {
      setFile(null);
      setPreview(null);
      return;
    }
    setFile(nextFile);
    const url = URL.createObjectURL(nextFile);
    setPreview(url);
  };

  const handleSubmit = async () => {
    setErrorMessage(null);

    if (!file) {
      setErrorMessage("Upload a clear product photo before generating looks.");
      return;
    }

    const combos = buildCombos();

    if (!combos.length) {
      setErrorMessage("Select at least one shot type and one model profile.");
      return;
    }

    const pending: GenerationItem[] = combos.map((combo) => ({
      ...combo,
      prompt: "",
      negativePrompt: "",
      seed: Math.floor(Math.random() * 10_000_000),
      status: "processing",
    }));

    setResults(pending);
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append(
        "payload",
        JSON.stringify({
          productName,
          highlights,
          vibe,
          targetCustomer,
          pricePoint,
          combos,
        }),
      );

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error || "Generation failed");
      }

      const body = (await response.json()) as {
        results: ServerGeneration[];
      };

      const enriched: GenerationItem[] = combos.map((combo) => {
        const match = body.results.find((item) => item.id === combo.id);
        if (!match) {
          return {
            ...combo,
            prompt: "",
            negativePrompt: "",
            seed: 0,
            status: "failed",
            error: "Missing generation result",
          };
        }

        return {
          ...combo,
          prompt: match.prompt,
          negativePrompt: match.negativePrompt,
          seed: match.seed,
          status: match.status,
          imageUrl: match.imageUrl,
          error: match.error,
        };
      });

      setResults(enriched);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected error";
      setErrorMessage(message);
      setResults((prev) =>
        prev.map((item) => ({
          ...item,
          status: "failed",
          error: message,
        })),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setProductName("");
    setHighlights("");
    setSelectedModels(MODEL_PRESETS.map((option) => option.id));
    setSelectedShots(SHOT_PRESETS.map((option) => option.id));
    setResults([]);
    setErrorMessage(null);
  };

  const downloadImage = async (url: string, name: string) => {
    const response = await fetch(url);
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(84,94,245,0.22)_0%,_transparent_55%)]" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pb-24 pt-16 md:px-6 lg:px-8">
        <header className="flex flex-col gap-6 rounded-4xl border border-white/10 bg-white/5 p-8 shadow-glow backdrop-blur lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3">
            <span className="inline-flex items-center gap-2 self-start rounded-full border border-brand-500/40 bg-brand-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-100">
              <Wand2 className="size-3.5" />
              AI Model Stylist
            </span>
            <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Transform your garment shots into campaign-ready imagery
            </h1>
            <p className="max-w-2xl text-base text-slate-300">
              Upload a simple product photo and generate on-model visuals across
              diverse talent, angles, and storytelling vibes. Tailor each batch
              for catalogs, marketplaces, and campaign drops in minutes.
            </p>
          </div>
          <div className="relative flex h-full w-full max-w-sm flex-col gap-3 rounded-3xl border border-white/10 bg-brand-500/10 p-6 text-sm text-brand-100 backdrop-blur">
            <div className="absolute -left-24 top-4 hidden h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-glow sm:flex">
              <UploadCloud className="size-5" />
            </div>
            <h2 className="text-lg font-semibold text-white">
              Upload requirements
            </h2>
            <ul className="space-y-2 text-sm leading-relaxed text-slate-200">
              <li>• High resolution garment shot on a neutral background</li>
              <li>• Whole piece visible (front or angled view preferred)</li>
              <li>• Avoid obstructions, heavy shadows, or folded garments</li>
            </ul>
          </div>
        </header>

        <section className="grid gap-8 lg:grid-cols-[1.15fr,0.85fr]">
          <div className="space-y-8 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
            <div className="space-y-6">
              <div>
                <label
                  htmlFor="product-name"
                  className="text-sm font-medium text-slate-300"
                >
                  Product name
                </label>
                <input
                  id="product-name"
                  value={productName}
                  onChange={(event) => setProductName(event.target.value)}
                  placeholder="e.g. Silk Draped Midi Dress"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none transition focus:border-brand-400 focus:bg-white/[0.08]"
                />
              </div>

              <div>
                <label
                  htmlFor="highlights"
                  className="text-sm font-medium text-slate-300"
                >
                  Fabric highlights & styling notes
                </label>
                <textarea
                  id="highlights"
                  value={highlights}
                  onChange={(event) => setHighlights(event.target.value)}
                  placeholder="Bias cut silk charmeuse with pleated waist, pearl button detailing, tonal sash belt."
                  rows={4}
                  className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none transition focus:border-brand-400 focus:bg-white/[0.08]"
                />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Shot variety</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedShots(SHOT_PRESETS.map((item) => item.id))
                    }
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-200 transition hover:border-brand-400 hover:bg-brand-500/10"
                  >
                    Select all
                  </button>
                </div>
                <div className="grid gap-2">
                  {shotOptions.map((shot) => {
                    const isActive = selectedShots.includes(shot.id);
                    return (
                      <button
                        key={shot.id}
                        type="button"
                        onClick={() => toggleShot(shot.id)}
                        className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                          isActive
                            ? "border-brand-400/70 bg-brand-500/10 shadow-glow"
                            : "border-white/10 bg-white/5 hover:border-brand-400/40"
                        }`}
                      >
                        <span
                          className={`mt-1 size-2 rounded-full ${
                            isActive ? "bg-brand-300" : "bg-white/20"
                          }`}
                        />
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {shot.label}
                          </p>
                          <p className="text-xs text-slate-300">
                            {shot.description}
                          </p>
                        </div>
                        <span className="ml-auto rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                          {shot.aspectRatio}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Model lineup</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedModels(MODEL_PRESETS.map((item) => item.id))
                    }
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-200 transition hover:border-brand-400 hover:bg-brand-500/10"
                  >
                    Select all
                  </button>
                </div>
                <div className="grid gap-2">
                  {modelOptions.map((model) => {
                    const isActive = selectedModels.includes(model.id);
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => toggleModel(model.id)}
                        className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                          isActive
                            ? "border-brand-400/70 bg-brand-500/10 shadow-glow"
                            : "border-white/10 bg-white/5 hover:border-brand-400/40"
                        }`}
                      >
                        <span
                          className={`mt-1 size-2 rounded-full ${
                            isActive ? "bg-brand-300" : "bg-white/20"
                          }`}
                        />
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {model.label}
                          </p>
                          <p className="text-xs text-slate-300">
                            {model.notes}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-300">
                  Storytelling vibe
                </p>
                <div className="grid gap-2">
                  {(
                    Object.entries(VIBE_PRESETS) as Array<
                      [
                        keyof typeof VIBE_PRESETS,
                        (typeof VIBE_PRESETS)[keyof typeof VIBE_PRESETS],
                      ]
                    >
                  ).map(([key, option]) => {
                    const isActive = key === vibe;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setVibe(key)}
                        className={`rounded-2xl border px-3 py-2 text-left text-sm transition ${
                          isActive
                            ? "border-brand-400/70 bg-brand-500/10 shadow-glow"
                            : "border-white/10 bg-white/5 hover:border-brand-400/40"
                        }`}
                      >
                        <p className="font-semibold text-white">
                          {option.label}
                        </p>
                        <p className="text-xs text-slate-300">{option.prompt}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-300">
                  Customer profile
                </p>
                <div className="grid gap-2">
                  {TARGET_PROFILES.map((option) => {
                    const isActive = option.id === targetCustomer;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setTargetCustomer(option.id)}
                        className={`rounded-2xl border px-3 py-2 text-left text-sm transition ${
                          isActive
                            ? "border-brand-400/70 bg-brand-500/10 shadow-glow"
                            : "border-white/10 bg-white/5 hover:border-brand-400/40"
                        }`}
                      >
                        <p className="font-semibold text-white">
                          {option.label}
                        </p>
                        <p className="text-xs text-slate-300">
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-300">
                  Price positioning
                </p>
                <div className="grid gap-2">
                  {PRICE_POINTS.map((option) => {
                    const isActive = option.id === pricePoint;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setPricePoint(option.id)}
                        className={`rounded-2xl border px-3 py-2 text-left text-sm transition ${
                          isActive
                            ? "border-brand-400/70 bg-brand-500/10 shadow-glow"
                            : "border-white/10 bg-white/5 hover:border-brand-400/40"
                        }`}
                      >
                        <p className="font-semibold text-white">
                          {option.label}
                        </p>
                        <p className="text-xs text-slate-300">
                          {option.narrative}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6 rounded-3xl border border-dashed border-white/15 bg-white/5 p-6 text-sm text-slate-200">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                  <UploadCloud className="size-5 text-brand-200" />
                </div>
                <div className="flex flex-1 flex-col">
                  <p className="text-base font-semibold text-white">
                    Upload base garment photo
                  </p>
                  <p className="text-xs text-slate-300">
                    PNG, JPG or WebP up to 15MB. A neutral background yields the
                    best results.
                  </p>
                </div>
                {file && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-200 transition hover:border-brand-400 hover:bg-brand-500/10"
                  >
                    Reset
                  </button>
                )}
              </div>

              <label
                htmlFor="file-upload"
                className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-6 py-12 text-center transition hover:border-brand-400/60 hover:bg-brand-500/5"
              >
                {preview ? (
                  <div className="grid w-full gap-3">
                    <div className="relative mx-auto h-56 w-full max-w-xs overflow-hidden rounded-3xl border border-white/10">
                      <Image
                        src={preview}
                        fill
                        alt="Uploaded garment preview"
                        className="object-cover"
                      />
                    </div>
                    <p className="text-xs text-slate-300">
                      Drop a new file or click to replace the current photo.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex size-16 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-brand-200 transition group-hover:border-brand-400 group-hover:text-brand-100">
                      <UploadCloud className="size-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-white">
                        Drag & drop or browse your garment photo
                      </p>
                      <p className="text-xs text-slate-300">
                        We&apos;ll keep it private and only use it to generate
                        AI looks.
                      </p>
                    </div>
                  </>
                )}
                <input
                  id="file-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="inline-flex items-center gap-3 rounded-2xl border border-brand-400/80 bg-brand-500/30 px-6 py-3 text-base font-semibold text-white transition hover:border-brand-200 hover:bg-brand-500/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Generating looks…
                  </>
                ) : (
                  <>
                    <Wand2 className="size-4" />
                    Generate collection
                  </>
                )}
              </button>
              <div className="text-sm text-slate-400">
                {selectedShots.length * selectedModels.length} looks will be
                generated per batch.
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-2xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
            <h2 className="text-lg font-semibold text-white">
              Creative direction summary
            </h2>
            <div className="space-y-4 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Narrative
                </p>
                <p className="mt-1 text-sm text-white">
                  {pricePreset?.narrative}
                </p>
                {targetPreset ? (
                  <p className="mt-2 text-xs text-slate-400">
                    Targeting {targetPreset.label}: {targetPreset.description}
                  </p>
                ) : null}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Visual vibe
                </p>
                <p className="mt-1 text-sm text-white">{vibePreset?.label}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {vibePreset?.prompt}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Output plan
                </p>
                <ul className="mt-2 space-y-2 text-xs text-slate-300">
                  {selectedModels.map((modelId) => {
                    const model = modelOptions.find((item) => item.id === modelId);
                    if (!model) return null;
                    return (
                      <li key={model.id} className="rounded-xl bg-white/[0.03] px-3 py-2">
                        <span className="font-semibold text-white">
                          {model.label}
                        </span>
                        <span className="block text-slate-400">
                          {model.notes}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Shot list
                </p>
                <div className="mt-2 grid gap-2 text-xs text-slate-300">
                  {selectedShots.map((shotId) => {
                    const shot = shotOptions.find((item) => item.id === shotId);
                    if (!shot) return null;
                    return (
                      <div
                        key={shot.id}
                        className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2"
                      >
                        <span className="font-medium text-white">
                          {shot.label}
                        </span>
                        <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                          {shot.aspectRatio}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {results.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-brand-500/10 p-4 text-xs text-brand-100">
                <p className="font-semibold text-white">
                  Generation tip
                </p>
                <p className="mt-1 text-[13px] text-slate-200">
                  Need marketplace-ready packshots? Switch to Catalog vibe and
                  keep only Front Hero & Detail shots for consistent outputs.
                </p>
              </div>
            )}
          </aside>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">
                Generated lookbook
              </h2>
              <p className="text-sm text-slate-300">
                High-resolution outputs optimised for ecommerce, campaigns and
                social drops.
              </p>
            </div>
            {results.length > 0 && (
              <button
                type="button"
                onClick={() => setResults([])}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-brand-400 hover:bg-brand-500/10"
              >
                <RefreshCw className="size-4" />
                Clear board
              </button>
            )}
          </div>

          {results.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-12 text-center text-sm text-slate-300">
              Once you generate a batch, your styled outputs will appear here.
              Each card will include the exact prompt and settings used so you
              can regenerate or tweak future campaigns quickly.
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {results.map((item) => (
                <article
                  key={item.id}
                  className="flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/5"
                >
                  <div className="relative aspect-[3/4] overflow-hidden">
                    {item.status === "succeeded" && item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={`${item.modelLabel} - ${item.shotLabel}`}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-content-center bg-slate-900/80 text-center text-sm text-slate-400">
                        {item.status === "failed" ? (
                          <p>{item.error ?? "Generation failed"}</p>
                        ) : (
                          <div className="flex flex-col items-center gap-3 text-slate-300">
                            <Loader2 className="size-8 animate-spin text-brand-200" />
                            <p>Stylizing {item.modelLabel}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-4 p-4">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {item.modelLabel}
                      </p>
                      <p className="text-xs text-slate-300">{item.shotLabel}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-[11px] text-slate-300">
                      <p className="font-semibold text-white">Prompt</p>
                      <p className="mt-1 leading-relaxed text-slate-300">
                        {item.prompt}
                      </p>
                      <p className="mt-2 font-semibold text-white">
                        Negative prompt
                      </p>
                      <p className="mt-1 leading-relaxed text-slate-400">
                        {item.negativePrompt}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Seed {item.seed}</span>
                      {item.status === "succeeded" && item.imageUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            downloadImage(
                              item.imageUrl!,
                              `${productName || "look"}-${item.modelId}-${item.shotId}.png`,
                            )
                          }
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-200 transition hover:border-brand-400 hover:bg-brand-500/10"
                        >
                          Download
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="border-t border-white/10 pt-8 text-xs text-slate-400">
          <p>
            Need marketplace-specific templates? Duplicate this project and
            adjust the prompt presets for Amazon, Zalando, Farfetch, or your own
            brand guidelines. Outputs are ready for instant merchandising.
          </p>
        </footer>
      </div>
    </main>
  );
}
