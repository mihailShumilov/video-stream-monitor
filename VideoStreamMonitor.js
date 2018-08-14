const DOWN_EVENT = 'down';
const STILL_DOWN_EVENT = 'still_down';
const FREEZE_EVENT = 'freeze';
const UP_EVENT = 'up';
const OFFLINE_REASON = 'OFFLINE';
const ERROR_REASON = 'ERROR';
const FROZEN_REASON = 'FROZEN';
const defaultOptions = {
  fuzz: 100,
  delay: 60,
  attempts: 5,
  errorFrames: null,
  screenshotsPath: '/tmp/',
  limiter: null
};
const EventEmitter = require('events');
const { fileExists, moveFile, removeFile, makeScreenshot, imagesEqual } = require('./helpers');

class VideoStreamMonitor extends EventEmitter {
  constructor(streamUrl, filename, options) {
    super();
    this.url = streamUrl;
    this.filename = filename;
    this.options = Object.assign({}, defaultOptions, options);
    this.currentScreenshotPath = this.options.screenshotsPath + this.filename + '.png';
    this.previousScreenshotPath = this.options.screenshotsPath + this.filename + '.old.png';
    this.timeoutHandle = null;
    this.equalAttempts = 0;
    this.isPreviousExists = false;
    this.isUp = true;
    this.isRunning = false;
    this._makeScreenshot = (this.options.limiter === null) ? makeScreenshot : this.options.limiter.wrap(makeScreenshot);
    this.errorFrames = (this.options.errorFrames === null) ? null :
      Array.isArray(this.options.errorFrames) ?
        { [ERROR_REASON]: this.options.errorFrames } : this.options.errorFrames;
  }
  _currentScreenshotEqual(path) {
    return imagesEqual(this.currentScreenshotPath, path, this.options.fuzz);
  }
  _cleanup() {
    this._scheduleNextCheck();
    try {
      if (this.isPreviousExists) return removeFile(this.previousScreenshotPath);
    } catch (e) {
    
    }
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
    return this._errorEmitter(OFFLINE_REASON);
  }
  async _check() {
    try {
      this.isPreviousExists = await fileExists(this.currentScreenshotPath);
      if (this.isPreviousExists) await moveFile(this.currentScreenshotPath, this.previousScreenshotPath);
    } catch (e) {
      this.isPreviousExists = false;
    }
    try {
      await this._makeScreenshot(this.url, this.currentScreenshotPath);
    } catch (e) {
      return this._screenshotMakingError();
    }
    if (!await fileExists(this.currentScreenshotPath)) return this._screenshotMakingError();
    if (this.errorFrames)
      for (let reason in this.errorFrames)
        if (this.errorFrames.hasOwnProperty(reason))
          for (let errorFramePath of this.errorFrames[ reason ])
            if (await this._currentScreenshotEqual(errorFramePath)) return this._errorEmitter(reason);
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
  _scheduleNextCheck() {
    if (this.isRunning) this.timeoutHandle = setTimeout(this._check.bind(this), this.options.delay * 1000);
  }
  start() {
    this.isRunning = true;
    this._scheduleNextCheck();
  }
  stop() {
    clearTimeout(this.timeoutHandle);
    this.isRunning = false;
  }
}
Object.assign(VideoStreamMonitor, { ERROR_REASON, FROZEN_REASON, OFFLINE_REASON });

module.exports = VideoStreamMonitor;
