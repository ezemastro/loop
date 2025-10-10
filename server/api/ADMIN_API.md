# API de Administración - Loop

Esta documentación describe los endpoints de administración creados para la gestión completa de la aplicación Loop.

## 🔐 Autenticación

Todos los endpoints de administración (excepto login y register) requieren un token de administrador válido enviado en las cookies.

### POST /admin/login
Iniciar sesión como administrador.

**Request:**
```typescript
{
  username: string;
  password: string;
}
```

**Response:**
```typescript
{
  success: true;
  data: {
    admin: Admin;
  }
}
```

### POST /admin/register
Registrar un nuevo administrador (requiere token de registro especial).

**Request:**
```typescript
{
  username: string;
  fullName: string;
  password: string;
  passToken: string; // Token especial para crear admins
}
```

**Response:**
```typescript
{
  success: true;
  data: {
    admin: Admin;
  }
}
```

## 👥 Gestión de Usuarios

### GET /admin/users
Obtener lista de usuarios con paginación y búsqueda.

**Query Parameters:**
- `page` (opcional): Número de página (default: 1)
- `search` (opcional): Búsqueda por nombre o email

**Response:**
```typescript
{
  success: true;
  data: {
    users: PrivateUser[];
    total: number;
  }
}
```

### POST /admin/users/:userId/credits
Modificar los créditos de un usuario.

**Request:**
```typescript
{
  amount: number;
  positive: boolean; // true para agregar, false para quitar
  meta?: Record<string, unknown>; // Información adicional opcional
}
```

**Response:**
```typescript
{
  success: true;
  data: {
    user: PrivateUser;
  }
}
```

## 🏫 Gestión de Escuelas

### POST /admin/schools
Crear una nueva escuela.

**Request:**
```typescript
{
  name: string;
  mediaId: UUID; // ID del logo de la escuela
}
```

**Response:**
```typescript
{
  success: true;
  data: {
    school: School;
  }
}
```

## 📦 Gestión de Categorías

### POST /admin/categories
Crear una nueva categoría.

**Request:**
```typescript
{
  name: string;
  description?: string;
  parentId?: UUID; // ID de categoría padre (para subcategorías)
  icon?: string;
  minPriceCredits?: number;
  maxPriceCredits?: number;
  statKgWaste?: number; // Estadísticas ambientales
  statKgCo2?: number;
  statLH2o?: number;
}
```

**Response:**
```typescript
{
  success: true;
  data: {
    category: Category;
  }
}
```

### PATCH /admin/categories/:categoryId
Actualizar una categoría existente.

**Request:**
```typescript
{
  name?: string;
  description?: string;
  parentId?: UUID | null;
  icon?: string;
  minPriceCredits?: number;
  maxPriceCredits?: number;
  statKgWaste?: number;
  statKgCo2?: number;
  statLH2o?: number;
}
```

**Response:**
```typescript
{
  success: true;
  data: {
    category: Category;
  }
}
```

## 🔔 Gestión de Notificaciones

### POST /admin/notifications
Enviar una notificación a un usuario.

**Request:**
```typescript
{
  userId: UUID;
  type: NotificationType; // 'mission' | 'loop' | 'donation' | 'admin'
  payload: Record<string, unknown>; // Contenido de la notificación
}
```

**Response:**
```typescript
{
  success: true;
  data: {
    notification: Notification;
  }
}
```

## 📊 Estadísticas

### GET /admin/stats
Obtener estadísticas globales del sistema.

**Response:**
```typescript
{
  success: true;
  data: {
    stats: {
      total_kg_waste: number;
      total_kg_co2: number;
      total_l_h2o: number;
      // ... otras estadísticas
    }
  }
}
```

## 💻 Uso del Cliente TypeScript

El archivo `client/api/adminApi.ts` proporciona funciones tipadas para consumir todos estos endpoints:

```typescript
import adminApi from '@/api/adminApi';

// Iniciar sesión
const { data } = await adminApi.login('admin_user', 'password');

// Registrar nuevo admin
const { data: newAdmin } = await adminApi.register(
  'nuevo_admin',
  'Juan Pérez',
  'password123',
  'token_secreto'
);

// Obtener usuarios
const { data: { users, total } } = await adminApi.getUsers({ page: 1, search: 'john' });

// Modificar créditos
await adminApi.modifyUserCredits(userId, 100, true, { reason: 'Bonus' });

// Crear escuela
await adminApi.createSchool('Nueva Escuela', mediaId);

// Crear categoría
await adminApi.createCategory({
  name: 'Electrónica',
  description: 'Dispositivos electrónicos',
  icon: 'electronics',
  minPriceCredits: 10,
  maxPriceCredits: 1000,
});

// Actualizar categoría
await adminApi.updateCategory(categoryId, {
  name: 'Electrónica Actualizada',
});

// Enviar notificación
await adminApi.sendNotification(userId, 'admin', {
  title: 'Mensaje importante',
  message: 'Tu cuenta ha sido verificada',
});

// Obtener estadísticas
const { data: { stats } } = await adminApi.getStats();
```

## 🔧 Configuración

Para usar estos endpoints necesitas:

1. **Variable de entorno** `ADMIN_PASS_TOKEN`: Token secreto para crear nuevos administradores
2. **Variable de entorno** `ADMIN_TOKEN_EXP`: Duración del token de admin (default: 30 minutos)

## 🛡️ Seguridad

- Los tokens de administrador tienen una duración más corta que los tokens de usuario (30 min vs 30 días)
- Todos los endpoints (excepto login/register) requieren autenticación de administrador
- El middleware `adminTokenMiddleware` verifica que el token tenga la flag `isAdmin: true`
- Las cookies se envían con `httpOnly` y `secure` en producción

## ⚠️ Notas Importantes

- Los errores de tipo en `AdminModel` necesitan ser corregidos para que funcione completamente
- Asegúrate de que la base de datos tenga la tabla `global_stats` creada
- El parseo de algunos objetos complejos (User, School, Category) puede necesitar ajustes según tu estructura de datos actual
