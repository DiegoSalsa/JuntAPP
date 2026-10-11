# Evidencia visual UX/UI V2

Esta carpeta contiene capturas comparables de la rama `mejoras/ux-ui-v2` frente a su base V1 (`f2ca2688698d5d1ad2a764d2dd51240e0bb2983b`). Las capturas se generaron con Playwright Chromium en un fixture local efímero; no se usaron Supabase productivo ni datos personales reales.

## Cobertura

- Viewports: `320×640`, `360×800`, `390×844`, `768×1024`, `1280×800` y `1440×900`.
- Roles: vecino, directiva y sesión Superadmin local firmada para las pantallas de administración.
- Vecino: Inicio, Tesorería, Consultas y Socios.
- Directiva: Inicio, Socios, Tesorería, Consultas, Comunicaciones y Mi página.
- Superadmin: resumen, juntas, usuarios y operaciones.
- Interacciones representadas: menú móvil, diálogo de registro manual de cuota, diálogo de publicación de anuncio y navegación primaria móvil.
- Cada fase registra `results.json`; `overflow: 0` confirma que no hubo desborde horizontal en las rutas capturadas.

## Comparativa

- `before/` conserva el estado V1 antes de aplicar el rediseño.
- `after/` conserva el estado V2 final de esta iteración.
- Las imágenes usan el mismo fixture, tamaños y rutas para que la revisión independiente pueda comparar jerarquía, densidad, navegación y estados.

Capturas representativas:

- [Inicio vecino antes](before/vecino-inicio-390x844.png) · [Inicio vecino después](after/vecino-inicio-390x844.png)
- [Inicio directiva antes](before/directiva-inicio-390x844.png) · [Inicio directiva después](after/directiva-inicio-390x844.png)
- [Inicio directiva escritorio](after/directiva-inicio-1440x900.png)
- [Resumen Superadmin escritorio](after/superadmin-1440x900.png)

## Decisiones verificables

El inicio ahora separa las prioridades del vecino (cuota, consulta y avisos) de las tareas de la directiva (caja, padrón, propuestas y comunicación). La navegación móvil mantiene acceso inmediato a Inicio, Socios, Caja y Consultas, y deja las áreas secundarias en el menú contextual. Los módulos existentes comparten estados de foco, tarjetas, filtros, tablas y controles con foco visible sin alterar sus contratos de datos.

La evidencia no sustituye una sesión contra un entorno de staging con datos representativos. La prueba de Superadmin usa una cookie HMAC local y una identidad ficticia únicamente para validar renderizado y autorización de la ruta.
