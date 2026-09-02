# Gestión de Usuarios, Roles y Permisos (RBAC) — Implementation Plan

**Objetivo:** Implementar el módulo completo de Seguridad y Control de Acceso Basado en Roles (RBAC) aprovechando las tablas nativas ya existentes en la base de datos Azure SQL (`EXHIBICION.TB_USUARIOS`, `EXHIBICION.TB_ROLES`, `EXHIBICION.TB_PERMISOS`, `EXHIBICION.TB_ROL_PERMISOS`).

---

## 1. Arquitectura de Datos Existente

La base de datos Azure SQL ya cuenta con las estructuras relacionales preparadas:
* **`EXHIBICION.TB_USUARIOS`:** `IN_usuario_id`, `VC_usuario`, `VC_password_hash`, `VC_nombre_completo`, `VC_email`, `VC_celular`, `IN_rol_id`, `VC_zona`, `BI_activo`, `DT_ultimo_login`.
* **`EXHIBICION.TB_ROLES`:** `IN_rol_id`, `VC_nombre`, `VC_descripcion`, `BI_activo`. (Roles base: *Promotoría*, *Ejecutivo*, *Supervisor*, *Trade Marketing*, *Administrador*).
* **`EXHIBICION.TB_PERMISOS`:** 18 permisos granulares agrupados por módulo (*Seguridad*, *Showrooms*, *Exhibiciones*, *Auditorías*, *Requerimientos*, *Asignaciones*, *Reportes*).
* **`EXHIBICION.TB_ROL_PERMISOS`:** Relación de muchos a muchos entre Roles y Permisos.

---

## 2. Componentes Propuestos

### A. Backend (`server/`)
1. **`server/routes/usuarios.ts`:**
   * `GET /api/usuarios`: Listado con filtros (`search`, `rolId`, `activo`), ordenación y paginación.
   * `POST /api/usuarios`: Crear usuario (con validación Zod, hash seguro bcryptjs y rol).
   * `PUT /api/usuarios/:id`: Actualizar datos de usuario (nombre, email, celular, zona, rol, estado activo/inactivo).
   * `PUT /api/usuarios/:id/password`: Reseteo administrativo de contraseña.
2. **`server/routes/roles.ts`:**
   * `GET /api/roles`: Listar roles con cantidad de usuarios asignados y sus permisos actuales.
   * `GET /api/permisos`: Catálogo consolidado de permisos agrupados por módulo.
   * `PUT /api/roles/:id/permisos`: Guardar la asignación de permisos para un rol en `EXHIBICION.TB_ROL_PERMISOS`.
3. **`server/middleware/auth.ts`:**
   * Validar que solo usuarios con rol `Administrador` (o permiso `seguridad.usuarios - gestionar`) puedan acceder a estos endpoints.

### B. Frontend (`src/`)
1. **Página Principal Unificada (`src/pages/SeguridadPage.tsx` - `/seguridad`):**
   * **Pestaña 1: "Usuarios"**:
     - Tarjetas de usuario con avatar, nombre, rol con badge de color, zona, correo y estado (Activo/Inactivo).
     - Buscador por nombre/usuario y filtro por rol.
     - Botón "+ Nuevo Usuario" con modal para registrar o editar.
     - Modal de "Cambiar Contraseña" administrativo.
     - Toggle rápido para activar/desactivar acceso a la plataforma.
   * **Pestaña 2: "Roles y Permisos (RBAC)"**:
     - Selector de rol (*Promotoría*, *Ejecutivo*, *Supervisor*, *Trade Marketing*, *Administrador*).
     - Matriz interactiva de permisos organizada por módulos (Checkboxes/Switches agrupados para marcar qué acciones puede realizar cada rol).
     - Botón "Guardar Cambios de Permisos" con feedback visual.
2. **Navegación y Permisos (`src/components/layout/Sidebar.tsx` & `src/App.tsx`):**
   * Mostrar el menú **"Seguridad"** en el Sidebar únicamente a usuarios con rol `Administrador`.
   * Proteger la ruta `/seguridad` en el cliente.
3. **Internacionalización (`es.json` y `en.json`):**
   * Bloque `seguridad` con traducciones en español e inglés.

---

## 3. Plan de Verificación

* **Pruebas Unitarias Automatizadas:** Tests en `server/routes/usuarios.test.ts` y helpers de permisos.
* **Compilación:** `npm run build` sin errores de tipos ni bundles.
* **Prueba E2E en Vivo:**
  1. Iniciar sesión como `admin`.
  2. Crear un usuario de prueba (ej. `promotor_test`), cambiar su rol y zona.
  3. Modificar la matriz de permisos de un rol y verificar persistencia en `EXHIBICION.TB_ROL_PERMISOS`.
  4. Probar toggle de activación/desactivación de cuenta.
