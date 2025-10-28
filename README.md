# GymTracker

Aplicación web para gestionar y clasificar documentos asociados a colaboradores.

## Requisitos

- [Node.js](https://nodejs.org/) 18 o superior

## Puesta en marcha

```bash
npm install
npm start
```

El servidor local quedará disponible en `http://localhost:3000`.

## Acceso de administrador

El acceso a la aplicación está protegido mediante autenticación contra una base de datos SQL Server. Configura las credenciales antes de ejecutar el servidor.

### Variables de entorno mínimas

Puedes definirlas en un archivo `.env` (y luego cargarlo con herramientas como [dotenv-cli](https://www.npmjs.com/package/dotenv-cli)) o directamente en tu terminal antes de ejecutar `npm start`.

```bash
set SQL_SERVER="(localdb)\MSSQLLocalDB"
set SQL_DATABASE="GymTracker"
set SQL_USER="tu_usuario"
set SQL_PASSWORD="tu_contraseña"
```

Si utilizas autenticación integrada de Windows con LocalDB, instala el controlador opcional `msnodesqlv8` y exporta la cadena de conexión completa:

```bash
set SQL_DRIVER=msnodesqlv8
set "SQL_CONNECTION_STRING=Server=(localdb)\MSSQLLocalDB;Database=GymTracker;Trusted_Connection=Yes;"
```

> **Nota:** la aplicación espera que exista una tabla `AdminUsers` (puedes renombrarla configurando `SQL_LOGIN_QUERY`).

```sql
CREATE TABLE AdminUsers (
    Id INT IDENTITY PRIMARY KEY,
    Username NVARCHAR(255) NOT NULL UNIQUE,
    Password NVARCHAR(255) NOT NULL
);

INSERT INTO AdminUsers (Username, Password)
VALUES ('admin', 'admin123');
```

Por defecto, la consulta utilizada para validar las credenciales es:

```sql
SELECT TOP 1 username FROM AdminUsers
WHERE username = @username AND password = @password;
```

Puedes sobreescribirla a través de la variable `SQL_LOGIN_QUERY` si deseas adaptar la estructura de tu tabla o utilizar funciones de hashing.

Para cerrar la sesión activa selecciona el botón **🔐 Cerrar sesión** en el encabezado.
