# Qué tenés que probar a mano

> Cada bloque cerrado agrega su sección acá. Marcá con `[x]` lo que verificaste.
> Todo lo listado es comportamiento observable que la suite automática NO cubre.

## admin-panel-fixes (AUDITORIA-2026-09 §7)

Necesitás dos cuentas de `DEMO.md`: una `super_admin` y una `community_admin`. Y el panel corriendo
(`npm run dev --prefix adminClient`) contra una API con al menos 25 usuarios en alguna comunidad para
probar la paginación.

### Autorizar admin (ADM-02)

- [ ] Entrá como **super admin**, andá a "Autorizar admin". Verificá que aparece un selector de rol
      ("Administrador de comunidad" / "Super administrador") y que por defecto está en "Administrador
      de comunidad".
- [ ] Con rol "Administrador de comunidad" elegido, dejá la comunidad sin seleccionar: el botón
      "Autorizar Email" tiene que quedar deshabilitado y no se dispara ningún pedido.
- [ ] Elegí una comunidad, escribí un email válido y confirmá: tiene que autorizar bien (ya no debe
      aparecer el error "Hay que elegir una comunidad para esta acción.").
- [ ] Cambiá el rol a "Super administrador": el selector de comunidad tiene que desaparecer. Autorizá
      un email: tiene que funcionar sin pedir comunidad.
- [ ] Salí y entrá como **community admin**. Andá a "Autorizar admin": no debe verse ningún selector de
      rol ni de comunidad. Autorizá un email y confirmá que quedó en tu propia comunidad.
- [ ] Provocá un error (por ejemplo repetí un email ya autorizado) y confirmá que el mensaje se ve en
      español y legible, no un texto crudo del servidor.

### Paginación de usuarios (ADM-03)

- [ ] Como super admin, andá a "Usuarios" en una comunidad con más de 10 usuarios (idealmente 21-25+).
      Confirmá que el paginador ofrece 2 o más páginas (antes solo ofrecía la mitad de las reales) y
      que la última página carga usuarios de verdad.
- [ ] Con la consola del navegador abierta (F12), navegá y busquen usuarios en esa pantalla: no debe
      aparecer ningún `console.log` con datos de usuarios.

### Logos de comunidad (ADM-05)

- [ ] Como super admin, andá a "Comunidades". Si alguna comunidad tiene logo subido, confirmá que la
      imagen se ve (antes rompía porque faltaba el prefijo de URL).
- [ ] Abrí "Editar" en una comunidad, subí un logo nuevo: la vista previa tiene que cargar la imagen
      correctamente.

### Cerrar sesión y sesión vencida (ADM-06)

- [ ] Iniciá sesión, abrí DevTools → Application → Cookies, confirmá que existe `admin_token`. Hacé
      clic en "Cerrar sesión". Confirmá que la cookie `admin_token` desapareció y que te mandó a
      `/login`.
- [ ] Iniciá sesión de nuevo, borrá manualmente la cookie `admin_token` desde DevTools (sin cerrar
      sesión desde la UI), y hacé cualquier acción que dispare un pedido a la API (por ejemplo abrir
      "Usuarios"). Confirmá que te redirige a `/login` en vez de quedarse colgado o fallar en
      silencio.
- [ ] En `/login`, escribí una contraseña incorrecta a propósito. Confirmá que aparece el mensaje de
      "credenciales inválidas" en la misma pantalla, y que **no** te redirige a ningún lado.
- [ ] Iniciá sesión, abrí DevTools → Application → Local Storage → clave `session-storage`. Confirmá
      que solo contiene `isLoggedIn`, `role` y `communityId` — nada de `email`, `fullName` ni
      `communityName`.
- [ ] Como super admin, recargá la página (F5) con la sesión activa: confirmá que el menú lateral
      sigue mostrando las secciones de super admin (Comunidades, Categorías, Misiones) apenas carga,
      antes de que responda la API.

### Modales migrados (ADM-04)

Para cada uno de estos seis diálogos: **Modificar créditos**, **Reiniciar contraseña**, **Crear
colegio**, **Editar colegio**, **Categoría** (crear o editar) y **Misión** (crear o editar):

- [ ] Abrilo y confirmá que el fondo detrás se ve semitransparente (no una pantalla negra opaca que
      tapa todo).
- [ ] Completá el formulario con datos válidos y confirmá con el botón del pie del modal: tiene que
      mandar el mismo pedido y comportarse igual que antes (crear/actualizar y cerrar el modal).
- [ ] Hacé clic sobre el texto de una etiqueta (por ejemplo "Nombre" o "Cantidad"): el foco tiene que
      saltar al campo correspondiente.
- [ ] En el modal de "Categoría" (el más largo), en una ventana chica o con el zoom subido para que el
      contenido desborde, confirmá que hay una sola barra de scroll (no dos anidadas).

### Motivo obligatorio en créditos (ADM-08)

- [ ] Abrí "Modificar créditos" de un usuario, completá un monto válido y dejá el motivo vacío:
      confirmá que se rechaza con un mensaje en español y que no se manda ningún pedido.
- [ ] Repetí con el motivo lleno solo de espacios: mismo resultado, rechazado.
- [ ] Completá un motivo real (por ejemplo "Ajuste por error de carga") y confirmá: el ajuste tiene que
      aplicarse. (Si tenés acceso a la base, confirmá que `wallet_transactions.meta` para esa fila
      trae el motivo en vez de `NULL`.)

### Confirmaciones en acciones irreversibles (ADM-08)

- [ ] En "Invitaciones", hacé clic en "Revocar" sobre una invitación disponible: tiene que aparecer un
      diálogo de confirmación (no se revoca al toque). Cancelalo y confirmá que la invitación sigue
      intacta. Volvé a intentarlo y esta vez confirmá "Sí, revocar": recién ahí se revoca.
- [ ] En "Comunidades", con una comunidad que tenga **un solo** dominio de correo cargado, hacé clic en
      la `×` de ese dominio: el diálogo tiene que avisar explícitamente que nadie va a poder
      autoregistrarse hasta que agregues otro dominio.
- [ ] En "Solicitudes de borrado" (pestaña Pendientes), hacé clic en "Rechazar" sobre una solicitud:
      tiene que pedir confirmación nombrando el email del solicitante antes de rechazarla.
- [ ] En cualquiera de los tres diálogos de confirmación anteriores, con el pedido en curso (botón en
      estado de carga), hacé clic de nuevo sobre el botón de peligro: confirmá que no se dispara un
      segundo pedido.
- [ ] En "Solicitudes de borrado", confirmá que el diálogo existente de "Borrar cuenta" sigue
      funcionando exactamente igual que antes (no se tocó).

### Idioma e ícono del documento (ADM-10)

- [ ] Cargá el panel y mirá la pestaña del navegador: tiene que mostrar un ícono de Loop (no el logo
      genérico de Vite).
- [ ] Con DevTools abierto, inspeccioná el elemento `<html>` y confirmá que su atributo `lang` es
      `"es"`.

