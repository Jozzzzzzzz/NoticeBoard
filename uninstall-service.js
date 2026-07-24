// Removes the NoticeBoard Windows service.
//
// Run as Administrator:  node uninstall-service.js
const path = require('path');
const { Service } = require('node-windows');

const svc = new Service({
  name: 'NoticeBoard',
  script: path.join(__dirname, 'server.js'),
});

svc.on('uninstall', () => {
  console.log('NoticeBoard service uninstalled.');
});

svc.uninstall();
