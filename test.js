const monitor = require('./');

const instance = new monitor('YOUR TEST STRAM URL', 'name_for_file', {delay: 10, fuzz: 10});
instance.on('down', (reason) => console.log('Channel DOWN, because ' + reason));
instance.on('still_down', (reason) => console.log('Channel STILL DOWN, because ' + reason));
instance.on('up', () => console.log('Channel UP'));
instance.on('freeze', attempt => console.log('Channel FROZEN, attempt ' + attempt));
instance.start();
