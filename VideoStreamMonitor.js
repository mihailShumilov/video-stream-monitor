const FROZEN_EVENT = 'frozen'; //stream frozen on same frame
const CRASH_EVENT = 'crash'; //ffmpeg crashed
const FRAME_EVENT = 'frame'; //frame matched
const UP_EVENT = 'up';
const defaultOptions = {
  fuzz: 10,
  delay: 1,
  freezeTimeLimit: 30,
  checkFrames: null,
  checkFrameOptions: {},
  screenshotsPath: '/tmp/',
  actualScreenshotsPath: null,
  actualScreenshotName: null,
  limiter: null,
  differentPixelsLimit: 1000,
  useMean: false,
  silenceVolumeLevel: -91.0
};
const EventEmitter = require('events');
const { fileExists, copyFile, moveFile, removeFile, makeScreenshot, imagesEqual, now } = require('./helpers');

class VideoStreamMonitor extends EventEmitter {
  constructor(streamUrl, filename, options) {
    super();
    this.lastSeenMotion = now();
    this.url = streamUrl;
    this.filename = filename;
    this.options = Object.assign({}, defaultOptions, options);
    this.currentScreenshotPath = this.options.screenshotsPath + this.filename + '.png';
    this.previousScreenshotPath = this.options.screenshotsPath + this.filename + '.old.png';
    this.timeoutHandle = null;
    this.isPreviousExists = false;
    this.isRunning = false;
    this._makeScreenshot = (this.options.limiter === null) ? makeScreenshot : this.options.limiter.wrap(makeScreenshot);
    this.checkFrames = (this.options.checkFrames === null) ? null : this.options.checkFrames;
    this.checkFrameOptions = this.options.checkFrameOptions;
    if (this.options.actualScreenshotsPath !== null)
      this.actualScreenshotPath = `${this.options.actualScreenshotsPath}${this.options.actualScreenshotName}.png`;
  }
  _getFrameOption(type, name) {
    return (this.checkFrameOptions[ type ] && this.checkFrameOptions[ type ][ name ]) ?
      this.checkFrameOptions[ type ][ name ] : this.options[ name ];
  }
  _currentScreenshotEqual(path, fuzz, differentPixelsLimit) {
    return imagesEqual(this.currentScreenshotPath, path, fuzz, differentPixelsLimit);
  }
  async _cleanup() {
    try {
      if (this.isPreviousExists) await removeFile(this.previousScreenshotPath);
    } catch (e) {}
    this._scheduleNextCheck();
  }
  _emitter(event, payload) {
    this.emit(event, payload);
    return this._cleanup();
  }
  async _screenshotMakingError() {
    try {
      if (this.isPreviousExists) await moveFile(this.previousScreenshotPath, this.currentScreenshotPath);
    } catch (e) {}
    this.isPreviousExists = false;
    this._emitter(CRASH_EVENT);
  }
  async _check() {
    if (!this.isRunning) return;
    try {
      this.isPreviousExists = await fileExists(this.currentScreenshotPath);
      if (this.isPreviousExists) await moveFile(this.currentScreenshotPath, this.previousScreenshotPath);
    } catch (e) {
      this.isPreviousExists = false;
    }
    let volumeLevel;
    try {
      volumeLevel = await this._makeScreenshot(this.url, this.currentScreenshotPath, this.options.useMean);
    } catch (e) {
      if (!this.isRunning) return this._cleanup();
      return this._screenshotMakingError();
    }
    try {
      if (this.actualScreenshotPath) await copyFile(this.currentScreenshotPath, this.actualScreenshotPath);
    } catch (e) {}
    if (this.checkFrames)
      for (let type in this.checkFrames)
        if (this.checkFrames.hasOwnProperty(type)) {
          const fuzz = this._getFrameOption(type, 'fuzz');
          const differentPixelsLimit = this._getFrameOption(type, 'differentPixelsLimit');
          for (let errorFramePath of this.checkFrames[ type ])
            if (await this._currentScreenshotEqual(errorFramePath, fuzz, differentPixelsLimit))
              return this._emitter(FRAME_EVENT, type);
        }
    const { fuzz, differentPixelsLimit } = this.options;
    if (this.isPreviousExists && await this._currentScreenshotEqual(this.previousScreenshotPath, fuzz, differentPixelsLimit)) {
      if (((this.lastSeenMotion + this.options.freezeTimeLimit) < now()) && (volumeLevel <= this.options.silenceVolumeLevel))
        return this._emitter(FROZEN_EVENT);
    } else {
      this.lastSeenMotion = now();
    }
    return this._emitter(UP_EVENT, volumeLevel);
  }
  _scheduleNextCheck() {
    if (this.isRunning) this.timeoutHandle = setTimeout(this._check.bind(this), this.options.delay * 1000);
  }
  start() {
    this.isRunning = true;
    this._scheduleNextCheck();
  }
  stop() {
    clearTimeout(this.timeoutHandle);
    if (this.options.limiter) this.options.limiter.stop({ dropWaitingJobs: true });
    this.isRunning = false;
  }
}

module.exports = VideoStreamMonitor;
