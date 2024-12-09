import { Builder, By, until, WebDriver, WebElement } from "selenium-webdriver";
import { expect } from "chai";

describe("Submit Package Tests", function () {
  let driver: WebDriver; // Replace 'any' with 'WebDriver'

  before(async function () {
    driver = await new Builder().forBrowser("chrome").build();
  });

  after(async function () {
    await driver.quit();
  });

  it("should submit a package successfully", async function () {
    await driver.get("https://www.teamfivepackages.com/submit");

    // Find and interact with elements
    await driver.findElement(By.id("package-name-input")).sendKeys("test-package");
    await driver.findElement(By.id("package-description-input")).sendKeys("This is a test package.");
    await driver.findElement(By.id("package-tags-input")).sendKeys("test, selenium");
    await driver.findElement(By.id("submit-button")).click();

    // Wait for success message and get text
    const successMessage: WebElement = await driver.wait(
      until.elementLocated(By.id("success-message")),
      5000
    );
    const text: string = await successMessage.getText(); // Ensure 'text' is a string
    expect(text).to.include("Package submitted successfully");
  });
});
