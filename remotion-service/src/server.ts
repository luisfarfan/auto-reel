import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { RenderPropsSchema, TEMPLATES, RESOLUTIONS } from "./types";
import { renderVideo, warmBundle } from "./renderer";

const app = express();
app.use(express.json({ limit: "10mb" }));

// Serve generated media files (.mp/ directory) so Remotion's Chromium can load images
const OUTPUT_DIR = process.env.OUTPUT_DIR ?? path.join(__dirname, "../../.mp");
app.use("/media", express.static(OUTPUT_DIR));

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const VERSION = "1.0.0";

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", version: VERSION });
});

app.get("/templates", (_req: Request, res: Response) => {
  res.json({
    templates: TEMPLATES,
    resolutions: Object.keys(RESOLUTIONS),
  });
});

app.post("/render", async (req: Request, res: Response, next: NextFunction) => {
  const parsed = RenderPropsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid props", details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await renderVideo(parsed.data);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[server] error:", err.message);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, async () => {
  console.log(`[server] remotion-service v${VERSION} listening on :${PORT}`);
  warmBundle().catch((e) => console.error("[server] bundle warm-up failed:", e.message));
});
