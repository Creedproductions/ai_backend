import "dotenv/config";
import express from "express";
import cors from "cors";
import { fal } from "@fal-ai/client";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = Number(process.env.PORT || 8080);
const IMAGE_MODEL = process.env.FAL_IMAGE_MODEL || "fal-ai/flux/dev";
const VIDEO_MODEL = process.env.FAL_VIDEO_MODEL || "wan/v2.6/text-to-video";

if (!process.env.FAL_KEY) {
  throw new Error("Missing FAL_KEY environment variable");
}

fal.config({
  credentials: process.env.FAL_KEY,
});

function sendError(res, statusCode, message, extra = {}) {
  return res.status(statusCode).json({
    error: message,
    ...extra,
  });
}

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "AI backend is running",
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    imageModel: IMAGE_MODEL,
    videoModel: VIDEO_MODEL,
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
      type: "image",
      model: IMAGE_MODEL,
    });
  } catch (error) {
    console.error("IMAGE_SUBMIT_ERROR", error);
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

    const result = await fal.queue.result(IMAGE_MODEL, { requestId });
    const image = result?.data?.images?.[0];

    if (!image?.url) {
      return sendError(res, 502, "No image URL returned", {
        data: result?.data ?? null,
      });
    }

    return res.json({
      status: "COMPLETED",
      url: image.url,
      width: image.width ?? null,
      height: image.height ?? null,
      contentType: image.content_type ?? "image/jpeg",
      seed: result?.data?.seed ?? null,
      prompt: result?.data?.prompt ?? null,
    });
  } catch (error) {
    console.error("IMAGE_STATUS_ERROR", error);
    return sendError(
      res,
      500,
      error?.message || "Failed to fetch image status"
    );
  }
});

app.post("/v1/ai/video/jobs", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim();
    if (!prompt) {
      return sendError(res, 400, "prompt is required");
    }

    const aspectRatio = String(req.body?.aspectRatio || "9:16");
    const resolution = String(req.body?.resolution || "720p");
    const duration = String(req.body?.duration || "5");
    const negativePrompt = String(req.body?.negativePrompt || "");
    const multiShots = Boolean(req.body?.multiShots ?? false);
    const seed =
      req.body?.seed === null || req.body?.seed === undefined
        ? undefined
        : toNumber(req.body.seed, undefined);

    const input = {
      prompt,
      aspect_ratio: aspectRatio,
      resolution,
      duration,
      negative_prompt: negativePrompt,
      multi_shots: multiShots,
      enable_prompt_expansion: true,
      enable_safety_checker: true,
      ...(seed !== undefined ? { seed } : {}),
    };

    const result = await fal.queue.submit(VIDEO_MODEL, { input });

    return res.status(202).json({
      requestId: result.request_id,
      type: "video",
      model: VIDEO_MODEL,
    });
  } catch (error) {
    console.error("VIDEO_SUBMIT_ERROR", error);
    return sendError(
      res,
      500,
      error?.message || "Failed to start video generation"
    );
  }
});

app.get("/v1/ai/video/jobs/:requestId", async (req, res) => {
  try {
    const { requestId } = req.params;

    const status = await fal.queue.status(VIDEO_MODEL, {
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

    const result = await fal.queue.result(VIDEO_MODEL, { requestId });
    const video = result?.data?.video;

    if (!video?.url) {
      return sendError(res, 502, "No video URL returned", {
        data: result?.data ?? null,
      });
    }

    return res.json({
      status: "COMPLETED",
      url: video.url,
      width: video.width ?? null,
      height: video.height ?? null,
      fps: video.fps ?? null,
      duration: video.duration ?? null,
      contentType: video.content_type ?? "video/mp4",
      seed: result?.data?.seed ?? null,
      actualPrompt: result?.data?.actual_prompt ?? null,
    });
  } catch (error) {
    console.error("VIDEO_STATUS_ERROR", error);
    return sendError(
      res,
      500,
      error?.message || "Failed to fetch video status"
    );
  }
});

app.listen(PORT, () => {
  console.log(`AI backend running on port ${PORT}`);
});
