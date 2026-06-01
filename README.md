# ANTES o DESPUÉS

> Juego web para adivinar qué pasó antes o después en la historia.
> **2900+ eventos**, **8 modos de juego**, **36 logros**, **10 power-ups**, reto diario, multijugador local y mucho más.

🌐 **[Jugar online](https://antesodespues.vercel.app)** · 📦 Vanilla JS · Sin build · Sin dependencias

---

## ✨ Características

### 🎮 8 modos de juego
- **Clásico** — sin límite, un fallo y se acabó
- **Contrarreloj** — 60 segundos, fallar resta tiempo
- **Difícil** — años muy cercanos entre sí
- **Reto Diario** — 10 cartas iguales para todo el mundo
- **Timeline** — ordena 4 cartas cronológicamente
- **Año Exacto** — escribe el año con margen
- **Década** — elige la década correcta
- **Multijugador** local — pase y juega entre amigos

### 📚 Contenido
- **2900+ eventos** verificados en **14 categorías**: Cine, Música, Deporte, Historia, Tecnología, Internet, España, Ciencia, Arte, Famosos, Videojuegos, Gastronomía, Anime/Manga y Naturaleza.
- Imágenes en vivo desde la **API de Wikipedia** (gratis, sin claves).
- "Hoy hace X años…" en el menú con efemérides.

### 🏆 Progresión
- **36 logros** desbloqueables.
- Racha diaria (días consecutivos).
- Estadísticas globales y por categoría.
- Récords por modo.
- Resumen detallado post-partida.

### 🎁 Power-ups (15% drop al acertar)
7 positivos: ⏱️ +tiempo, 💎 x2 puntos, 🌟 pista, ❤️ vida extra, 🎲 cambia carta, 🚀 combo +3, 🍀 inmune.
3 trolls auto-activados: 💣 botones invertidos, 🌫️ niebla, 🤡 imagen borrosa.

### 🎨 UI / UX
- Tema oscuro pro con 4 variantes (Por defecto, Oro, Neón, Papel).
- Tipografías reales (Bebas Neue, Fraunces, Inter via Google Fonts).
- Iconos vectoriales (Lucide via Iconify).
- Fondo animado con orbes de color, constelación, spotlight que sigue al ratón.
- 3D tilt en cartas, card-flip al revelar año, particles dorados en aciertos.
- Tutorial primera vez, atajos de teclado (?), modal de logros importantes.
- **PWA instalable** (manifest + service worker para uso offline).
- Soporte completo de **accesibilidad**: modo daltónico, alto contraste, texto grande, ARIA.
- Vibración háptica en móvil.

### 📤 Compartir
- Resultado como texto.
- Imagen PNG generada al vuelo con canvas.
- Open Graph + Twitter Card para previews en redes.

---

## 🚀 Cómo jugar

1. Online: **https://antesodespues.vercel.app**
2. Local: abre `web/index.html` directamente o sirve la carpeta `web/` con cualquier servidor estático.

```bash
# Servidor local rápido
cd web
python -m http.server 8000
# → http://localhost:8000
```

---

## 🛠️ Tecnología

- **HTML + CSS + JS vanilla** — sin frameworks, sin build, sin dependencias instaladas.
- **Google Fonts + Iconify** vía CDN para tipografía e iconos.
- **API de Wikipedia** (action API + REST summary) para imágenes y "¿sabías qué?".
- **localStorage** para todo el estado (récords, logros, racha, tema, cache).
- **Service Worker** para uso offline.
- **Web Audio API** para los sonidos sintetizados.
- **Vibration API** para haptic feedback en móvil.

### Estructura
```
web/
├── index.html      # HTML + CSS + meta tags
├── game.js         # Toda la lógica del juego
├── events.js       # Base de 2900+ eventos
├── manifest.json   # PWA manifest
├── sw.js           # Service Worker
└── img/
    ├── logo.png    # Logo cuadrado / favicon / app icon
    ├── banner.png  # Banner hero / Open Graph
    └── fondo.png   # Background del menú
```

---

## ➕ Añadir eventos

Edita `web/events.js`. Cada objeto:

```js
{ t: "Título mostrado", y: año, w: "Wikipedia_article_title", c: "categoria" }
```

- `t`: título en español que se muestra al jugador (**sin** mencionar el año explícitamente para que no spoilee).
- `y`: año (entero; negativo = a.C.).
- `w`: slug del artículo de Wikipedia (con guiones bajos). Se intenta primero en inglés, luego en español.
- `c`: clave de categoría (`tech`, `cine`, `musica`, `deporte`, `historia`, `espana`, `ciencia`, `arte`, `famosos`, `juegos`, `gastro`, `anime`, `naturaleza`, `internet`).

¿Tienes una idea de evento? **[Abre un issue en GitHub](https://github.com/cristiiaanlp/antesodespues/issues/new)** con título, año y artículo de Wikipedia.

---

## 🌐 Pendiente — necesita configuración externa

Las siguientes features requieren cuentas externas que aún no están configuradas:

### 🏆 Leaderboard global del Reto Diario
Necesario: cuenta de [Supabase](https://supabase.com) (gratis). Crear tabla:
```sql
create table daily_scores (
  date date primary key,
  user_id text,
  score int,
  created_at timestamp default now()
);
```
Después añadir en `game.js`:
```js
const SUPABASE_URL = 'https://TU_PROYECTO.supabase.co';
const SUPABASE_ANON = 'TU_CLAVE_ANON';
```

### 📊 Analytics
Recomendado: [Plausible](https://plausible.io) o [Umami](https://umami.is) (privacy-friendly, sin cookies).
Añadir en `<head>` de `index.html`:
```html
<script defer data-domain="antesodespues.vercel.app" src="https://plausible.io/js/script.js"></script>
```

### 🌍 i18n (multi-idioma)
Pendiente. Estructura propuesta:
```
web/lang/
├── es.json  (actual, por defecto)
├── en.json
└── fr.json
```

### 🎮 Multijugador online real
Necesita backend WebSocket o Firebase Realtime Database. No implementado todavía.

---

## 📝 Licencia
MIT. Las imágenes provienen de Wikipedia y mantienen sus respectivas licencias.

## 🙌 Créditos
Concebido y desarrollado con ❤️ por [Cristian López](https://github.com/cristiiaanlp).
Iconos: [Lucide](https://lucide.dev). Tipografía: Google Fonts (Bebas Neue, Fraunces, Inter).
