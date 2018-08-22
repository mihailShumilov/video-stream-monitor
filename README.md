# video-stream-monitor

## Installation

It needs `compare` from ImageMagick package and `ffmpeg` tools for work. Also it depends on POSIX shell utilites: `cp`, `rm`, `mv`. 

```bash
npm i video-stream-monitor
```

## Usage

```javascript
const options = {
  fuzz: 15, //threshold, in percents 
  delay: 1, //delay between checks
  attempts: 5, //how much equal frames in a row must be before emitting frozen event
  checkFrames: {
    PARENTAL_CONTROL: ['path/to/parental_frame.png'],
    ERROR_MESSAGE: ['path/to/error_message.png']
  }, 
  screenshotsPath: '/tmp/', //path where screenshots shall be saved. Do not use it for UI
  actualScreenshotsPath: 'public/thumbnails', //path where permanent screenshots shall be saved and updated on each check. Use it, if you want to show screenshot in UI
  actualScreenshotName: 'channel_25', //filename to be used for screenshots at actualScreenshotsPath
  differentPixelsLimit: 1000 //images having different pixels count below this number shall be interpreted as same (calulated after fuzz is accepted)
};
const Monitor = require('video-stream-monitor');
const instance = new Monitor('YOUR TEST STREAM URL', 'name_for_file', options);

instance.on('crash', () => console.log('ffmpeg crashed, no screenshot'));
instance.on('frame', (type) => console.log('Met frame of type ' + type));
instance.on('frozen', () => console.log('Channel FROZEN'));
instance.start();
```
