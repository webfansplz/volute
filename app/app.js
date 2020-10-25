const fs = require("fs");
const path = require("path");
const Speaker = require("speaker");
const { record } = require("node-record-lpcm16");
const XunFeiIAT = require("./services/xunfeiiat.service");
const XunFeiTTS = require("./services/xunfeitts.service");
const initSnowboy = require("./services/snowboy.service");
const TulingBotService = require("./services/tulingbot.service");
// 任务调度服务
const taskScheduling = {
  // 麦克风
  mic: null,
  speaker: null,
  detector: null,
  // 音频输入流
  inputStream: null,
  // 音頻輸出流
  outputStream: null,
  init() {
    // 初始化snowboy
    this.detector = initSnowboy({
      record: this.recordSound.bind(this),
      stopRecord: this.stopRecord.bind(this),
    });
    // 管道流,将麦克风接收到的流传递给snowboy
    this.mic.pipe(this.detector);
  },
  start() {
    // 监听麦克风输入流
    this.mic = record({
      sampleRate: 16000, // 采样率
      threshold: 0.5,
      verbose: true,
      recordProgram: "arecord",
    }).stream();
    this.init();
  },
  // 记录音频输入
  recordSound() {
    // 每次记录前,先停止上次未播放完成的输出流
    this.stopSpeak();
    console.log("start record");
    // 创建可写流
    this.inputStream = fs.createWriteStream(
      path.resolve(__dirname, "./assets/input.wav"),
      {
        encoding: "binary",
      }
    );
    // 管道流,将麦克风接受到的输入流 传递给 创建的可写流
    this.mic.pipe(this.inputStream);
  },
  // 停止音频输入
  stopRecord() {
    if (this.inputStream) {
      console.log("stop record");
      // 解绑this.mac绑定的管道流
      this.mic.unpipe(this.inputStream);
      this.mic.unpipe(this.detector);
      process.nextTick(() => {
        // 销毁输入流
        this.inputStream.destroy();
        this.inputStream = null;
        // 重新初始化
        this.init();
        // 调用语音听写服务
        this.speech2Text();
      });
    }
  },
  // speech to text
  speech2Text() {
    // 实例化 语音听写服务
    const iatService = new XunFeiIAT({
      onReply: (msg) => {
        console.log("msg", msg);
        // 回调,调用聊天功能
        this.onChat(msg);
      },
    });
    iatService.init();
  },
  // 聊天->图灵机器人
  onChat(text) {
    // 实例化聊天机器人
    TulingBotService.start(text).then((res) => {
      console.log(res);
      // 接收到聊天消息,调用语音合成服务
      this.text2Speech(res);
    });
  },
  // text to speech
  text2Speech(text) {
    // 实例化 语音合成服务
    const ttsService = new XunFeiTTS({
      text,
      onDone: () => {
        console.log("onDone");
        this.onSpeak();
      },
    });
    ttsService.init();
  },
  // 播放,音频输出
  onSpeak() {
    // 实例化speaker,用于播放语音
    this.speaker = new Speaker({
      channels: 1,
      bitDepth: 16,
      sampleRate: 16000,
    });
    // 创建可读流
    this.outputStream = fs.createReadStream(
      path.resolve(__dirname, "./assets/output.wav")
    );
    // this is just to activate the speaker, 2s delay
    this.speaker.write(Buffer.alloc(32000, 10));
    // 管道流,将输出流传递给speaker进行播放
    this.outputStream.pipe(this.speaker);
    this.outputStream.on("end", () => {
      this.outputStream = null;
      this.speaker = null;
    });
  },
  // 停止播放
  stopSpeak() {
    this.outputStream && this.outputStream.unpipe(this.speaker);
  },
};
taskScheduling.start();
