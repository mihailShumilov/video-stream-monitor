const monitor = require('./');
const Bottleneck = require('bottleneck');
const limiter = new Bottleneck({
  maxConcurrent: 2,
  minTime: 1000
});
const util = require('util');
const readdir = util.promisify(require('fs').readdir);
async function getFullPaths(dir) {
  const frames = await readdir(dir);
  return frames.map(frame => dir + frame);
}
const uris = [

];
async function main() {
  const errorFrames = {
    [monitor.OFFLINE_REASON]: await getFullPaths('/root/error_messages/offline/'),
    [monitor.ERROR_REASON]: await getFullPaths('/root/error_messages/box_errors/')
  };
  let i = 0;
  for (let uri of uris) {
    i++;
    const instance = new monitor(uri, `test_channel_${i}`, {delay: 2, fuzz: 100, limiter, errorFrames});
    instance.on('down', (reason) => console.log(`Channel ${i} DOWN, because ${reason}`));
    instance.on('still_down', (reason) => console.log(`Channel ${i} STILL DOWN, because ${reason}`));
    instance.on('up', () => console.log(`Channel ${i} UP`));
    instance.on('freeze', attempt => console.log(`Channel ${i} FROZEN, attempt ` + attempt));
    instance.start();
  }
}
main();


