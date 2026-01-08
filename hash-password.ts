import bcrypt from "bcryptjs";

// Cambia estas contraseñas por las que quieras generar
const passwordsToHash = [
  "123456"
];

async function generateHashes() {
  console.log("--- GENERADOR DE HASHES PARA AVIOR ---");
  
  for (const password of passwordsToHash) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    
    console.log(`\nOriginal: ${password}`);
    console.log(`Hash:     ${hash}`);
    console.log("--------------------------------------");
  }
}

generateHashes();