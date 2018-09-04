const MEAN_VOLUME_REGEX = /mean_volume: (.*) dB/;
const MAX_VOLUME_REGEX = /max_volume: (.*) dB/;
const ULTRA_SILENCE = -92.0;
const util = require('util');
const fs = require('fs');
const promisifiedExec = util.promisify(require('child_process').exec);
const execOptions = {
  timeout: 10000,
  killSignal: 'SIGKILL'
};
const exec = command => promisifiedExec(command, execOptions);
function fileExists(path) {
  return new Promise(resolve => {
    fs.access(path, fs.F_OK, error => {
      resolve(!error);
    });
  });
}
function copyFile(from, to) {
  return exec(`cp -f "${from}" "${to}"`);
}
function moveFile(from, to) {
  return exec(`mv "${from}" "${to}"`);
}
function removeFile(name) {
  return exec(`rm "${name}"`);
}
async function makeScreenshot(streamUrl, outPath, useMean) {
  const fallbackCmd = `ffmpeg -y -i "${streamUrl}" -t 2 -vframes 1 "${outPath}"`;
  const cmd = `ffmpeg -y -i "${streamUrl}" -vframes 1 "${outPath}" -af volumedetect -vn -sn -t 3 -f null /dev/null 2>&1`;
  let result;
  try {
    const { stdout } = await exec(cmd);
    const regex = useMean ? MEAN_VOLUME_REGEX : MAX_VOLUME_REGEX;
    const matches = regex.exec(stdout);
    result = (matches === null) ? ULTRA_SILENCE : parseFloat(matches[1]);
  } catch (e) {}
  if (await fileExists(outPath)) return result;
  result = ULTRA_SILENCE;
  try {
    await exec(fallbackCmd);
  } catch (e) {}
  if (!await fileExists(outPath)) throw new Error('Failed to create screenshot');
  return result;
}
function now() {
  return new Date().getTime() / 1000;
}
async function imagesEqual(a, b, fuzz, differenceLimit) {
  let stdout;
  try {
    const result = await exec(`compare -metric AE -fuzz ${fuzz}% ${a} ${b} null: 2>&1`);
    stdout = result.stdout;
  } catch (e) {
    stdout = e.stdout;
  }
  return parseInt(stdout) < differenceLimit;
}
module.exports = {
  fileExists,
  copyFile,
  moveFile,
  removeFile,
  makeScreenshot,
  imagesEqual,
  now
};
