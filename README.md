# avior-pca-back

Backend para AVIOR PCA (módulo Marketing).

## Requisitos
- Node.js 18+ (recomendado 20+)
- Acceso a MongoDB Atlas (MONGODB_URI)

## Setup
1) Copia `.env.example` a `.env` y rellena variables.
2) Instala dependencias.

## Scripts
- `npm run dev`: servidor en modo desarrollo (watch)
- `npm run build`: compila TypeScript a `dist/`
- `npm start`: ejecuta build

## Swagger
- UI: `http://localhost:<PORT>/docs`
- JSON: `http://localhost:<PORT>/openapi.json`
