const FROZEN_EVENT = 'frozen'; //stream frozen on same frame
const CRASH_EVENT = 'crash'; //ffmpeg crashed
const FRAME_EVENT = 'frame'; //frame matched
const defaultOptions = {
  fuzz: 10,
  delay: 1,
  attempts: 5,
  checkFrames: null,
  screenshotsPath: '/tmp/',
  actualScreenshotsPath: null,
  actualScreenshotName: null,
  limiter: null,
  differentPixelsLimit: 1000,
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
    this.isRunning = false;
    this._makeScreenshot = (this.options.limiter === null) ? makeScreenshot : this.options.limiter.wrap(makeScreenshot);
    this.checkFrames = (this.options.checkFrames === null) ? null : this.options.checkFrames;
    if (this.options.actualScreenshotsPath !== null)
      this.actualScreenshotPath = `${this.options.actualScreenshotsPath}${this.options.actualScreenshotName}.png`;
  }
  _currentScreenshotEqual(path) {
    return imagesEqual(this.currentScreenshotPath, path, this.options.fuzz, this.options.differentPixelsLimit);
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
    try {
      await this._makeScreenshot(this.url, this.currentScreenshotPath);
    } catch (e) {
      return this._screenshotMakingError();
    }
    if (!await fileExists(this.currentScreenshotPath)) return this._screenshotMakingError();
    try {
      if (this.actualScreenshotPath) await copyFile(this.currentScreenshotPath, this.actualScreenshotPath);
    } catch (e) {}
    if (this.checkFrames)
      for (let type in this.checkFrames)
        if (this.checkFrames.hasOwnProperty(type))
          for (let errorFramePath of this.checkFrames[ type ])
            if (await this._currentScreenshotEqual(errorFramePath)) return this._emitter(FRAME_EVENT, type);
    if (this.isPreviousExists && await this._currentScreenshotEqual(this.previousScreenshotPath)) {
      if (++this.equalAttempts >= this.options.attempts) return this._emitter(FROZEN_EVENT);
    } else this.equalAttempts = 0;
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
    if (this.options.limiter) this.options.limiter.stop({ dropWaitingJobs: true });
    this.isRunning = false;
  }
}

module.exports = VideoStreamMonitor;
