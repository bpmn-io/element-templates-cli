const puppeteer = require('puppeteer');
const express = require('express');

const PAGE = 'http://localhost:9876/index.html';

module.exports.applyTemplate = async function applyTemplate(diagram, template, element) {
  const app = serve();

  const xml = await withPage(async page => {

    await page.goto(PAGE);

    const xml = await page.evaluate(async function(diagram, template, element) {
      const parsedTemplate = JSON.parse(template);

      // eslint-disable-next-line no-undef
      return window.applyTemplate(diagram, parsedTemplate, element);
    }, diagram, template, element);

    return xml;
  });

  app.close();

  return xml;
};

function serve() {
  const app = express();
  app.use(express.static(__dirname));

  return app.listen(9876);
}

async function withPage(fn) {
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [ '--no-sandbox' ]
    });
    const page = await browser.newPage();

    const result = await fn(page);

    return result;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
