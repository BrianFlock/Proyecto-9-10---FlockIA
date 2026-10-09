// Swagger UI for the API, loaded from a pinned CDN build.
const SWAGGER = 'https://unpkg.com/swagger-ui-dist@5.17.14';

const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>API · Implemented Changes Tracker</title>
  <meta name="color-scheme" content="light">
  <link rel="stylesheet" href="${SWAGGER}/swagger-ui.css">
  <style>html, body { background: #fff; margin: 0; }</style>
</head>
<body>
  <div id="swagger"></div>
  <script src="${SWAGGER}/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({ url: '/api/openapi', dom_id: '#swagger', deepLinking: true });
  </script>
</body>
</html>`;

export function GET() {
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
