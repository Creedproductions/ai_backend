import "dotenv/config";
import express from "express";
import cors from "cors";
import { fal } from "@fal-ai/client";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = Number(process.env.PORT || 10000);
const IMAGE_MODEL = process.env.FAL_IMAGE_MODEL || "fal-ai/flux/dev";

if (!process.env.FAL_KEY) {
  throw new Error("Missing FAL_KEY environment variable");
}

fal.config({
  credentials: process.env.FAL_KEY,
});

function sendError(res, status, message, extra = {}) {
  return res.status(status).json({
    error: message,
    ...extra,
  });
}

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "AI backend is running",
  });
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    model: IMAGE_MODEL,
  });
});

app.post("/v1/ai/image/jobs", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim();
    if (!prompt) {
      return sendError(res, 400, "prompt is required");
    }

    const width = toNumber(req.body?.width, 1024);
    const height = toNumber(req.body?.height, 1024);
    const steps = toNumber(req.body?.steps, 28);
    const guidance = toNumber(req.body?.guidance, 3.5);

    const seed =
      req.body?.seed === null || req.body?.seed === undefined
        ? undefined
        : toNumber(req.body.seed, undefined);

    const input = {
      prompt,
      image_size: {
        width,
        height,
      },
      num_inference_steps: steps,
      guidance_scale: guidance,
      num_images: 1,
      output_format: "jpeg",
      enable_safety_checker: true,
      ...(seed !== undefined ? { seed } : {}),
    };

    const result = await fal.queue.submit(IMAGE_MODEL, { input });

    return res.status(202).json({
      requestId: result.request_id,
      model: IMAGE_MODEL,
      status: "IN_QUEUE",
    });
  } catch (error) {
    console.error("POST /v1/ai/image/jobs error:", error);
    return sendError(
      res,
      500,
      error?.message || "Failed to start image generation"
    );
  }
});

app.get("/v1/ai/image/jobs/:requestId", async (req, res) => {
  try {
    const { requestId } = req.params;

    const status = await fal.queue.status(IMAGE_MODEL, {
      requestId,
      logs: true,
    });

    if (status.status !== "COMPLETED") {
      return res.json({
        status: status.status,
        position: status.position ?? null,
        logs: status.logs ?? [],
      });
    }

    const result = await fal.queue.result(IMAGE_MODEL, {
      requestId,
    });

    const image = result?.data?.images?.[0];

    if (!image?.url) {
      return sendError(res, 502, "No image URL returned by fal");
    }

    return res.json({
      status: "COMPLETED",
      url: image.url,
      width: image.width ?? null,
      height: image.height ?? null,
      contentType: image.content_type ?? "image/jpeg",
      seed: result?.data?.seed ?? null,
    });
  } catch (error) {
    console.error("GET /v1/ai/image/jobs/:requestId error:", error);
    return sendError(
      res,
      500,
      error?.message || "Failed to fetch image job status"
    );
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`AI backend running on port ${PORT}`);
});
