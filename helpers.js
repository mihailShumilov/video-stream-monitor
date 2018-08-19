const MEAN_VOLUME_REGEX = /mean_volume: (.*) dB/;
const MAX_VOLUME_REGEX = /max_volume: (.*) dB/;
const util = require('util');
const fs = require('fs');
const exec = util.promisify(require('child_process').exec);
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
  const cmd = `ffmpeg -y -i "${streamUrl}" -vframes 1 "${outPath}" -af volumedetect -vn -sn -t 3 -f null /dev/null 2>&1`;
  const { stdout } = await exec(cmd);
  const regex = useMean ? MEAN_VOLUME_REGEX : MAX_VOLUME_REGEX;
  const matches = regex.exec(stdout);
  if (matches === null) throw new Error('Volumedetect failed');
  return parseFloat(matches[1]);
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
