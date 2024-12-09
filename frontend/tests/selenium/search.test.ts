import { Builder, By, until, WebDriver, WebElement } from "selenium-webdriver";
import { expect } from "chai";

describe("Search Package Tests", function () {
  let driver: WebDriver; 

  before(async function () {
    driver = await new Builder().forBrowser("chrome").build();
  });

  after(async function () {
    await driver.quit();
  });

  it("should return results for a valid package search", async function () {
    await driver.get("https://www.teamfivepackages.com");

    const searchBar: WebElement = await driver.findElement(By.id("express")); // Replace 'any' with 'WebElement'
    await searchBar.sendKeys("popular-package");
    await searchBar.sendKeys("\n");

    const results: WebElement = await driver.wait(
      until.elementLocated(By.id("search-results")),
      5000
    );
    const text: string = await results.getText(); // Ensure 'text' is a string
    expect(text).to.include("popular-package");
  });
});
