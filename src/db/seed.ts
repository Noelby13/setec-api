import bcrypt from 'bcrypt';
import { pool, withTransaction } from './pool';

interface RoleDefinition {
  nombre: string;
  descripcion: string;
}

interface PermisoDefinition {
  codigo: string;
  nombre: string;
  descripcion: string;
}

const ROLES: RoleDefinition[] = [
  {
    nombre: 'SUPER_ADMIN',
    descripcion: 'Administrador general del sistema con acceso irrestricto y control total',
  },
  {
    nombre: 'COORDINADOR',
    descripcion: 'Coordinador académico de programas, cohortes y validación de estudiantes',
  },
  {
    nombre: 'CAJERO',
    descripcion: 'Personal administrativo de caja y validación financiera de bauchers y pagos',
  },
  {
    nombre: 'DOCENTE',
    descripcion: 'Personal académico e instructor asignado a componentes formativos',
  },
  {
    nombre: 'ESTUDIANTE',
    descripcion: 'Estudiante regular o participante de educación permanente',
  },
];

const PERMISOS: PermisoDefinition[] = [
  { codigo: 'PAGO_ANULAR', nombre: 'Anulación de cobros', descripcion: 'Anular cobros aprobados con motivo y auditoría; no se concede automáticamente a Caja' },
  { codigo: 'OBLIGACION_ANULAR', nombre: 'Anulación de obligaciones', descripcion: 'Anular obligaciones sin pagos aplicados, con motivo y auditoría' },
  {
    codigo: 'CERTIFICADO_REVOCAR',
    nombre: 'Revocación de certificados',
    descripcion: 'Permite revocar certificados registrados con motivo y auditoría',
  },
  {
    codigo: 'USUARIO_GESTIONAR',
    nombre: 'Gestión Integral de Usuarios',
    descripcion: 'Permite crear, editar, asignar roles y gestionar el estado de los usuarios',
  },
  {
    codigo: 'SEDE_GESTIONAR',
    nombre: 'Gestión de Sedes Universitarias',
    descripcion: 'Administración de sedes, subsedes y extensiones autorizadas por SETEC',
  },
  {
    codigo: 'DOCENTE_GESTIONAR',
    nombre: 'Gestión de Claustro Docente',
    descripcion: 'Administración de perfiles académicos, grados y vinculación docente',
  },
  {
    codigo: 'CATALOGO_GESTIONAR',
    nombre: 'Gestión del Catálogo y Malla',
    descripcion: 'Creación y configuración de programas académicos y componentes curriculares',
  },
  {
    codigo: 'COHORTE_GESTIONAR',
    nombre: 'Gestión de Cohortes de Apertura',
    descripcion: 'Apertura, programación y control de quórum normativo en cohortes',
  },
  {
    codigo: 'INSCRIPCION_VALIDAR',
    nombre: 'Validación de Admisión e Inscripciones',
    descripcion: 'Revisión documental de títulos, cédulas y cambio de estado de matrícula',
  },
  {
    codigo: 'PAGO_VALIDAR',
    nombre: 'Validación Financiera de Pagos',
    descripcion: 'Aprobación y rechazo de bauchers bancarios y cobros en caja',
  },
  {
    codigo: 'CONVALIDACION_DICTAMINAR',
    nombre: 'Dictamen de Convalidaciones',
    descripcion: 'Acreditación y dictamen de convalidaciones de estudios previos',
  },
  {
    codigo: 'NOTA_IMPORTAR',
    nombre: 'Importación Masiva de Calificaciones',
    descripcion: 'Carga de actas de calificaciones en formato Excel bajo escala SNEPA',
  },
  {
    codigo: 'NOTA_MODIFICAR',
    nombre: 'Rectificación de Calificaciones',
    descripcion: 'Modificación de notas registradas con auditoría de cambios',
  },
  {
    codigo: 'TITULO_EMITIR',
    nombre: 'Emisión de Certificados y Títulos',
    descripcion: 'Generación de actas finales, expedientes y certificados académicos',
  },
];

