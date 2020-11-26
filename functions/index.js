const functions = require('firebase-functions');
const puppeteer = require('puppeteer');
const html_table_to_json = require('html-table-to-json');
const log = functions.logger.info;
const runtimeOpts = {
  timeoutSeconds: 20,
  memory: '2GB'
}
const region = 'europe-west1'
const cache = {}

exports.instrument_table = functions
  .runWith(runtimeOpts)
  .region(region)
  .https.onRequest(async (req, res) => {

  const { url, selector = '', validation_selector = '', ticker = '' } = req.query

  if (!url) {
    return res.send(`Invalid url: ${url}`);
  }

  const fetch_url = decodeURIComponent(url);
  const fetch_selector = decodeURIComponent(selector);
  const fetch_validation_selector = decodeURIComponent(validation_selector);

  // Serve from cache if less than 1 hour
  if (cache[url] && cache[url].data.length > 0 && cache[url].ttl > new Date()) {
    return res.json(cache[url]);
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: ["--no-sandbox"]
    });
    const page = await browser.newPage();

    log(`Fetching url: ${fetch_url} with selector: ${fetch_selector} and validation_selector: ${fetch_validation_selector}`);
    await page.setViewport({ width: 1024, height: 768 })
    await page.goto(fetch_url, { waitUntil: "networkidle2" });
    await page.waitForSelector(fetch_validation_selector);
    const html_table = await page.$eval(fetch_selector, e => e.outerHTML);
    const json_table = html_table_to_json.parse(html_table).results;
    
    // Save to cache

    const ttl = new Date()
    ttl.setHours(ttl.getHours() + 0.1);
    cache[url] = {
      data: json_table,
      ttl: ttl,
      ticker: ticker
    }

    res.json(cache[url]);
  } catch (e) {
    console.error('Caught Error: '+e);
    res.status(500).send(e);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})