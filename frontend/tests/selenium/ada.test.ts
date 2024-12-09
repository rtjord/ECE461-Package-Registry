import { Builder, WebDriver } from 'selenium-webdriver';
import { expect } from 'chai';
import 'mocha';
import fs from 'fs';
import path from 'path';
import axe, { AxeResults, Result } from 'axe-core'; // Import axe and types from axe-core

// Load axe-core script
const axeSource = fs.readFileSync(
  path.resolve('./node_modules/axe-core/axe.min.js'),
  'utf8'
);

describe('WCAG 2.1 Level AA Compliance Test for Team Five Packages Website', function () {
  let driver: WebDriver;

  this.timeout(60000);

  before(async function () {
    driver = await new Builder().forBrowser('chrome').build();
  });

  it('should pass WCAG 2.1 Level AA compliance', async function () {
    await driver.get('https://www.teamfivepackages.com');

    // Inject axe-core into the page
    await driver.executeScript(axeSource);

    // Run accessibility checks
    const results: AxeResults = await driver.executeScript(() => {
      return new Promise((resolve) => {
        axe.run(
          {
            runOnly: {
              type: 'tag',
              values: ['wcag2aa'], // Only test WCAG 2.1 AA rules
            },
          },
          (err: Error | null, results: AxeResults) => {
            if (err) throw err;
            resolve(results);
          }
        );
      });
    });

    // Parse violations
    const { violations } = results;

    // Log violations if any
    if (violations.length > 0) {
      console.log('Accessibility Violations:');
      violations.forEach((violation: Result) => {
        console.log(`- ${violation.id}: ${violation.description}`);
        violation.nodes.forEach((node) => {
          console.log(`  Element: ${node.target}`);
          console.log(`  Failure Summary: ${node.failureSummary}`);
        });
      });
    }

    // Assert no violations
    expect(violations.length).to.equal(0, 'Website is not WCAG 2.1 Level AA compliant');
  });

  after(async function () {
    await driver.quit();
  });
});
