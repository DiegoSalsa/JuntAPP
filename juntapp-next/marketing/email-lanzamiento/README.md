# Correo de lanzamiento JuntAPP

Tres opciones listas para previsualizar y adaptar al proveedor de envío. Todas usan HTML compatible con clientes de correo, CTA con UTM hacia `/solicitar-prueba` y enlace de desuscripción. La solicitud queda en Superadmin para crear la junta de forma personalizada.

## Recomendación

1. **Comunidad** (`opcion-1-comunidad.html`): recomendada para el primer envío. Explica el valor, muestra la identidad visual y destaca el mes gratis sin verse agresivamente comercial.
2. **Carta al dirigente** (`opcion-2-carta-dirigente.html`): más cercana y humana. Buena como variante A/B o seguimiento a quienes abrieron y no se registraron.
3. **Directo** (`opcion-3-directo.html`): mensaje corto y de alta conversión. Útil para un reenvío o una base que ya conoce el producto.

## Asuntos sugeridos

- `{{contacto_nombre}}, JuntAPP ya está disponible para tu junta vecinal`
- `Nos ayudaste a crearla. Hoy JuntAPP ya está lista.`
- `1 mes gratis para ordenar la gestión de tu junta`

Preencabezado recomendado: `Prueba socios, tesorería, consultas y avisos durante 1 mes, sin tarjeta.`

## Variables

- `{{contacto_nombre}}`: nombre del dirigente. Si está vacío, reemplazar por `dirigente vecinal`.
- `{{unsubscribe_url}}`: enlace único de baja del proveedor de campañas.

Las imágenes están publicadas desde `/public/marketing/email/` y los enlaces apuntan a `juntapp.cl` con la campaña `lanzamiento_2026`.
