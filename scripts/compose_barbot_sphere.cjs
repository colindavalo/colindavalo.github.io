const {chromium}=require('playwright');
const fs=require('fs'),path=require('path');
(async()=>{
 const source=path.resolve(__dirname,'../pictures/barbot-limit-sphere.jpg');
 const data=p=>'data:image/'+({'.webp':'webp','.png':'png','.jpg':'jpeg'}[path.extname(p)])+';base64,'+fs.readFileSync(p).toString('base64');
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:2400,height:1400},deviceScaleFactor:1});
 await page.setContent(`<style>*{box-sizing:border-box}body{margin:0;background:#fff;font-family:Georgia,serif;color:#243c3b}.spread{width:2400px;height:1400px;display:grid;grid-template-columns:1000px 1400px;align-items:center}.panel{text-align:center}.figure{height:1300px;display:flex;align-items:center;justify-content:center}.diagram{width:900px;height:auto}.sphere{width:1400px;height:1300px}p{font-size:30px;margin:18px 0 0}</style><div class="spread"><div class="panel"><div class="figure"><img class="diagram" src="${data(path.resolve(__dirname,'../pictures/barbot-figure-1-complete.png'))}"></div><p>ℍ² ⊂ SL(3,ℝ)/SO(3)</p></div><div class="panel"><div class="figure"><img class="sphere" src="${data(source)}"></div><p>Limit curve in ℝP²</p></div></div>`);
 await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
 await page.screenshot({path:path.resolve(__dirname,'../pictures/barbot-figure-and-limit-sphere.jpg'),type:'jpeg',quality:96});
 await browser.close();
})();
