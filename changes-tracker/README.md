# Implemented Changes Tracker

App para registrar CHGs por proyecto y generar el gráfico mensual "Implemented changes per month" con sus totales
(Planned / Emergency / Successful / Not successful / Rollback). Cada mes con cargas agrega su barra automáticamente.
Exportaciones (respetan los filtros de año, equipo y mes):

- **Gráfico (PNG):** la imagen con fondo blanco para pegarla en el reporte.
- **Exportar Excel:** un `.xlsx` con la hoja *Reporte* (totales, tabla mensual por serie e imagen del gráfico)
  y la hoja *Cambios* (el listado con autofiltro).

Stack: Next.js 16 (App Router) + API routes. Los datos se guardan:

- **En local:** en `data/changes.json` (no hace falta instalar ninguna base).
- **En Vercel:** en Postgres (Neon), cuando existe la variable `DATABASE_URL`. La tabla se crea sola la primera vez.

## Correr en local

Requisito: Node.js 20.9 o superior (https://nodejs.org, versión LTS).

```bash
cd changes-tracker
npm install
npm run dev
```

Abrí http://localhost:3000.

### Datos de demo

Con la app corriendo:

```bash
npm run seed:demo      # carga ~140 CHGs de ejemplo (2026, equipos CX, Data e Infra)
npm run seed:clear     # borra solo los registros de demo
```

Los registros de demo llevan `[demo]` en las notas; los cargados a mano no se tocan.
Para cargarlos en Vercel: `node scripts/seed-demo.mjs https://tu-app.vercel.app`.

Para usar Postgres también en local, creá un archivo `.env.local` con `DATABASE_URL=...` (ver `.env.example`).

## Desplegar en Vercel

1. Subí el repo a GitHub.
2. En Vercel: **Add New → Project**, importá el repo y en **Root Directory** elegí `changes-tracker`.
3. En el proyecto: **Storage → Create Database → Neon (Postgres)** y conectalo al proyecto.
   Vercel agrega `DATABASE_URL` a las variables de entorno.
4. **Redeploy** para que tome la variable.

Sin base conectada, la app en Vercel muestra un aviso y no guarda cambios, porque el disco de Vercel es de solo lectura.

## API

Documentación interactiva (Swagger UI) en http://localhost:3000/api/docs.
La especificación OpenAPI en JSON está en `/api/openapi` (se puede importar en Postman).

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/changes` | Lista todos los cambios |
| POST | `/api/changes` | Crea un cambio |
| PUT | `/api/changes/:id` | Actualiza un cambio |
| DELETE | `/api/changes/:id` | Borra un cambio |

Cuerpo de POST/PUT:

```json
{
  "chg": "CHG0034567",
  "project": "Migración portal clientes",
  "team": "CX",
  "date": "2026-03-14",
  "type": "planned",
  "result": "successful",
  "notes": ""
}
```

`type`: `planned` | `emergency` · `result`: `successful` | `unsuccessful` | `rollback` | `open`
