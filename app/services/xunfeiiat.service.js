require("dotenv").config();
const fs = require("fs");
const WebSocket = require("ws");
const { resolve } = require("path");
const { createAuthParams } = require("../utils/auth");

class XunFeiIAT {
  constructor({ onReply }) {
    super();
    // websocket 连接
    this.ws = null;
    // 返回结果,解析后的消息文字
    this.message = "";
    this.onReply = onReply;
    // 需要进行转换的输入流 语音文件
    this.inputFile = resolve(__dirname, "../assets/input.wav");
    // 接口 入参
    this.params = {
      host: "iat-api.xfyun.cn",
      path: "/v2/iat",
      apiKey: process.env.XUNFEI_API_KEY,
      secret: process.env.XUNFEI_SECRET,
    };
  }
  // 生成websocket连接
  generateWsUrl() {
    const { host, path } = this.params;
    // 接口鉴权,参数加密
    const params = createAuthParams(this.params);
    return `ws://${host}${path}?${params}`;
  }
  // 初始化
  init() {
    const reqUrl = this.generateWsUrl();
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
    this.onPush(this.inputFile);
  }
  onPush(file) {
    this.pushAudioFile(file);
  }
  // websocket 消息接收 回调
  onMessage(data) {
    const payload = JSON.parse(data);
    if (payload.data && payload.data.result) {
      // 拼接消息结果
      this.message += payload.data.result.ws.reduce(
        (acc, item) => acc + item.cw.map((cw) => cw.w),
        ""
      );
      // status 2表示结束
      if (payload.data.status === 2) {
        this.onReply(this.message);
      }
    }
  }
  // websocket 关闭事件
  onClose() {
    console.log("close");
  }
  // websocket 错误事件
  onError(error) {
    console.log(error);
  }
  /**
   * 解析语音文件,将语音以二进制流的形式传送给后端
   */
  pushAudioFile(audioFile) {
    this.message = "";
    // 发送需要的载体参数
    const audioPayload = (statusCode, audioBase64) => ({
      common:
        statusCode === 0
          ? {
              app_id: "5f6cab72",
            }
          : undefined,
      business:
        statusCode === 0
          ? {
              language: "zh_cn",
              domain: "iat",
              ptt: 0,
            }
          : undefined,
      data: {
        status: statusCode,
        format: "audio/L16;rate=16000",
        encoding: "raw",
        audio: audioBase64,
      },
    });
    const chunkSize = 9000;
    // 创建buffer,用于存储二进制数据
    const buffer = Buffer.alloc(chunkSize);
    // 打开语音文件
    fs.open(audioFile, "r", (err, fd) => {
      if (err) {
        throw err;
      }

      let i = 0;
      // 以二进制流的形式递归发送
      function readNextChunk() {
        fs.read(fd, buffer, 0, chunkSize, null, (errr, nread) => {
          if (errr) {
            throw errr;
          }
          // nread表示文件流已读完,发送传输结束标识(status=2)
          if (nread === 0) {
            this.ws.send(
              JSON.stringify({
                data: { status: 2 },
              })
            );

            return fs.close(fd, (err) => {
              if (err) {
                throw err;
              }
            });
          }

          let data;
          if (nread < chunkSize) {
            data = buffer.slice(0, nread);
          } else {
            data = buffer;
          }

          const audioBase64 = data.toString("base64");
          const payload = audioPayload(i >= 1 ? 1 : 0, audioBase64);
          this.ws.send(JSON.stringify(payload));
          i++;
          readNextChunk.call(this);
        });
      }

      readNextChunk.call(this);
    });
  }
}

module.exports = XunFeiIAT;
