const DOWN_EVENT = 'down';
const STILL_DOWN_EVENT = 'still_down';
const FREEZE_EVENT = 'freeze';
const UP_EVENT = 'up';
const NO_STREAM_REASON = 'NO_STREAM';
const ERROR_FRAME_REASON = 'ERROR_FRAME';
const FROZEN_REASON = 'FROZEN';
const defaultOptions = {
  fuzz: 15,
  delay: 60,
  attempts: 5,
  errorFrames: [],
  screenshotsPath: '/tmp/'
};
const EventEmitter = require('events');
const { fileExists, moveFile, removeFile, makeScreenshot, imagesEqual } = require('./helpers');

class VideoStreamMonitor extends EventEmitter {
  constructor(streamUrl, filename, options) {
    super();
    this.url = streamUrl;
    this.filename = filename;
    this.options = Object.assign({}, defaultOptions, options);
    console.log(this.options);
    this.currentScreenshotPath = this.options.screenshotsPath + this.filename + '.png';
    this.previousScreenshotPath = this.options.screenshotsPath + this.filename + '.old.png';
    this.intervalHandle = null;
    this.equalAttempts = 0;
    this.isPreviousExists = false;
    this.isUp = true;
  }
  _currentScreenshotEqual(path) {
    return imagesEqual(this.currentScreenshotPath, path, this.options.fuzz);
  }
  _cleanup() {
    if (this.isPreviousExists) return removeFile(this.previousScreenshotPath);
  }
  _errorEmitter(reason) {
    if (this.isUp) {
      this.isUp = false;
      this.emit(DOWN_EVENT, reason);
    } else {
      this.emit(STILL_DOWN_EVENT, reason);
    }
    return this._cleanup();
  }
  async _screenshotMakingError() {
    if (this.isPreviousExists) await moveFile(this.previousScreenshotPath, this.currentScreenshotPath);
    this.isPreviousExists = false;
    return this._errorEmitter(NO_STREAM_REASON);
  }
  async _check() {
    this.isPreviousExists = await fileExists(this.currentScreenshotPath);
    if (this.isPreviousExists) await moveFile(this.currentScreenshotPath, this.previousScreenshotPath);
    try {
      await makeScreenshot(this.url, this.currentScreenshotPath);
    } catch (e) {
      return this._screenshotMakingError();
    }
    if (!await fileExists(this.currentScreenshotPath)) return this._screenshotMakingError();
    for (let errorFramePath of this.options.errorFrames)
      if (await this._currentScreenshotEqual(errorFramePath))
        return this._errorEmitter(ERROR_FRAME_REASON);
    if (this.isPreviousExists && await this._currentScreenshotEqual(this.previousScreenshotPath)) {
      this.emit(FREEZE_EVENT, ++this.equalAttempts);
      if (this.equalAttempts >= this.options.attempts) return this._errorEmitter(FROZEN_REASON);
    } else {
      this.equalAttempts = 0;
      this.isUp = true;
      this.emit(UP_EVENT);
    }
    return this._cleanup();
  }
  start() {
    this.intervalHandle = setInterval(this._check.bind(this), this.options.delay * 1000);
  }
  stop() {
    clearInterval(this.intervalHandle);
  }
}

module.exports = VideoStreamMonitor;
