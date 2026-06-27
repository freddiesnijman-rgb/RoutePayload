import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'api-proxy',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url && (req.url.startsWith('/api/compute-routes') || req.url === '/api/compute-routes') && req.method === 'POST') {
              let body = '';
              req.on('data', chunk => {
                body += chunk;
              });
              req.on('end', async () => {
                try {
                  const { requestBody, fieldMask, apiKey } = JSON.parse(body);
                  if (!apiKey) {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: 'Missing API key' }));
                    return;
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
                    res.statusCode = statusCode;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(errorDetail));
                    return;
                  }

                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(responseData));
                } catch (err: any) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: err.message || 'Internal server error during route fetch' }));
                }
              });
            } else {
              next();
            }
          });
        }
      }
    ],
    define: {
      'process.env.GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify(process.env.GOOGLE_MAPS_PLATFORM_KEY || '')
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