const ROLE_PERMISSIONS_MAPPING: Record<string, string[]> = {
  SUPER_ADMIN: [
    'CERTIFICADO_REVOCAR',
    'USUARIO_GESTIONAR',
    'SEDE_GESTIONAR',
    'DOCENTE_GESTIONAR',
    'CATALOGO_GESTIONAR',
    'COHORTE_GESTIONAR',
    'INSCRIPCION_VALIDAR',
    'PAGO_VALIDAR',
    'CONVALIDACION_DICTAMINAR',
    'NOTA_IMPORTAR',
    'NOTA_MODIFICAR',
    'TITULO_EMITIR',
  ],
  COORDINADOR: [
    'SEDE_GESTIONAR',
    'DOCENTE_GESTIONAR',
    'CATALOGO_GESTIONAR',
    'COHORTE_GESTIONAR',
    'INSCRIPCION_VALIDAR',
    'CONVALIDACION_DICTAMINAR',
    'NOTA_IMPORTAR',
    'NOTA_MODIFICAR',
    'TITULO_EMITIR',
  ],
  CAJERO: ['PAGO_VALIDAR'],
  DOCENTE: ['NOTA_IMPORTAR'],
  ESTUDIANTE: [],
};

export async function runSeed(): Promise<void> {
  console.log('🌱 Starting database seeding process...');

  await withTransaction(async (client) => {
    // 1. Insert Roles
    console.log('📦 Seeding roles...');
    for (const role of ROLES) {
      await client.query(
        `INSERT INTO roles (nombre, descripcion)
         VALUES ($1, $2)
         ON CONFLICT (nombre) DO NOTHING;`,
        [role.nombre, role.descripcion]
      );
    }

    // 2. Insert Permissions
    console.log('🔑 Seeding permissions...');
    for (const permiso of PERMISOS) {
      await client.query(
        `INSERT INTO permisos (codigo, nombre, descripcion)
         VALUES ($1, $2, $3)
         ON CONFLICT (codigo) DO NOTHING;`,
        [permiso.codigo, permiso.nombre, permiso.descripcion]
      );
    }

    // Retrieve inserted roles and permissions map
    const rolesResult = await client.query<{ id: string; nombre: string }>('SELECT id, nombre FROM roles');
    const roleIdByName = new Map(rolesResult.rows.map((r) => [r.nombre, r.id]));

    const permisosResult = await client.query<{ id: string; codigo: string }>('SELECT id, codigo FROM permisos');
    const permisoIdByCodigo = new Map(permisosResult.rows.map((p) => [p.codigo, p.id]));

    // 3. Assign Permissions to Roles
    console.log('🔗 Assigning permissions to roles...');
    for (const [roleName, permisoCodes] of Object.entries(ROLE_PERMISSIONS_MAPPING)) {
      const roleId = roleIdByName.get(roleName);
      if (!roleId) continue;

      for (const codigo of permisoCodes) {
        const permisoId = permisoIdByCodigo.get(codigo);
        if (!permisoId) continue;

        await client.query(
          `INSERT INTO roles_permisos (rol_id, permiso_id)
           VALUES ($1, $2)
           ON CONFLICT (rol_id, permiso_id) DO NOTHING;`,
          [roleId, permisoId]
        );
      }
    }

    // 4. Create Initial Administrator User
    console.log('👤 Seeding default SUPER_ADMIN user...');
    const superAdminRoleId = roleIdByName.get('SUPER_ADMIN');
    if (!superAdminRoleId) {
      throw new Error('SUPER_ADMIN role ID not found in database');
    }

    const adminEmail = 'admin@edu.ni';
    const adminUsername = 'admin';
    const adminPasswordPlain = 'Admin123*';
    const passwordHash = await bcrypt.hash(adminPasswordPlain, 10);

    await client.query(
      `INSERT INTO usuarios (
        username,
        email,
        password_hash,
        nombres,
        apellidos,
        telefono,
        rol_id,
        activo,
        email_verificado
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (email) DO NOTHING;`,
      [
        adminUsername,
        adminEmail,
        passwordHash,
        'Administrador General',
        'SETEC',
        '+50588888888',
        superAdminRoleId,
        true,
        true,
      ]
    );

    console.log('✅ Initial database seed completed successfully!');
  });
}

// Allow direct execution via CLI
if (require.main === module) {
  runSeed()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Seeding failed with error:', err);
      await pool.end();
      process.exit(1);
    });
}
