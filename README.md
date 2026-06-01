# ANTES O DESPUÉS

Quiz de "Higher/Lower" con eventos históricos, culturales y de pop culture.
**¿Qué pasó antes?** Adivina cuál de dos eventos ocurrió primero. Acierta para encadenar
puntos; falla y se acaba.

## Cómo jugar (web)
- Doble clic en **`web/index.html`** o despliega la carpeta `web/` en Vercel / Netlify / GitHub Pages.
- **207 eventos** con imágenes reales obtenidas en directo desde Wikipedia (sin claves ni APIs de pago).
- Pulsa **⬆ ANTES** o **DESPUÉS ⬇** (también con flechas arriba/abajo del teclado).
- Tu mejor racha se guarda en el navegador (localStorage).

## Características
- ✅ 207 eventos repartidos entre tecnología, cine, música, deporte, historia, ciencia, cultura, famosos y videojuegos.
- ✅ Imágenes reales en directo (Wikipedia REST API).
- ✅ Caché de URLs en localStorage (no se repiten peticiones).
- ✅ Animaciones suaves, confeti en hitos (10, 25, 50, 100), efectos de sonido sintetizados (Web Audio).
- ✅ Responsive móvil + soporte teclado.
- ✅ Récord persistente.

## Añadir eventos
Edita `web/events.js`. Cada objeto:
```js
{ t: "Título mostrado", y: año, w: "Wikipedia_article_title" }
```
- `t`: título en español que se muestra al jugador.
- `y`: año (entero; negativo = a.C.).
- `w`: nombre del artículo de **Wikipedia (inglés)** para sacar la imagen (con guiones bajos).

## Tecnología
- HTML + CSS + JS vanilla (sin frameworks, sin build).
- Web Audio API para los sonidos.
- Fetch a `https://en.wikipedia.org/api/rest_v1/page/summary/<artículo>` (con fallback a `es.wikipedia.org`).
