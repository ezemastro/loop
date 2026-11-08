# Ideas y pendientes para más adelante

Documento interno. No está enlazado desde la app ni desde la landing. Los recordatorios chicos van
en `TODO.md`; acá van las ideas de producto y los pendientes que necesitan una decisión o varios
pasos.

## IA para estimar el impacto ambiental de cada publicación

**Cómo funciona hoy.** El impacto no depende de la publicación, sino de su categoría. Cada
categoría tiene valores fijos (`categories.stat_kg_waste`, `stat_kg_co2`, `stat_l_h2o`). Cuando el
comprador confirma que recibió el artículo (`receiveListing` en
`server/api/src/models/listings.ts`), esos valores se suman al usuario, a sus colegios y al total
de la comunidad (`global_stats`). Una mochila chica y una grande suman lo mismo.

**Idea.** Al publicar, una IA estima los kg de residuos evitados, el CO2 y el agua ahorrada, a
partir de la foto, el título, la descripción y el estado del artículo.

**A definir antes de empezar:**
- Dónde se guarda la estimación (por ejemplo, columnas nuevas en `listings`). El valor de la
  categoría queda como respaldo si la IA falla o no responde.
- Límites por categoría, para que un error de la IA no sume valores absurdos al total de la
  comunidad.
- Si la app muestra el número como estimación, y con qué texto.
- Proveedor y costo por publicación.
- Cuándo se calcula: al publicar, o al confirmarse el intercambio.

## IA para moderar lo que se publica

**Cómo funciona hoy.** No hay ningún filtro automático. Existen el botón "Denunciar", que arma un
correo y depende de la variable `EXPO_PUBLIC_REPORT_EMAIL`, y el panel de administración.

**Idea.** Revisar la foto y el texto al publicar, y avisar al equipo si algo no corresponde:
- que no sea un útil escolar;
- contenido inapropiado;
- datos personales, teléfonos o contactos para arreglar por fuera de la app;
- precios en dinero (los intercambios son con loopies);
- fotos donde se vean chicos o caras.

**A definir antes de empezar:**
- Si la IA bloquea la publicación, o la publica y la manda a una cola de revisión en el panel. Lo
  segundo tolera mejor los falsos positivos.
- Privacidad: las fotos pueden mostrar menores y se enviarían a un tercero. Hay que reflejarlo en la
  política de privacidad, que hoy sigue pendiente de revisión legal.
- Proveedor y costo. Conviene hacer una sola llamada a la IA al publicar para resolver esta idea y la
  del impacto juntas.

## Pendientes detectados en noviembre de 2026

- **Texto legal.** `/privacidad` y `/terminos` siguen con la marca "REVISIÓN LEGAL PENDIENTE".
  Bloquea publicar la landing.
- **Logos de colegios en la landing.** Se tomaron de la API pública y no hay permiso registrado.
  Confirmar que se pueden usar en una página pública.
- **Logo de Loop.** Sigue con el degradé arcoíris. Hace falta el archivo fuente de la marca para
  cambiarlo en toda la app.
- **`EXPO_PUBLIC_REPORT_EMAIL`.** No aparece en `Dockerfile.web` ni en `compose.yml`. Sin ella, el
  botón "Denunciar" avisa que no hay correo configurado.
- **Colores de Red Itínere en producción.** La comunidad tiene guardado el verde `#4C9F38`. La
  paleta institucional azul es solo el valor por defecto, así que no les llega.
- **"Explorar la demo" en `/ingresar`.** Deja guardada la marca de modo demo. Si después alguien
  inicia sesión con su cuenta real, entra a la demo. El botón "Probá la demo" de la landing no
  tiene este problema.
- **Landing.** Falta una captura del panel de administración para la sección "Una comunidad
  cerrada".
- **Chat en escritorio a dos columnas.** Quedó afuera de la ronda de mejoras de UI de noviembre.
- **Preferencias de notificación.** Es lo que más se espera encontrar en Configuración. Se postergó
  en agosto porque necesita una tabla de preferencias por usuario.
