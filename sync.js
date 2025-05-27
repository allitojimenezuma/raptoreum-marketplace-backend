import {sequelize}  from './model/index.js';


sequelize.sync({ alter: true }) // usar { force: true } si quieres reiniciar
  .then(() => {
    console.log('✅ Tablas creadas correctamente');
    process.exit();
  })
  .catch(err => {
    console.error('❌ Error al sincronizar modelos:', err);
    process.exit(1);
  });
