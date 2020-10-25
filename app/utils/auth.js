const crypto = require("crypto");
const qs = require("qs");

// 加密,算法 hmac-sha256
const encrypt = (secret, value) => {
  const hmac = crypto.createHmac("sha256", Buffer.from(secret));
  hmac.update(value);
  return hmac.digest("base64");
};
// 生成 signature参数
const createSignature = (host, path, dateString) => {
  return `host: ${host}\ndate: ${dateString}\nGET ${path} HTTP/1.1`;
};
// 生成 authorization_origin参数
const createAuthOrigin = (apiKey, signature) => {
  return `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
};
// string -> base64 string
const toBase64Str = (value) => Buffer.from(value).toString("base64");

// 生成鉴权参数
function createAuthParams({ host, path, apiKey, secret }) {
  const dateString = new Date().toUTCString();
  const signature = encrypt(secret, createSignature(host, path, dateString));
  const authorization = toBase64Str(createAuthOrigin(apiKey, signature));
  return qs.stringify({
    host,
    date: dateString,
    authorization,
  });
}
exports.createAuthParams = createAuthParams;
