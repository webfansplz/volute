require("dotenv").config();
const axios = require("axios");

// 太简单了..懒得解释 🐶

const TulingBotService = {
  requestUrl: "http://openapi.tuling123.com/openapi/api/v2",
  start(text) {
    return new Promise((resolve) => {
      axios
        .post(this.requestUrl, {
          reqType: 0,
          perception: {
            inputText: {
              text,
            },
          },
          userInfo: {
            apiKey: process.env.TULING_BOT_API_KEY,
            userId: process.env.TULING_BOT_USER_ID,
          },
        })
        .then((res) => {
          // console.log(JSON.stringify(res.data, null, 2));
          resolve(res.data.results[0].values.text);
        });
    });
  },
};

module.exports = TulingBotService;
