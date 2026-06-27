import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to proxy Google Routes API requests, bypassing CORS limitations
  app.post("/api/compute-routes", async (req, res) => {
    try {
      const { requestBody, fieldMask, apiKey } = req.body;

      if (!apiKey) {
        return res.status(400).json({ error: "Missing API key" });
      }

      const googleResponse = await fetch('https://routes.googleapis.com/v1/computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': fieldMask || 'routes.duration,routes.distanceMeters,routes.legs,routes.polyline.encodedPolyline',
        },
        body: JSON.stringify(requestBody),
      });

      const statusCode = googleResponse.status;
      const statusText = googleResponse.statusText;
      const responseText = await googleResponse.text();
      let responseData;
      try {
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        responseData = { rawText: responseText };
      }

      if (!googleResponse.ok) {
        // Enforce useful context in the returned payload
        const errorDetail = {
          statusCode,
          statusText,
          error: responseData.error || responseData,
          tip: statusCode === 400 
            ? "Bad Request. This often means the request body is malformed or the API key is invalid. Please verify your waypoint coordinates."
            : statusCode === 403 
              ? "Forbidden. Ensure that the 'Routes API' is enabled in your Google Cloud Console for this API key, and that the key is valid and has no IP/referrer restrictions preventing access from server-side."
              : "An error occurred while contacting the Google Routes API."
        };
        return res.status(statusCode).json(errorDetail);
      }

      res.json(responseData);
    } catch (err: any) {
      console.error("Proxy error:", err);
      res.status(500).json({ error: err.message || "Internal server error during route fetch" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
