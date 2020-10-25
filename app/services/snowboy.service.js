const path = require("path");
const snowboy = require("snowboy");
const models = new snowboy.Models();

// 添加训练模型
models.add({
  file: path.resolve(__dirname, "../configs/volute.pmdl"),
  sensitivity: "0.5",
  hotwords: "volute",
});

// 初始化 Detector 对象
const detector = new snowboy.Detector({
  resource: path.resolve(__dirname, "../configs/common.res"),
  models: models,
  audioGain: 1.0,
  applyFrontend: false,
});

/**
 * 初始化 initSnowboy
 * 实现思路:
 * 1. 监听到热词,进行唤醒,开始录音
 * 2. 录音期间,有声音时,重置silenceCount参数
 * 3. 录音期间,未接受到声音时,对silenceCount进行累加,当累加值大于3时,停止录音
 */
function initSnowboy({ record, stopRecord }) {
  const MAX_SILENCE_COUNT = 3;
  let silenceCount = 0,
    speaking = false;
  /**
   * silence事件回调,没声音时触发
   */
  const onSilence = () => {
    console.log("silence");
    if (speaking && ++silenceCount > MAX_SILENCE_COUNT) {
      speaking = false;
      stopRecord && stopRecord();
      detector.off("silence", onSilence);
      detector.off("sound", onSound);
      detector.off("hotword", onHotword);
    }
  };
  /**
   * sound事件回调,有声音时触发
   */
  const onSound = () => {
    console.log("sound");
    if (speaking) {
      silenceCount = 0;
    }
  };
  /**
   * hotword事件回调,监听到热词时触发
   */
  const onHotword = (index, hotword, buffer) => {
    if (!speaking) {
      silenceCount = 0;
      speaking = true;
      record && record();
    }
  };
  detector.on("silence", onSilence);
  detector.on("sound", onSound);
  detector.on("hotword", onHotword);
  return detector;
}

module.exports = initSnowboy;
