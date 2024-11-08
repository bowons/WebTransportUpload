const fileInput = document.getElementById("fileInput");
const uploadButton = document.getElementById("uploadButton");

// WebTransport를 / 경로로 연결
const url = 'https://127.0.0.1:3000/';  // 서버 주소와 경로를 맞추기
const transport = new WebTransport(url);

transport.ready.then(() => {
    console.log("WebTransport connected");
}).catch((err) => {
    console.error("Error connecting to WebTransport:", err);
  });

uploadButton.addEventListener("click", async() => {
    const file = fileInput.files[0];
    if(file) {
        await uploadFile(file);
    } else {
        alert("파일을 선택해야 합니다.");
    }
});

async function uploadFile(file) {
    const chunkSize = 8192; 
    let offset = 0;

    transport.createBidirectionalStream().then((bidi) => {
        const writer = bidi.writable.getWriter();        
        
        (async() => {
            while(offset <= file.size) {
                const chunk = file.slice(offset, offset + chunkSize);
                const arrayBuffer = await chunk.arrayBuffer();
                
                writer.write(arrayBuffer);
                offset += chunkSize;
                console.log(`Uploaded chunk: ${offset}/${file.size}`);
            }
            writer.close();
            console.log("File upload Complete");
        })();
    }).catch((e) => {
        console.log(e);
    });
}

