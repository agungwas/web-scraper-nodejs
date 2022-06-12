const puppeteer = require('puppeteer');
const fs = require('fs/promises');
const { parseAsync } = require('json2csv');


(async function() {
  let result = []
  const options = { headless: false, ignoreDefaultArgs: process.platform === 'win32' ? ['--disable-extensions'] : undefined }
  const browser = await puppeteer.launch(options)
  const page = await browser.newPage()

  // await page.setViewport({
  //   width: 1920,
  //   height: 1080,
  //   deviceScaleFactor: 1,
  // });

  let loadingCount = 0
  const logger = setInterval(() => {
    if (loadingCount > 4) loadingCount = 0
    let loadingText = 'Scraping data'
    for (let a = 0; a < loadingCount; a++) loadingText += '.'

    console.clear()
    console.log(loadingText)
    loadingCount++
    if (result.length > 100) clearInterval(logger)
  }, 1000);

  for (let pagiPage = 1; result.length < 100; pagiPage++) {
    const navigate = page.waitForNavigation()
    await page.goto('https://www.tokopedia.com/p/handphone-tablet/handphone?ob=5&page=' + pagiPage)
    await navigate

    await page.evaluate(() => {
      return new Promise((resolve) => {
        const timer = setInterval(() => {
          document.scrollingElement.scrollBy(0, Math.floor(Math.random() * 100));
          if (document.scrollingElement.scrollTop + window.innerHeight >= document.scrollingElement.scrollHeight) {
            clearInterval(timer);
            resolve()
          }
        }, Math.floor(Math.random() * 100));
      })
    })

    await page.waitForSelector('#zeus-root > div > div:nth-child(2) > div > div.css-1xpribl.e1nlzfl3 > div > div.css-18p2ktc > div.css-13wayc1 > div.css-1dq1dix > div.css-13l3l78.e1nlzfl9')
    const populatedData = await page.evaluate(() => {
      const currPageData = []
      const listChild = document.querySelector('#zeus-root > div > div:nth-child(2) > div > div.css-1xpribl.e1nlzfl3 > div > div.css-18p2ktc > div.css-13wayc1 > div.css-1dq1dix > div.css-13l3l78.e1nlzfl9').children
      
      for (const el of listChild) {
        if (el.querySelector('a > div.css-16vw0vn > div.css-11s9vse > div.css-nysll7')) continue

        currPageData.push({
          link: el.querySelector('a').href,
          name: el.querySelector('a > div.css-16vw0vn > div.css-11s9vse > span').innerText,
          price: el.querySelector('a > div.css-16vw0vn > div.css-11s9vse > div:nth-child(2) > div > span').innerText,
          store: el.querySelector('a > div.css-16vw0vn > div.css-11s9vse > div.css-tpww51 > div > span:nth-child(2)').innerText
        })
      }

      return currPageData
    })

    result = [...result, ...await populatedData]
  }   

  browser.close()

  let detailBrowser = await puppeteer.launch(options)
  const stringResult = []

  for (let a = 0; a < 100; a++) {
    let loadingCount = 0
    const logger = setInterval(() => {
      if (loadingCount > 4) loadingCount = 0
      let loadingText = 'Populating ' + (a + 1) + ' from 100 data'
      for (let a = 0; a < loadingCount; a++) loadingText += '.'

      console.clear()
      console.log(loadingText)
      loadingCount++
    }, 1000);

    const el = result[a]
    if (a % 10 === 0) {
      detailBrowser.close()
      detailBrowser = await puppeteer.launch(options)
    }
    
    const detailPage = await detailBrowser.newPage()
    const navigate = detailPage.waitForNavigation()
    await detailPage.goto(el.link)
    await navigate

    await detailPage.waitForSelector('#pdp_comp-product_media > div > div.css-1k04i9x > div > div', { timeout: 50000 })
    await detailPage.waitForSelector('#pdp_comp-product_content > div > div.css-7fidm1 > div > div:nth-child(3) > span:nth-child(1) > span.main', { timeout: 50000 })
    await detailPage.waitForSelector('#pdp_comp-product_detail > div:nth-child(2) > div:nth-child(2) > div > span > span > div', { timeout: 50000 })

    const newDetail = await detailPage.evaluate(() => {
      const rating = document.querySelector('#pdp_comp-product_content > div > div.css-7fidm1 > div > div:nth-child(3) > span:nth-child(1) > span.main').innerText
      const description = document.querySelector('#pdp_comp-product_detail > div:nth-child(2) > div:nth-child(2) > div > span > span > div').innerHTML
      const arrImages = document.querySelector('#pdp_comp-product_media > div > div.css-1k04i9x > div > div').children
      let images = []
      for (const img of arrImages) images.push(img.querySelector('div > div > img').src);

      return { images, rating, description }
    })

    detailPage.close()
    clearInterval(logger);
    stringResult.push({
      Name: el.name, 
      Description: newDetail.description,
      Images: newDetail.images, 
      Price: el.price, 
      Rating: newDetail.rating,
      Merchant: el.store
    })
  }


  let fields = ['Name', 'Description', 'Images', 'Price', 'Rating', 'Merchant']

  const csv = await parseAsync(stringResult, { fields })
  await fs.writeFile('./file.csv', csv);

  console.clear()
  console.log('Scraping 100 data success')
  process.exit()
})()

