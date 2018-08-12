# video-stream-monitor

## Installation

It needs `compare` from ImageMagick package and `ffmpeg` tools for work. Also it depends on POSIX shell utilites: `cp`, `rm`, `mv`. 

```bash
npm i video-stream-monitor
```

## Usage

```javascript
//here described all options with default values
const options = {
  fuzz: 15, //threshold, in percents 
  delay: 60, //delay between checks
  attempts: 5, //attempts count 
  errorFrames: [], //paths to images, which are displayed in case of channel is down
  screenshotsPath: '/tmp/' //path where screenshots shall be saved
};
const Monitor = require('video-stream-monitor');
const instance = new Monitor('YOUR TEST STRAM URL', 'name_for_file', options);

instance.on('down', (reason) => console.log('Channel DOWN, because ' + reason));
instance.on('still_down', (reason) => console.log('Channel STILL DOWN, because ' + reason));
instance.on('up', () => console.log('Channel UP'));
instance.on('freeze', attempt => console.log('Channel FROZEN, attempt ' + attempt));
instance.start();
```
