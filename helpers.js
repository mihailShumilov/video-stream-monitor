const util = require('util');
const fs = require('fs');
const exec = util.promisify(require('child_process').exec);

function fileExists(path){
  return new Promise(resolve => {
    fs.access(path, fs.F_OK, error => {
      resolve(!error);
    });
  });
}

function moveFile(from, to) {
  return exec(`mv "${from}" "${to}"`);
}

function removeFile(name) {
  return exec(`rm "${name}"`);
}

function makeScreenshot(streamUrl, outPath) {
  return exec(`ffmpeg -y -i "${streamUrl}" -t 2 -vframes 1 "${outPath}"`);
}

async function imagesEqual(a, b, fuzz) {
  let stdout;
  try {
    const result = await exec(`compare -metric AE -fuzz ${fuzz}% ${a} ${b} null: 2>&1`);
    stdout = result.stdout;
  } catch (e) {
    stdout = e.stdout;
  }
  return parseInt(stdout) === 0;
}

module.exports = {
  fileExists,
  moveFile,
  removeFile,
  makeScreenshot,
  imagesEqual
};
