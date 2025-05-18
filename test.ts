
import { testConnection } from './src/lib/db.js'; // extensão .js mesmo

testConnection().then((ok) => {
  if (ok) {
    console.log('✅ Conexão com o banco de dados funcionando!');
    process.exit(0);
  } else {
    console.error('❌ Falha ao conectar com o banco de dados. Verifique os logs detalhados acima para mais informações.');
    process.exit(1);
  }
});
