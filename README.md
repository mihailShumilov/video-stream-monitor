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
  screenshotsPath: '/tmp/' //path where screenshots shall be saved
};
const Monitor = require('video-stream-monitor');
const instance = new Monitor('YOUR TEST STREAM URL', 'name_for_file', options);

instance.on('crash', () => console.log('ffmpeg crashed, no screenshot'));
instance.on('frame', (type) => console.log('Met frame of type ' + type));
instance.on('frozen', () => console.log('Channel FROZEN'));
instance.start();
```
