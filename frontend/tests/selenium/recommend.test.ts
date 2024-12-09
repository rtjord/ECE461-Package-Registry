import { Builder, By, until, WebDriver, WebElement } from "selenium-webdriver";
import { expect } from "chai";

describe("Recommendation Feature Tests", function () {
  let driver: WebDriver; // Replace 'any' with 'WebDriver'

  before(async function () {
    driver = await new Builder().forBrowser("chrome").build();
  });

  after(async function () {
    await driver.quit();
  });

  it("should return package recommendations", async function () {
    await driver.get("https://www.teamfivepackages.com/recommend");

    const inputField: WebElement = await driver.findElement(By.id("recommend-description-input"));
    await inputField.sendKeys("A tool for web development");

    const recommendButton: WebElement = await driver.findElement(By.id("recommend-button"));
    await recommendButton.click();

    const recommendations: WebElement = await driver.wait(
      until.elementLocated(By.id("recommend-results")),
      5000
    );

    const items: WebElement[] = await recommendations.findElements(By.tagName("li"));
    expect(items.length).to.be.greaterThan(0);
  });
});
