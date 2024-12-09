import { Builder, By, until, WebDriver } from 'selenium-webdriver';
import { expect } from 'chai';
import 'mocha';

describe('Team Five Packages Website', function () {
    let driver: WebDriver;
  
    // Initialize WebDriver
    before(async function () {
      driver = await new Builder().forBrowser('chrome').build();
    });


    it('should load the homepage with correct title', async function () {
        await driver.get('https://www.teamfivepackages.com');
        const title = await driver.getTitle();
        expect(title).to.include('Team Five Packages'); // Replace with expected title
    });


    it('should navigate to the Packages page', async function () {
        const packagesLink = await driver.findElement(By.linkText('Packages'));
        await packagesLink.click();
    
        await driver.wait(until.urlContains('/packages'), 5000); // Adjust timeout as needed
        const currentUrl = await driver.getCurrentUrl();
        expect(currentUrl).to.include('/packages');
    });

  
    it('should search for a package and display results', async function () {
    const searchBox = await driver.findElement(By.name('search')); // Adjust selector
    await searchBox.sendKeys('example-package');

    const searchButton = await driver.findElement(By.css('button[type="submit"]'));
    await searchButton.click();

    await driver.wait(until.elementLocated(By.css('.package-result')), 5000); // Adjust selector
    const results = await driver.findElements(By.css('.package-result'));
    expect(results.length).to.be.greaterThan(0); // Ensure results are displayed
    });

    
  // Quit WebDriver after tests
  after(async function () {
    await driver.quit();
  });
});