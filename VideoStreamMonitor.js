const DOWN_EVENT = 'down';
const STILL_DOWN_EVENT = 'still_down';
const FREEZE_EVENT = 'freeze';
const CRASH_EVENT = 'crash';
const BACK_UP_EVENT = 'back_up';
const UP_EVENT = 'up';
const ERROR_REASON = 'ERROR';
const FROZEN_REASON = 'FROZEN';
const defaultOptions = {
  fuzz: 100,
  delay: 60,
  attempts: 5,
  errorFrames: null,
  screenshotsPath: '/tmp/',
  actualScreenshotsPath: null,
  actualScreenshotName: null,
  limiter: null
};
const EventEmitter = require('events');
const { fileExists, copyFile, moveFile, removeFile, makeScreenshot, imagesEqual } = require('./helpers');

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
    if (this.options.actualScreenshotsPath !== null)
      this.actualScreenshotPath = `${this.options.actualScreenshotsPath}${this.options.actualScreenshotName}.png`;
  }
  _currentScreenshotEqual(path) {
    return imagesEqual(this.currentScreenshotPath, path, this.options.fuzz);
  }
  async _cleanup() {
    try {
      if (this.isPreviousExists) await removeFile(this.previousScreenshotPath);
    } catch (e) {}
    this._scheduleNextCheck();
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
    try {
      if (this.isPreviousExists) await moveFile(this.previousScreenshotPath, this.currentScreenshotPath);
    } catch (e) {}
    this.isPreviousExists = false;
    this.emit(CRASH_EVENT);
    return this._cleanup();
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
    try {
      if (this.actualScreenshotPath) await copyFile(this.currentScreenshotPath, this.actualScreenshotPath);
    } catch (e) {}
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
      if (!this.isUp) this.emit(BACK_UP_EVENT);
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
Object.assign(VideoStreamMonitor, { ERROR_REASON, FROZEN_REASON });

module.exports = VideoStreamMonitor;
