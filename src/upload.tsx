import {
  AlertCircle,
  CheckCircle,
  Link as LinkIcon,
  Newspaper,
  Upload,
  X,
  Youtube,
  FileImage,
  Loader2,
  Sparkles,
  Tag,
	Utensils,
} from "lucide-react";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

import { createFDCClient, newsapi } from "@/lib/api";
// ───────────────────────────────────────────────────────────────────────────────
// Types (unchanged)
// ───────────────────────────────────────────────────────────────────────────────
interface ImageFile {
  file: File;
  preview: string;
  id: string;
  size: number;
  type: string;
  lastModified: number;
}

interface ValidationError {
  type: "size" | "format" | "dimensions" | "security" | "general";
  message: string;
}

interface ImageUploadProps {
  maxFiles?: number;
  maxSize?: number; // in bytes
  acceptedFormats?: string[];
  maxWidth?: number;
  maxHeight?: number;
  onUpload?: (files: ImageFile[]) => void;
  onError?: (errors: ValidationError[]) => void;
  className?: string;
}

interface UploadState {
  files: ImageFile[];
  errors: ValidationError[];
  isUploading: boolean;
  dragActive: boolean;
}

/** Reverse-image (Vision Web Detection) payload normalized by your server.ts */
type WebDetect = {
  webEntities: { description?: string; score?: number }[];
  fullMatchingImages: { url: string }[];
  partialMatchingImages: { url: string }[];
  pagesWithMatchingImages: { url: string; pageTitle?: string }[];
};

type Category = "Food" | "Clothes" | "Drugs" | "Technology" | "Unknown";

type PipelineMeta = {
  primaryQuery: string;
  labels: string[];
};

type NewsHit = { title: string; url: string; source: string; publishedAt?: string };
type CSEResult = { title: string; link: string; snippet: string; thumbnail?: { src: string; width: string; height: string } };
type YTHit = { title: string; videoId: string };
type Nutrient = { id: number; name: string; unit: string; value: number };
type FoodBlock = { fdcId?: number; description?: string; nutrients?: Nutrient[] };

type Insights = {
  meta: PipelineMeta;
  category: Category;
  news?: NewsHit[];
  cse?: CSEResult[];
  youtube?: YTHit[];
  food?: FoodBlock;
};

type PipelineResult = {
  id: string;
  detect: WebDetect;
  insights: Insights;
  error?: string;
};

