// scripts/check-links.js
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// 讀取書籤數據（假設您的數據在 cards 陣列中，可從主頁或獨立 JSON 文件讀取）
// 這裡示範從一個獨立的 bookmarks.json 讀取，您也可以直接從主頁的 cards 變量提取
const dataPath = path.join(__dirname, '../bookmarks.json');
const cards = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// 過濾出需要檢查的 URL（避免重複）
const urls = cards.map(card => card.url).filter(Boolean);

// 配置並行檢查數量
const CONCURRENCY = 10;
let active = 0;
let index = 0;
const brokenUrls = [];

// 檢查單個 URL
function checkUrl(url) {
    return new Promise((resolve) => {
        const protocol = url.startsWith('https') ? https : http;
        const request = protocol.get(url, { timeout: 10000 }, (res) => {
            const status = res.statusCode;
            // 跟隨重定向（3xx）
            if (status >= 300 && status < 400 && res.headers.location) {
                resolve(checkUrl(res.headers.location));
            } else {
                resolve(status >= 200 && status < 400);
            }
            res.resume();
        });
        request.on('error', () => resolve(false));
        request.on('timeout', () => {
            request.destroy();
            resolve(false);
        });
        setTimeout(() => {
            request.destroy();
            resolve(false);
        }, 15000);
    });
}

// 控制並發
async function run() {
    const total = urls.length;
    console.log(`開始檢查 ${total} 個鏈接...`);

    while (index < total) {
        if (active >= CONCURRENCY) {
            await new Promise(resolve => setTimeout(resolve, 200));
            continue;
        }
        const url = urls[index++];
        active++;
        checkUrl(url).then((isAlive) => {
            if (!isAlive) {
                brokenUrls.push(url);
                console.log(`❌ 失效: ${url}`);
            } else {
                console.log(`✅ 有效: ${url}`);
            }
            active--;
        });
    }

    // 等待所有請求完成
    while (active > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 寫入報告
    const reportPath = path.join(__dirname, '../broken-links.json');
    fs.writeFileSync(reportPath, JSON.stringify(brokenUrls, null, 2));
    console.log(`檢測完成，共 ${brokenUrls.length} 個失效鏈接，報告已保存至 broken-links.json`);
}

run().catch(console.error);