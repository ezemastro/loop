const fs = require('fs');
const { execSync } = require('child_process');

// Leer el package.json
const packageJsonPath = './package.json';
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;

// Obtener el tipo de incremento desde los argumentos
const incrementType = process.argv[2] || 'patch';

// Parsear la versión actual
let [major, minor, patch] = currentVersion.split('.').map(Number);

// Incrementar la versión según el tipo
switch (incrementType) {
  case 'major':
    major += 1;
    minor = 0;
    patch = 0;
    break;
  case 'minor':
    minor += 1;
    patch = 0;
    break;
  case 'patch':
    patch += 1;
    break;
  default:
    console.log('Tipo de incremento no válido. Usa: major, minor o patch');
    process.exit(1);
}

const newVersion = `${major}.${minor}.${patch}`;

console.log(`🔄 Actualizando versión: ${currentVersion} → ${newVersion}`);

// Actualizar package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

console.log('✅ package.json actualizado');

// Ejecutar Docker build con la nueva versión
try {
  console.log(`🐳 Construyendo imagen Docker con versión ${newVersion}...`);
  
  // Ejecutar el docker build como lo tenías antes
  execSync(`docker build -f api.Dockerfile -t ezemastro/loop:${newVersion} -t ezemastro/loop:latest .`, { stdio: 'inherit' });
  
  console.log(`✅ Docker build completado para versión ${newVersion}`);
  
} catch (error) {
  console.error('❌ Error en Docker build:', error.message);
  process.exit(1);
}

// Opcional: Hacer commit y tag (puedes comentar si no lo necesitas)
try {
  execSync('git add package.json', { stdio: 'inherit' });
  execSync(`git commit -m "release: v${newVersion}"`, { stdio: 'inherit' });
  console.log(`✅ Versión ${newVersion} commitada`);
} catch (error) {
  console.log('ℹ️  Versión actualizada. Nota: No se pudo hacer commit automático');
}