// Installs NoticeBoard as a persistent Windows service, so it runs in the
// background and restarts automatically on crash or PC reboot.
//
// Run as Administrator:  node install-service.js
const path = require('path');
const { Service } = require('node-windows');

const svc = new Service({
  name: 'NoticeBoard',
  description: 'TV notice board / home dashboard server (Express + SQLite).',
  script: path.join(__dirname, 'server.js'),
  nodeOptions: [],
  workingDirectory: __dirname,
});

svc.on('install', () => {
  console.log('NoticeBoard service installed. Starting it now...');
  svc.start();
});

svc.on('alreadyinstalled', () => {
  console.log('NoticeBoard service is already installed.');
});

svc.on('start', () => {
  console.log('NoticeBoard service started. It will now run in the background and on every reboot.');
});

svc.on('error', (err) => {
  console.error('Service error:', err);
});

svc.install();
