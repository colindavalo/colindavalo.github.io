const {chromium}=require('playwright');
const fs=require('fs'),path=require('path');
(async()=>{
 const source=path.resolve(__dirname,'../pictures/barbot-limit-sphere.jpg');
 const data=p=>'data:image/'+(p.endsWith('webp')?'webp':'jpeg')+';base64,'+fs.readFileSync(p).toString('base64');
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:2400,height:1350},deviceScaleFactor:1});
 await page.setContent(`<style>*{box-sizing:border-box}body{margin:0;background:#fff;font-family:Georgia,serif;color:#243c3b}.spread{width:2400px;height:1350px;display:grid;grid-template-columns:1000px 1400px;align-items:center}.panel{display:flex;align-items:center;justify-content:center;flex-direction:column;gap:48px}.diagram{width:900px;height:auto}.sphere{width:1400px;height:1300px}p{font-size:30px;margin:0}span{font-style:italic}</style><div class="spread"><div class="panel"><img class="diagram" src="${data(path.resolve(__dirname,'../pictures/barbot-figure-1.webp'))}"><p>ℍ² ⊂ SL(3,ℝ)/SO(3)</p></div><img class="sphere" src="${data(source)}"></div>`);
 await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
 await page.screenshot({path:path.resolve(__dirname,'../pictures/barbot-figure-and-limit-sphere.jpg'),type:'jpeg',quality:96});
 await browser.close();
})();
