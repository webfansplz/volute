require("dotenv").config();
const fs = require("fs");
const WebSocket = require("ws");
const { resolve } = require("path");
const { createAuthParams } = require("../utils/auth");

class XunFeiTTS {
  constructor({ text, onDone }) {
    this.ws = null;
    // 要转换的文字
    this.text = text;
    this.onDone = onDone;
    // 转换后的语音文件
    this.outputFile = resolve(__dirname, "../assets/output.wav");
    // 接口入参
    this.params = {
      host: "tts-api.xfyun.cn",
      path: "/v2/tts",
      appid: process.env.XUNFEI_APP_ID,
      apiKey: process.env.XUNFEI_API_KEY,
      secret: process.env.XUNFEI_SECRET,
    };
  }
  // 生成websocket连接
  generateWsUrl() {
    const { host, path } = this.params;
    const params = createAuthParams(this.params);
    return `ws://${host}${path}?${params}`;
  }
  // 初始化
  init() {
    const reqUrl = this.generateWsUrl();
    console.log(reqUrl);
    this.ws = new WebSocket(reqUrl);
    this.initWsEvent();
  }
  // 初始化websocket事件
  initWsEvent() {
    this.ws.on("open", this.onOpen.bind(this));
    this.ws.on("error", this.onError);
    this.ws.on("close", this.onClose);
    this.ws.on("message", this.onMessage.bind(this));
  }
  /**
   *  websocket open事件,触发表示已成功建立连接
   */
  onOpen() {
    console.log("open");
    this.onSend();
    if (fs.existsSync(this.outputFile)) {
      fs.unlinkSync(this.outputFile);
    }
  }
  // 发送要转换的参数信息
  onSend() {
    const frame = {
      // 填充common
      common: {
        app_id: this.params.appid,
      },
      // 填充business
      business: {
        aue: "raw",
        auf: "audio/L16;rate=16000",
        vcn: "xiaoyan",
        tte: "UTF8",
      },
      // 填充data
      data: {
        text: Buffer.from(this.text).toString("base64"),
        status: 2,
      },
    };
    this.ws.send(JSON.stringify(frame));
  }
  // 保存转换后的语音结果
  onSave(data) {
    fs.writeFileSync(this.outputFile, data, { flag: "a" });
  }
  // websocket 消息接收 回调
  onMessage(data, err) {
    if (err) return;
    const res = JSON.parse(data);
    if (res.code !== 0) {
      this.ws.close();
      return;
    }
    // 接收消息结果并进行保存
    const audio = res.data.audio;
    const audioBuf = Buffer.from(audio, "base64");
    this.onSave(audioBuf);
    if (res.code == 0 && res.data.status == 2) {
      this.ws.close();
      this.onDone();
    }
  }
  onClose() {
    console.log("close");
  }
  onError(error) {
    console.log(error);
  }
}

module.exports = XunFeiTTS;
// const ttsService = new XunFeiTTS();
// ttsService.init();
