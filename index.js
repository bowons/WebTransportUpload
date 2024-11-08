import fs from "fs";
import path from "path"
import { readFile } from "node:fs/promises";
import { createServer } from "node:https";
import { Http3Server } from "@fails-components/webtransport";

// 현재 디렉토리 경로를 구하기 위한 코드 (ES 모듈에서 __dirname 대신 사용)
const __dirname = path.dirname(new URL(import.meta.url).pathname);
// '/C:/Users/...' 형식의 경로에서 앞의 '/'를 제거
let normalizedPath = __dirname.startsWith('/') ? __dirname.slice(1) : __dirname;

console.log(normalizedPath);
// SSL/TLS 인증서를 읽어들입니다
const key = await readFile("./key.pem");
const cert = await readFile("./cert.pem");

// HTTPS Server를 생성합니다
const httpsServer = createServer({
  key,
  cert
}, async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    const content = await readFile("./index.html");
    res.writeHead(200, { "content-type": "text/html" });
    res.write(content);
    res.end();
  }
  // app.js 파일 제공
  else if (req.method === "GET" && req.url === "/app.js") {
    const jsContent = await readFile("./app.js");  // app.js 파일을 읽어옵니다
    res.writeHead(200, { "content-type": "application/javascript" });
    res.write(jsContent);
    res.end();
  }
  else {
    res.writeHead(404).end();
  }
});

const port = process.env.PORT || 3000;

httpsServer.listen(port, () => {
  console.log(`server listening at https://localhost:${port}`);
});

// WebTransport을 처리할 Http3Server 설정
const h3Server = new Http3Server({
  port,
  host: "127.0.0.1",
  secret: "changeit", // 임의로 설정한 비밀 키
  cert,
  privKey: key,
});

// WebTransport 연결을 처리하기 위해 sessionStream 사용
async function handleWebTransport() {
  const stream = await h3Server.sessionStream("/"); // 이 경로로 WebTransport 연결을 수용합니다.
  const reader = stream.getReader();
  reader.closed.catch((e) => console.log("session reader closed with error!", e));
  
  console.log("sessionReader.read() - waiting for session...");
  const { done, value } = await reader.read();

  value.closed.then((e) => {
    console.log("Session closed successfully!");
    console.log(e)
  }).catch((e) => {
    console.log("Session closed with error! " + e);
  });

  value.ready.then(() => {
    console.log("session ready!");
    
    const bds = value.incomingBidirectionalStreams;
    const videoReader = bds.getReader();
    (async() => {
      while(true) {
        const { done, value } = await videoReader.read();
        if(done) {break;}
        
        const chunkreader = value.readable.getReader();
        const outputFilePath = path.join(normalizedPath, 'uploaded_video.mp4');
        const fileWriter = fs.createWriteStream(outputFilePath, {flags:'a'});
        {
          while(true) {
            const {done, value} = await chunkreader.read();
            if (done) {break;}
            fileWriter.write(value);
          }
        }
        fileWriter.end();
        console.log("Chunk saved to file.");
      }
    })().catch((err) => console.error("Error while processing chunks:", err));

  }).catch((e) => {
    console.log("session failed to be ready!");
    console.log(e);
  });

  h3Server.onServerClose();
}

// Http3Server 시작
await h3Server.startServer();

// WebTransport 연결을 처리하는 함수 호출
handleWebTransport().catch((err) => {
  console.error("Error handling WebTransport connection:", err);
});
