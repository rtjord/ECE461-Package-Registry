import { Builder, By, until, WebDriver } from 'selenium-webdriver';
import { expect } from 'chai';
import 'mocha';

describe('Team Five Packages Website', function () {
  let driver: WebDriver;

  // Increase test timeout for slow loading pages
  this.timeout(30000);

  // Initialize WebDriver
  before(async function () {
    driver = await new Builder().forBrowser('chrome').build();
  });

  it('should load the homepage with the correct title', async function () {
    await driver.get('https://www.teamfivepackages.com');

    // Wait for the title to load
    await driver.wait(until.titleContains('NPM-like Package Manager'), 10000);

    const title = await driver.getTitle();
    expect(title).to.include('NPM-like Package Manager'); // Replace with actual title
  });

  it('should navigate to the Packages page', async function () {
    // Wait for the "Packages" link to be visible
    const packagesLink = await driver.wait(until.elementLocated(By.linkText('Package Directory')), 10000);
    await packagesLink.click();

    // Wait for the URL to change
    await driver.wait(until.urlContains('/packages'), 10000);

    const currentUrl = await driver.getCurrentUrl();
    expect(currentUrl).to.include('/packages');
  });

  it('should search for a package and display results', async function () {
    await driver.get('https://www.teamfivepackages.com');
    // Wait for the search box to be visible
    const searchBox = await driver.wait(until.elementLocated(By.name('Enter package name, ID, or search pattern...')), 10000);
    await searchBox.sendKeys('debug');

    // Wait for the search button and click it
    const searchButton = await driver.wait(until.elementLocated(By.linkText('Search by Name')), 10000);
    await searchButton.click();

    // Wait for the search results to be displayed
    await driver.wait(until.elementsLocated(By.css('.package-result')), 10000);

    const results = await driver.findElements(By.css('.package-result'));
    expect(results.length).to.be.greaterThan(0); // Ensure results are displayed
  });

  // Quit WebDriver after tests
  after(async function () {
    await driver.quit();
  });
});