// ───────────────────────────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────────────────────────
const SecureImageUpload: React.FC<ImageUploadProps> = ({
  maxFiles = 5,
  maxSize = 5 * 1024 * 1024, // 5MB default
  acceptedFormats = ["image/jpeg", "image/jpg", "image/png", "image/webp"],
  maxWidth = 4000,
  maxHeight = 4000,
  onUpload,
  onError,
  className = "",
}) => {
  const [state, setState] = useState<UploadState>({
    files: [],
    errors: [],
    isUploading: false,
    dragActive: false,
  });

  const [results, setResults] = useState<Record<string, PipelineResult | undefined>>({});
  const [processingProgress, setProcessingProgress] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Instantiate remaining API clients ───────────────────────────────────────
  // (Retain real API usage, but you can swap in mockApiCall for demo/dev)
  const api = useMemo(() => {
    return {
      fdc: createFDCClient(import.meta.env.VITE_FOOD_API_KEY ?? ""),
      news: newsapi,
    };
  }, []);

  // ── Security validation helpers (unchanged) ─────────────────────────────────
  const validateFileSignature = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const arr = new Uint8Array(e.target?.result as ArrayBuffer).subarray(0, 4);
        let header = "";
        for (let i = 0; i < arr.length; i++) header += arr[i].toString(16).padStart(2, "0");
        const validSignatures: Record<string, string> = {
          ffd8ffe0: "jpeg", ffd8ffe1: "jpeg", ffd8ffe2: "jpeg", ffd8ffe3: "jpeg", ffd8ffe8: "jpeg",
          "89504e47": "png", "47494638": "gif", "52494646": "webp",
        };
        const isValid = Object.keys(validSignatures).some((s) => header.startsWith(s.toLowerCase()));
        resolve(isValid);
      };
      reader.readAsArrayBuffer(file.slice(0, 4));
    });
  };

  const validateImageDimensions = (file: File): Promise<{ width: number; height: number; valid: boolean }> =>
    new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.width, height: img.height, valid: img.width <= maxWidth && img.height <= maxHeight });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ width: 0, height: 0, valid: false });
      };
      img.src = url;
    });

  const validateFile = async (file: File): Promise<ValidationError[]> => {
    const errors: ValidationError[] = [];
    if (file.size > maxSize)
      errors.push({
        type: "size",
        message: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds max (${(maxSize / 1024 / 1024).toFixed(2)}MB)`,
      });
    if (!acceptedFormats.includes(file.type))
      errors.push({ type: "format", message: `File format ${file.type} not allowed` });

    const hasValidSignature = await validateFileSignature(file);
    if (!hasValidSignature) errors.push({ type: "security", message: "File signature invalid (not a recognized image)" });

    if (hasValidSignature) {
      try {
        const d = await validateImageDimensions(file);
        if (!d.valid)
          errors.push({
            type: "dimensions",
            message: `Image ${d.width}x${d.height} exceeds ${maxWidth}x${maxHeight}`,
          });
      } catch {
        errors.push({ type: "general", message: "Failed to validate dimensions" });
      }
    }
    return errors;
  };

  // ── Vision → Metadata → Category ────────────────────────────────────────────
  async function reverseImage(file: File): Promise<WebDetect> {
    const fd = new FormData();
    fd.append("file", file, file.name);
    const res = await fetch("/api/reverse-image", { method: "POST", body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Vision error: ${JSON.stringify(err)}`);
    }
    const { data } = await res.json();
    return data as WebDetect;
  }

  function extractMeta(d: WebDetect): PipelineMeta {
    const labels = (d.webEntities || [])
      .map((e) => (e.description ?? "").trim())
      .filter(Boolean)
      .slice(0, 6);

    const pageTerms = (d.pagesWithMatchingImages || [])
      .flatMap((p) => (p.pageTitle ?? "").split(/[\|\-–—:]/))
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6);

    const primary = (labels[0] ?? pageTerms[0] ?? "").trim();
    const extra = labels[1] ?? pageTerms[1] ?? "";
    const primaryQuery = [primary, extra].filter(Boolean).join(" ");

    return { primaryQuery: primaryQuery || "product", labels };
  }

  function determineCategory(meta: PipelineMeta): Category {
    const q = `${meta.primaryQuery} ${meta.labels.join(" ")}`.toLowerCase();
    const has = (...k: string[]) => k.some((s) => q.includes(s));
    if (has("calorie", "nutrition", "kcal", "ingredients", "fdc", "food")) return "Food";
    if (has("shirt", "t-shirt", "hoodie", "sneaker", "shoe", "jeans", "dress", "jacket")) return "Clothes";
    if (has("tablet", "capsule", "mg", "rx", "prescription", "drug", "otc")) return "Drugs";
    if (has("laptop", "phone", "cpu", "gpu", "camera", "tech", "headphones", "keyboard", "ssd", "router")) return "Technology";
    return "Unknown";
  }

  // ── News (Effect-based GNews + NewsAPI fallback) ─────────────────────────────
  async function getNews(meta: PipelineMeta): Promise<NewsHit[]> {
    const hits: NewsHit[] = [];
    try {
      // @ts-ignore
      const { gnewsSearch, gnewsTopHeadlines } = await import("@/core");
      const g = await gnewsSearch(meta.primaryQuery, { lang: "en", max: 4 });
      hits.push(
        ...(g.articles || []).map((a: any) => ({
          title: a.title,
          url: a.url,
          source: a.source?.name,
          publishedAt: a.publishedAt,
        }))
      );
    } catch (e) {
      console.warn("GNews error", e);
    }
    if (hits.length < 2) {
      try {
        // @ts-ignore
        const { gnewsTopHeadlines } = await import("@/core");
        const top = await gnewsTopHeadlines({ lang: "en", max: 2 });
        hits.push(
          ...(top.articles || []).map((a: any) => ({
            title: a.title,
            url: a.url,
            source: a.source?.name,
            publishedAt: a.publishedAt,
          }))
        );
      } catch (topErr) {
        console.warn("GNews top error", topErr);
      }
    }
    const seen = new Set<string>();
    return hits.filter((h) => h.url && !seen.has(h.url) && seen.add(h.url));
  }

  // ── Non-Primitive Pipelines ────────────────────────────────────────────────
  async function runFoodPipeline(meta: PipelineMeta): Promise<FoodBlock> {
    try {
      // try Branded > fallback Foundation
      const found =
        (await api.fdc.findFood(meta.primaryQuery, ["Branded"])) ||
        (await api.fdc.findFood(meta.primaryQuery, ["Foundation"]));
      if (!found) return {};
      const wanted = [208, 203, 204, 205, 269, 307, 601]; // kcals, protein, fat, carbs, sugars, sodium, cholesterol
      const nutrs = await api.fdc.getFoodNutrients(found.fdcId, wanted);
      const nutrients: Nutrient[] = (nutrs || []).map((n: any) => ({
        id: n.nutrient.id,
        name: n.nutrient.name,
        unit: n.nutrient.unitName,
        value: n.amount,
      }));
      return { fdcId: found.fdcId, description: found.description, nutrients };
    } catch (e) {
      console.warn("FDC error", e);
      return {};
    }
  }

  async function runClothesPipeline(meta: PipelineMeta) {
    // @ts-ignore
    const { googleSearch, youtubeSearch } = await import("@/core");
    const [cse, yt] = await Promise.allSettled([
      googleSearch(`${meta.primaryQuery} reviews`),
      youtubeSearch(`${meta.primaryQuery} review`),
    ]);

    return {
      cse: cse.status === "fulfilled" && cse.value?.items ? cse.value.items.slice(0, 5) : [],
      youtube:
        yt.status === "fulfilled" && yt.value?.items
          ? yt.value.items.slice(0, 4).map((it: any) => ({
              title: it.snippet?.title || it.title,
              videoId: it.id?.videoId || it.videoId,
            }))
          : [],
    };
  }

  async function runDrugsPipeline(meta: PipelineMeta) {
    // @ts-ignore
    const { googleSearch, youtubeSearch } = await import("@/core");
    const [cse, yt] = await Promise.allSettled([
      googleSearch(
        `${meta.primaryQuery} dosage side effects site:drugs.com OR site:rxlist.com OR site:mayoclinic.org`
      ),
      youtubeSearch(`${meta.primaryQuery} overview`),
    ]);

    return {
      cse: cse.status === "fulfilled" && cse.value?.items ? cse.value.items.slice(0, 5) : [],
      youtube:
        yt.status === "fulfilled" && yt.value?.items
          ? yt.value.items.slice(0, 3).map((it: any) => ({
              title: it.snippet?.title || it.title,
              videoId: it.id?.videoId || it.videoId,
            }))
          : [],
    };
  }

  async function runTechPipeline(meta: PipelineMeta) {
    // @ts-ignore
    const { googleSearch, youtubeSearch } = await import("@/core");
    const [cse, yt] = await Promise.allSettled([
      googleSearch(`${meta.primaryQuery} specs review`),
      youtubeSearch(`${meta.primaryQuery} review`),
    ]);

    return {
      cse: cse.status === "fulfilled" && cse.value?.items ? cse.value.items.slice(0, 6) : [],
      youtube:
        yt.status === "fulfilled" && yt.value?.items
          ? yt.value.items.slice(0, 4).map((it: any) => ({
              title: it.snippet?.title || it.title,
              videoId: it.id?.videoId || it.videoId,
            }))
          : [],
    };
  }

  // ── Orchestrator per image ─────────────────────────────────────────────────
  async function runPipelineForImage(image: ImageFile): Promise<PipelineResult> {
    setProcessingProgress((prev) => ({ ...prev, [image.id]: 10 }));
    const detect = await reverseImage(image.file);
    setProcessingProgress((prev) => ({ ...prev, [image.id]: 30 }));
    const meta = extractMeta(detect);
    const category = determineCategory(meta);
    setProcessingProgress((prev) => ({ ...prev, [image.id]: 50 }));

    const news = await getNews(meta);
    setProcessingProgress((prev) => ({ ...prev, [image.id]: 70 }));

    let cat: Partial<Insights> = {};
    if (category === "Food") {
      const food = await runFoodPipeline(meta);
      cat = { food };
    } else if (category === "Clothes") {
      const { cse, youtube } = await runClothesPipeline(meta);
      cat = { cse, youtube };
    } else if (category === "Drugs") {
      const { cse, youtube } = await runDrugsPipeline(meta);
      cat = { cse, youtube };
    } else {
      const { cse, youtube } = await runTechPipeline(meta);
      cat = { cse, youtube };
    }

    setProcessingProgress((prev) => ({ ...prev, [image.id]: 100 }));

    const insights: Insights = {
      meta,
      category,
      news,
      ...cat,
    };

    return { id: image.id, detect, insights };
  }

  // ── Process files (existing) + pipeline kick-off ───────────────────────────
  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);

      setState((prev) => ({ ...prev, isUploading: true, errors: [] }));

      if (state.files.length + files.length > maxFiles) {
        const error: ValidationError = {
          type: "general",
          message: `Cannot upload more than ${maxFiles} files. Current: ${state.files.length}, Attempting: ${files.length}`,
        };
        setState((prev) => ({ ...prev, errors: [error], isUploading: false }));
        onError?.([error]);
        return;
      }

      const processedFiles: ImageFile[] = [];
      const allErrors: ValidationError[] = [];

      for (const file of files) {
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const sanitizedFile = new File([file], sanitizedName, { type: file.type });

        const errors = await validateFile(sanitizedFile);

        if (errors.length === 0) {
          const imageFile: ImageFile = {
            file: sanitizedFile,
            preview: URL.createObjectURL(sanitizedFile),
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            size: sanitizedFile.size,
            type: sanitizedFile.type,
            lastModified: sanitizedFile.lastModified,
          };
          processedFiles.push(imageFile);

          // Kick off the full pipeline for this image (with progress)
          runPipelineForImage(imageFile)
            .then((r) => {
              setResults((prev) => ({ ...prev, [imageFile.id]: r }));
              setProcessingProgress((prev) => {
                const copy = { ...prev };
                delete copy[imageFile.id];
                return copy;
              });
            })
            .catch((e) => {
              setResults((prev) => ({
                ...prev,
                [imageFile.id]: {
                  id: imageFile.id,
                  detect: { webEntities: [], fullMatchingImages: [], partialMatchingImages: [], pagesWithMatchingImages: [] },
                  insights: { meta: { primaryQuery: imageFile.file.name, labels: [] }, category: "Unknown" },
                  error: String(e),
                },
              }));
              setProcessingProgress((prev) => {
                const copy = { ...prev };
                delete copy[imageFile.id];
                return copy;
              });
            });
        } else {
          allErrors.push(...errors);
        }
      }

      setState((prev) => ({
        ...prev,
        files: [...prev.files, ...processedFiles],
        errors: allErrors,
        isUploading: false,
      }));

      if (processedFiles.length > 0) onUpload?.(processedFiles);
      if (allErrors.length > 0) onError?.(allErrors);
    },
    [state.files.length, maxFiles, maxSize, acceptedFormats, maxWidth, maxHeight, onUpload, onError, api]
  );

  // ── DnD handlers (unchanged) ───────────────────────────────────────────────
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setState((prev) => ({ ...prev, dragActive: false }));
      const files = e.dataTransfer.files;
      if (files.length > 0) processFiles(files);
    },
    [processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setState((prev) => ({ ...prev, dragActive: true }));
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setState((prev) => ({ ...prev, dragActive: false }));
  }, []);
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) processFiles(files);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [processFiles]
  );

  const removeFile = useCallback((id: string) => {
    setState((prev) => {
      const updatedFiles = prev.files.filter((file) => {
        if (file.id === id) {
          URL.revokeObjectURL(file.preview);
          return false;
        }
        return true;
      });
      setResults((r) => {
        const copy = { ...r };
        delete copy[id];
        return copy;
      });
      setProcessingProgress((p) => {
        const copy = { ...p };
        delete copy[id];
        return copy;
      });
      return { ...prev, files: updatedFiles };
    });
  }, []);

  const clearAll = useCallback(() => {
    state.files.forEach((file) => URL.revokeObjectURL(file.preview));
    setState((prev) => ({ ...prev, files: [], errors: [] }));
    setResults({});
    setProcessingProgress({});
  }, [state.files]);

  React.useEffect(() => {
    return () => {
      state.files.forEach((file) => URL.revokeObjectURL(file.preview));
    };
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / k ** i).toFixed(2)) + " " + sizes[i];
  };

  const getCategoryColor = (category: Category) => {
    const colors: Record<Category, string> = {
      Food: "bg-green-100 text-green-800 border-green-200",
      Clothes: "bg-purple-100 text-purple-800 border-purple-200",
      Drugs: "bg-red-100 text-red-800 border-red-200",
      Technology: "bg-blue-100 text-blue-800 border-blue-200",
      Unknown: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return colors[category] || colors.Unknown;
  };

  // ── UI ──────────────────────────────────────────────────────────────────────
  return (
    <div className={`w-full max-w-7xl mx-auto space-y-8 ${className}`}>
      {/* Enhanced Header Section */}
      <div className="text-center space-y-4 py-8">
        <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-accent/10 to-primary/10 rounded-full border border-accent/20">
          <Sparkles className="w-5 h-5 text-accent animate-pulse" />
          <span className="text-sm font-medium text-foreground">AI-Powered Image Analysis</span>
        </div>
        <h1 className="text-4xl font-bold text-foreground tracking-tight">Upload & Analyze Your Images</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Drop your images and let our AI provide instant insights, from object detection to nutritional analysis and
          web research.
        </p>
      </div>

      {/* Enhanced Upload Area */}
      <Card className="relative overflow-hidden bg-gradient-to-br from-card to-muted/30 border-2 border-dashed border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
        <div
          className={`
            relative p-16 text-center transition-all duration-500 cursor-pointer group
            ${
              state.dragActive
                ? "border-accent bg-accent/5 scale-[1.02] shadow-2xl animate-pulse-glow"
                : "hover:border-accent/60 hover:bg-accent/5 hover:scale-[1.01]"
            }
            ${state.isUploading ? "opacity-60 pointer-events-none" : ""}
          `}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={acceptedFormats.join(",")}
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={state.isUploading}
          />

          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.3),transparent_50%)]" />
          </div>

          <div className="relative flex flex-col items-center space-y-6">
            <div
              className={`
              p-6 rounded-full transition-all duration-300 group-hover:scale-110
              ${
                state.dragActive
                  ? "bg-accent/20 animate-float"
                  : "bg-gradient-to-br from-accent/10 to-primary/10 group-hover:from-accent/20 group-hover:to-primary/20"
              }
            `}
            >
              {state.isUploading ? (
                <Loader2 className="w-12 h-12 text-accent animate-spin" />
              ) : (
                <Upload
                  className={`w-12 h-12 transition-colors duration-300 ${
                    state.dragActive ? "text-accent" : "text-muted-foreground group-hover:text-accent"
                  }`}
                />
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-foreground">
                {state.isUploading ? "Processing your images..." : "Drop images here or click to browse"}
              </h3>
              <p className="text-muted-foreground text-lg">
                Upload up to {maxFiles} files, max {formatFileSize(maxSize)} each
              </p>

              {/* Enhanced Format Badges */}
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {acceptedFormats.map((format) => (
                  <Badge
                    key={format}
                    variant="outline"
                    className="text-xs font-medium px-3 py-1 bg-card/50 border-accent/30 text-accent hover:bg-accent/10 transition-colors"
                  >
                    {format.split("/")[1].toUpperCase()}
                  </Badge>
                ))}
              </div>

              {/* Call to Action Button */}
              {!state.isUploading && (
                <Button
                  size="lg"
                  className="mt-6 bg-gradient-to-r from-accent to-primary hover:from-accent/90 hover:to-primary/90 text-white font-semibold px-8 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Get Started
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Enhanced Error Messages */}
      {state.errors.length > 0 && (
        <Alert variant="destructive" className="border-l-4 border-l-destructive bg-destructive/5 shadow-md">
          <AlertCircle className="h-5 w-5" />
          <AlertDescription className="text-base">
            <div className="space-y-2">
              {state.errors.map((error, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-destructive rounded-full" />
                  {error.message}
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Enhanced File List + Insights */}
      {state.files.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between p-6 bg-gradient-to-r from-card to-muted/30 rounded-xl border shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent/10 rounded-full">
                <FileImage className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Uploaded Images</h3>
                <p className="text-muted-foreground">
                  {state.files.length} of {maxFiles} images ready for analysis
                </p>
              </div>
              <Badge variant="secondary" className="ml-4 px-4 py-2 text-base font-semibold">
                {state.files.length}/{maxFiles}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="lg"
              onClick={clearAll}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 font-medium bg-transparent"
            >
              <X className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {state.files.map((imageFile) => {
              const r = results[imageFile.id]
              const progress = processingProgress[imageFile.id]
              const isProcessing = progress !== undefined

              return (
                <Card
                  key={imageFile.id}
                  className="group overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:scale-[1.02] bg-gradient-to-br from-card to-muted/20 border-border/50"
                >
                  <div className="relative">
                    <div className="aspect-square bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center overflow-hidden">
                      <img
                        src={imageFile.preview || "/placeholder.svg"}
                        alt={imageFile.file.name}
                        className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-110"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = "none"
                          const parent = target.parentElement
                          if (parent) {
                            const icon = document.createElement("div")
                            icon.innerHTML =
                              '<div class="flex items-center justify-center"><svg class="w-16 h-16 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></div>'
                            parent.appendChild(icon)
                          }
                        }}
                      />
                    </div>

                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-3 right-3 h-9 w-9 p-0 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg hover:scale-110"
                      onClick={() => removeFile(imageFile.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>

                    {isProcessing && (
                      <div className="absolute inset-0 bg-background/90 backdrop-blur-md flex items-center justify-center">
                        <div className="text-center space-y-4 p-6">
                          <div className="relative">
                            <Loader2 className="w-12 h-12 animate-spin mx-auto text-accent" />
                            <div className="absolute inset-0 w-12 h-12 mx-auto border-4 border-accent/20 rounded-full animate-pulse-glow" />
                          </div>
                          {/* Placeholder for Progress component */}
                          <div className="w-40 h-2 bg-accent/10 rounded-full"></div>
                          <p className="text-sm font-medium text-foreground">Analyzing with AI...</p>
                          <div className="animate-shimmer h-1 w-32 mx-auto rounded" />
                        </div>
                      </div>
                    )}
                  </div>

                  <CardHeader className="pb-4 space-y-3">
                    <CardTitle className="text-base font-bold truncate text-foreground" title={imageFile.file.name}>
                      {imageFile.file.name}
                    </CardTitle>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground font-medium">
                        {formatFileSize(imageFile.size)}
                      </span>
                      <div className="flex items-center gap-2 px-3 py-1 bg-green-50 dark:bg-green-900/20 rounded-full">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700 dark:text-green-400">Valid</span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0 space-y-6">
                    {r?.error && (
                      <Alert variant="destructive" className="py-3 border-l-4 border-l-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-sm font-medium">Analysis failed: {r.error}</AlertDescription>
                      </Alert>
                    )}

                    {r && !r.error && (
                      <>
                        {/* Enhanced Category and Labels */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-accent/10 rounded-lg">
                              <Sparkles className="w-4 h-4 text-accent" />
                            </div>
                            <Badge className={`${getCategoryColor(r.insights.category)} px-3 py-1 font-semibold`}>
                              {r.insights.category}
                            </Badge>
                          </div>

                          {r.insights.meta.labels.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <Tag className="w-4 h-4" />
                                <span>Detected Objects</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {r.insights.meta.labels.slice(0, 4).map((label, i) => (
                                  <Badge
                                    key={i}
                                    variant="outline"
                                    className="text-xs font-medium px-2 py-1 bg-muted/50 hover:bg-accent/10 transition-colors"
                                  >
                                    {label}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <Separator className="bg-border/50" />

                        {/* Enhanced News Section */}
                        {r.insights.news && r.insights.news.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 text-sm font-bold text-foreground">
                              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <Newspaper className="w-4 h-4 text-blue-600" />
                              </div>
                              Latest News
                            </div>
                            <ScrollArea className="h-24">
                              <div className="space-y-3">
                                {r.insights.news.slice(0, 2).map((n, i) => (
                                  <a
                                    key={i}
                                    href={n.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block text-sm text-accent hover:text-accent/80 hover:underline leading-relaxed font-medium transition-colors p-2 hover:bg-accent/5 rounded-md"
                                  >
                                    {n.title}
                                  </a>
                                ))}
                              </div>
                            </ScrollArea>
                          </div>
                        )}

                        {/* Enhanced Food Nutrients */}
                        {r.insights.food?.nutrients && r.insights.food.nutrients.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 text-sm font-bold text-foreground">
                              <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                <Utensils className="w-4 h-4 text-green-600" />
                              </div>
                              Nutrition Facts
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              {r.insights.food.nutrients.slice(0, 4).map((n) => (
                                <div
                                  key={n.id}
                                  className="bg-gradient-to-br from-muted/50 to-muted/30 rounded-lg p-3 border border-border/30 hover:border-accent/30 transition-colors"
                                >
                                  <div className="text-sm font-bold text-foreground">{n.name}</div>
                                  <div className="text-xs text-muted-foreground font-medium">
                                    {n.value} {n.unit}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Enhanced Web Results */}
                        {r.insights.cse && r.insights.cse.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 text-sm font-bold text-foreground">
                              <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                <LinkIcon className="w-4 h-4 text-purple-600" />
                              </div>
                              Web Results
                            </div>
                            <ScrollArea className="h-24">
                              <div className="space-y-3">
                                {r.insights.cse.slice(0, 3).map((c, i) => (
                                  <a
                                    key={i}
                                    href={c.link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block text-sm text-accent hover:text-accent/80 hover:underline leading-relaxed font-medium transition-colors p-2 hover:bg-accent/5 rounded-md"
                                  >
                                    {c.title}
                                  </a>
                                ))}
                              </div>
                            </ScrollArea>
                          </div>
                        )}

                        {/* Enhanced YouTube Videos */}
                        {r.insights.youtube && r.insights.youtube.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 text-sm font-bold text-foreground">
                              <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                <Youtube className="w-4 h-4 text-red-600" />
                              </div>
                              Related Videos
                            </div>
                            <ScrollArea className="h-24">
                              <div className="space-y-3">
                                {r.insights.youtube.slice(0, 2).map((v, i) => (
                                  <a
                                    key={i}
                                    href={`https://www.youtube.com/watch?v=${v.videoId}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block text-sm text-accent hover:text-accent/80 hover:underline leading-relaxed font-medium transition-colors p-2 hover:bg-accent/5 rounded-md"
                                  >
                                    {v.title}
                                  </a>
                                ))}
                              </div>
                            </ScrollArea>
                          </div>
                        )}
                      </>
                    )}

                    {!r && !isProcessing && (
                      <div className="text-center py-8 space-y-4">
                        <div className="p-4 bg-gradient-to-br from-accent/10 to-primary/10 rounded-full w-fit mx-auto">
                          <FileImage className="w-10 h-10 text-accent" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-foreground">Ready for AI Analysis</p>
                          <p className="text-xs text-muted-foreground">Click analyze to get insights</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Enhanced Empty State */}
      {state.files.length === 0 && !state.isUploading && (
        <Card className="border-2 border-dashed border-border/50 bg-gradient-to-br from-card to-muted/20 shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-6">
            <div className="relative">
              <div className="p-6 bg-gradient-to-br from-accent/10 to-primary/10 rounded-full animate-float">
                <FileImage className="w-12 h-12 text-accent" />
              </div>
              <div className="absolute -top-2 -right-2 p-2 bg-accent rounded-full animate-pulse">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="space-y-4 max-w-md">
              <h3 className="text-2xl font-bold text-foreground">Ready to Analyze</h3>
              <p className="text-muted-foreground leading-relaxed">
                Upload your first image to experience our AI-powered analysis pipeline. Get instant insights on objects,
                nutrition, news, and more.
              </p>
            </div>
            <Button
              size="lg"
              onClick={() => fileInputRef.current?.click()}
              className="bg-gradient-to-r from-accent to-primary hover:from-accent/90 hover:to-primary/90 text-white font-semibold px-8 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              <Upload className="w-5 h-5 mr-2" />
              Get Started
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SecureImageUpload;