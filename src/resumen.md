# Implementación de Sistema de Autenticación 

## Descripción General del Sistema

Se ha implementado un sistema de autenticación para la aplicación de Auditoría de Riesgos. Esta implementación permite a los usuarios iniciar sesión con credenciales predefinidas sin requerir una base de datos real. El sistema utiliza el almacenamiento local del navegador (localStorage) para mantener el estado de la sesión.

La aplicación ahora cuenta con:
- Una pantalla de login que se muestra cuando el usuario no está autenticado
- Un sistema de gestión de sesión que protege las rutas
- Un header con información del usuario autenticado y un botón de logout
- La funcionalidad original de gestión de riesgos mantenida intacta

## Estructura de Archivos Creados/Modificados

```
src/
├── App.jsx (modificado)
├── components/
│   └── Login.jsx (nuevo)
├── services/
│   └── LoginService.js (nuevo)
└── resumen.md (nuevo)
```

### Archivos Modificados
- **App.jsx**: Se modificó para integrar el sistema de autenticación, proteger las rutas y mostrar el componente de login cuando sea necesario.

### Archivos Nuevos
- **components/Login.jsx**: Componente que maneja el formulario de inicio de sesión y la lógica de autenticación del usuario.
- **services/LoginService.js**: Servicio que proporciona funciones para iniciar sesión, verificar autenticación y cerrar sesión.
- **resumen.md**: Documentación del proyecto (este archivo).

## Funcionalidades Implementadas

### Sistema de Autenticación
- **Login**: Permite a los usuarios iniciar sesión con credenciales predefinidas.
- **Protección de Rutas**: Solo muestra el contenido de la aplicación a usuarios autenticados.
- **Gestión de Sesión**: Almacena datos de sesión en localStorage para persistencia.
- **Logout**: Permite a los usuarios cerrar sesión, eliminando su información de autenticación.

### Interfaz de Usuario
- **Pantalla de Login**: Formulario de inicio de sesión con feedback visual.
- **Header Informativo**: Muestra el nombre del usuario autenticado.
- **Botón de Logout**: Permite cerrar sesión fácilmente desde cualquier parte de la aplicación.

### Gestión de Riesgos (Funcionalidad Original)
- **Tabla Editable**: Permite ver, agregar, editar y eliminar riesgos.
- **Agregar Activos**: Modal para agregar nuevos activos con generación automática de riesgos.
- **Recomendar Tratamientos**: Funcionalidad para sugerir tratamientos para los riesgos identificados.

## Credenciales de Prueba

Para acceder al sistema, se pueden utilizar las siguientes credenciales:

- **Usuario**: admin
- **Contraseña**: 123456

Estas credenciales están hardcodeadas en el archivo `LoginService.js` y se muestran como ayuda en la pantalla de login.

## Detalles Técnicos de la Implementación

### 1. Servicio de Autenticación (LoginService.js)

- **Autenticación Simulada**: Verifica las credenciales contra valores hardcodeados.
- **Token de Sesión**: Genera un token aleatorio como simulación de un JWT.
- **Almacenamiento**: Utiliza localStorage para mantener la sesión activa entre recargas de página.
- **Funciones Expuestas**:
  - `login(username, password)`: Verifica credenciales y crea sesión
  - `isAuthenticated()`: Verifica si existe una sesión activa
  - `logout()`: Elimina la sesión activa

### 2. Componente de Login (Login.jsx)

- **Estado del Formulario**: Maneja los campos de usuario y contraseña.
- **Validación**: Verifica que se ingresen todos los campos requeridos.
- **Manejo de Errores**: Muestra mensajes de error en caso de credenciales inválidas.
- **Feedback Visual**: Indica al usuario cuando se está procesando el inicio de sesión.
- **Notificación**: Informa al padre del componente cuando el login es exitoso.

### 3. Integración en App.jsx

- **Estado de Autenticación**: Utiliza useState para mantener el estado de autenticación.
- **Renderizado Condicional**: Muestra el login o la aplicación según el estado de autenticación.
- **Protección de Rutas**: Verifica la autenticación antes de mostrar contenido protegido.
- **Persistencia**: Verifica el estado de autenticación en localStorage al iniciar.

## Guía de Uso Básica

### 1. Iniciar Sesión

1. Acceder a la aplicación
2. En la pantalla de login, ingresar:
   - Usuario: admin
   - Contraseña: 123456
3. Hacer clic en "Iniciar Sesión"
4. La aplicación mostrará la pantalla principal si las credenciales son correctas

### 2. Usar la Aplicación

- **Agregar un Activo**:
  1. Hacer clic en "+ Agregar activo"
  2. Ingresar el nombre del activo en el modal
  3. Hacer clic en "Agregar"
  4. Se generarán automáticamente riesgos e impactos asociados al activo

- **Editar Datos**:
  1. Hacer clic en cualquier celda de la tabla
  2. Modificar el valor
  3. Presionar Enter o hacer clic fuera de la celda para guardar

- **Eliminar un Riesgo**:
  1. Hacer clic en "Eliminar" en la fila correspondiente
  2. Confirmar la eliminación

- **Recomendar Tratamientos**:
  1. Con activos y riesgos en la tabla, hacer clic en "Recomendar tratamientos"
  2. El sistema generará automáticamente recomendaciones para cada riesgo

### 3. Cerrar Sesión

1. Hacer clic en "Cerrar Sesión" en la parte superior derecha
2. El sistema volverá a la pantalla de login

---

## Notas Adicionales

- Esta implementación es puramente frontend y simula llamadas a API con timeouts.
- Los datos no persisten entre recargas de página (excepto la sesión).
- En un entorno real, se recomendaría implementar:
  - Seguridad adecuada para tokens y contraseñas
  - Una base de datos para almacenar usuarios y credenciales
  - Comunicación segura con HTTPS
  - Expiración de sesiones

