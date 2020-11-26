const functions = require('firebase-functions');
const puppeteer = require('puppeteer');
const html_table_to_json = require('html-table-to-json');
const log = functions.logger.info;

const runtimeOpts = {
  timeoutSeconds: 20,
  memory: '2GB'
}
const region = 'europe-west1'

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

  let browser;
  try {
    // [START puppeteer-block]
    // launch Puppeteer and start a Chrome DevTools Protocol (CDP) session
    // with performance tracking enabled.
    browser = await puppeteer.launch({
      args: ["--no-sandbox"]
    });
    const page = await browser.newPage();
    // const client = await page.target().createCDPSession();
    // await client.send('Performance.enable');

    // browse to the page, capture and write the performance metrics
    log(`Fetching url: ${url} with selector: ${selector} and validation_selector: ${validation_selector}`);
    await page.setViewport({ width: 500, height: 1000 })
    await page.goto(url, { waitUntil: "networkidle2" });

    await page.waitForSelector(validation_selector || "instrumenthistory history table tbody > tr:nth-child(1) > td.cell-table__num");
    const html_table = await page.$eval(selector, e => e.outerHTML);
    const json_table = html_table_to_json.parse(html_table).results;
    
    //res.send(html_table)
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