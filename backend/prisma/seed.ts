import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando carga de datos base (Seeding)...');

  // 1. Roles de Usuario
  const roles = [
    { name: 'Super Admin' },
    { name: 'RH' },
    { name: 'Supervisor' },
    { name: 'Instructor' },
    { name: 'Gerente' },
    { name: 'Consulta' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

  // 2. Categorías de Capacitación (STPS Iniciales)
  const categorias = [
    { name: 'Procedimientos Operativos' },
    { name: 'Normas STPS' },
    { name: 'CAP' },
    { name: 'Técnica' },
    { name: 'Pláticas de Seguridad' },
    { name: 'Pláticas de Empalme' },
  ];

  for (const cat of categorias) {
    await prisma.categoriaCapacitacion.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }

  // 3. Unidad de Negocio Inicial
  await prisma.unidadNegocio.upsert({
    where: { code: 'PLT-01' },
    update: {},
    create: {
      name: 'Planta Principal',
      code: 'PLT-01',
    },
  });

  console.log('✅ Seeding completado exitosamente.');
}

main()
  .catch((e) => {
    console.error('❌ Error en Seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
