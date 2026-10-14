# Evidencias QA visual — JuntAPP

Las capturas de esta carpeta fueron generadas con el fixture local de QA y una cuenta de prueba de directiva. No contienen datos personales reales ni apuntan a Supabase productivo.

Se cubrieron estos tamaños: 360×800, 390×844, 768×1024, 1280×800 y 1440×900. Las rutas verificadas fueron Inicio, Tesorería, Registro de Socios, Consultas Comunitarias, Comunicaciones y el flujo de Mi Página (que redirige al catálogo cuando el fixture no tiene plan web). `superadmin-login-1440x900.png` cubre la entrada al panel Superadmin.

Los archivos `builder-*`, `dashboard-*` y `public-*` son capturas representativas existentes del worktree para creador de páginas, panel y sitio público. No hubo un baseline equivalente de cada pantalla para producir una comparativa antes/después estrictamente comparable.

La ejecución con el servidor de desarrollo normal quedó omitida porque este worktree no tiene `NEXT_PUBLIC_SUPABASE_URL` ni claves Supabase; el fixture local permitió validar layout, navegación y contenido de prueba sin tocar servicios externos.
