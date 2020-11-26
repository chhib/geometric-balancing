const functions = require('firebase-functions');
const puppeteer = require('puppeteer');
const html_table_to_json = require('html-table-to-json');
const log = functions.logger.info;
const runtimeOpts = {
  timeoutSeconds: 20,
  memory: '2GB'
}
const region = 'europe-west1'
const cache = {
  json_table: [],
  ttl: new Date(),
}

exports.instrument_table = functions
  .runWith(runtimeOpts)
  .region(region)
  .https.onRequest(async (req, res) => {

  let { url, selector = '', validation_selector = '' } = req.query

  if (!url) {
    return res.send(`Invalid url: ${url}`);
  }

  url = decodeURIComponent(url);
  selector = decodeURIComponent(selector);
  validation_selector = decodeURIComponent(validation_selector);

  // Serve from cache if less than 1 hour
  if (cache.json_table.length > 0 && cache.ttl > new Date()) {
    return res.json(cache.json_table);
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: ["--no-sandbox"]
    });
    const page = await browser.newPage();

    log(`Fetching url: ${url} with selector: ${selector} and validation_selector: ${validation_selector}`);
    await page.setViewport({ width: 500, height: 1000 })
    await page.goto(url, { waitUntil: "networkidle2" });
    await page.waitForSelector(validation_selector);
    const html_table = await page.$eval(selector, e => e.outerHTML);
    const json_table = html_table_to_json.parse(html_table).results;
    
    // Save to cache
    cache.json_table = json_table
    const dateInOneHour = new Date()
    dateInOneHour.setHours(dateInOneHour.getHours() + 1);
    cache.ttl = dateInOneHour 

    res.json(json_table);
  } catch (e) {
    console.error('Caught Error: '+e);
    res.status(500).send(e);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})