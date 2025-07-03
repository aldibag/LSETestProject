import { Given, When, Then } from "@cucumber/cucumber";
import { chromium, Browser, Page } from "playwright";
import assert from "node:assert";
import {expect} from "@playwright/test";

let browser: Browser;
let page: Page;
let data: { name: string; change: number;}[] = [];
let marketdata: { name: string; marketCap: number;}[] = [];

/**
 * This step navigates the used to the FTSE 100 constituents page
 */
Given('I navigate to the FTSE 100 constituents page', async function () {
    // Launch a new instance of the Chromium browser in non-headless mode (visible window)
    browser = await chromium.launch({ headless: false });

    // Create a new browser context (isolated session, like a fresh browser profile)
    const context = await browser.newContext();

    // Open a new page in the browser
    page = await context.newPage();

    // Navigate to the FTSE 100 constituents table page
    await page.goto('https://www.londonstockexchange.com/indices/ftse-100/constituents/table', {
        waitUntil: 'domcontentloaded'
    });
});

/**
 * This step accepts the cookies policy on the page, as it was causing a timeout issue on some occasions and thats what a regular user would do.
 */
Given('I accept the cookies policy', async function () {
    // Wait for the cookie button if it exists
    await page.waitForTimeout(3000);

    //Locates the button by the text in it
    const cookieButton = page.locator('button', {
        hasText: /Accept all cookies/i
    });

    //checks if the button is visible, it will post a message in the console to help with debugging if there are any issues.
    if (await cookieButton.isVisible()) {
        console.log('Cookie acceptance button found. Clicking…');
        await cookieButton.click();
        console.log('Cookies policy accepted.');
    } else {
        console.log('No cookie banner appeared.');
    }
});

/**
 * This step navigates to the last page on the table as the info was being scraped per page, meaning it wasnt a full dataset which was being sorted/checked.
 */
Given('I navigate to the last page of the table', async function () {
    // Wait for page links to appear
    await page.waitForSelector('a.page-number');

    // Grab all page number links
    const pageLinks = await page.$$eval('a.page-number', links =>
        links
            .map(link => ({
                text: link.textContent?.trim() || '',
                href: link.getAttribute('href') || ''
            }))
            .filter(link => /^\d+$/.test(link.text))
    );

    //In case there are is only one page in the table
    if (pageLinks.length === 0) {
        console.log('⚠️ No pagination found. Staying on current page.');
        return;
    }

    // Find the link with the highest page number
    const lastPageLink = pageLinks.reduce((prev, curr) =>
        Number(curr.text) > Number(prev.text) ? curr : prev
    );

    // Navigate to the href of the last page
    const baseUrl = 'https://www.londonstockexchange.com';
    const lastPageUrl = lastPageLink.href.startsWith('/')
        ? baseUrl + lastPageLink.href
        : lastPageLink.href;

    await page.goto(lastPageUrl, { waitUntil: 'domcontentloaded' });
});

/**
 * This step navigates the used to the FTSE 100 indices page
 */
Given('I navigate to the FTSE 100 indices page', async function () {
    // Launch a new instance of the Chromium browser in non-headless mode (visible window)
    browser = await chromium.launch({ headless: false });

    // Create a new browser context (isolated session, like a fresh browser profile)
    const context = await browser.newContext();

    // Open a new page in the browser
    page = await context.newPage();

    // Navigate to the FTSE 100 indices table page
    await page.goto('https://www.londonstockexchange.com/indices/ftse-100', {
        waitUntil: 'domcontentloaded'
    });
});

/**
 * This step sets the date range to be the last 3Y and sorts it by month
 */
Given('I set the date range to the last 3Y and sort it by Month', async function () {
    //Locating the start year field
    const yearInput = page.locator('input[aria-label="Year in from date"]');

    //Getting the current year -3
    const year = new Date().getFullYear() - 3;
    const yearStr = year.toString();

    // Clear any existing value
    await yearInput.fill('');

    // Type a new value, which is the current year -3
    await yearInput.fill(yearStr);

    // Assert the value has changed
    await expect(yearInput).toHaveValue(yearStr);

    // Press Enter key
    await yearInput.press('Enter');

    // Locate the sort button by its id
    const toggleButton = page.locator('#__BVID__44__BV_toggle_');

    // Optionally assert that it’s visible
    await expect(toggleButton).toBeVisible();

    // Click the button
    await toggleButton.click();

    // Wait for dropdown to appear
    const monthlyOption = page.locator('button.dropdown-item', { hasText: 'Monthly' });

    //Assert the option is visible
    await expect(monthlyOption).toBeVisible();

    // Click the Monthly option
    await monthlyOption.click();
})

When('I extract the average index value for each month', { timeout: 30000 }, async function () {

    //Checking the graph is there by ID
    const graphLocator = page.locator('#w-advanced-chart-widget');
    await expect(graphLocator).toBeVisible()

    // Find all <path> elements with the right class
    const paths = page.locator('path.highcharts-point');

    await page.waitForTimeout(10000); // wait 10 seconds
    const count = await paths.count();
    console.log(`Found ${count} data points.`);

    const labels: string[] = [];

    for (let i = 0; i < count; i++) {
        const el = paths.nth(i);
        const label = await el.getAttribute('aria-label');
        if (label) {
            labels.push(label);
        }
    }
    
    // It helps find the smallest price in our loop below.
    let lowestPrice = Number.POSITIVE_INFINITY;
    let lowestLabel = '';

    // Loop through every aria-label string we scraped from the site
    for (const label of labels) {
        //Define a regular expression to extract the values individually
        const regex = /Price of base ric is ([\d.,]+)\s+(\d{1,2}) (\w+) (\d{4})/;

        // Try to match the current label string against the regex
        const match = label.match(regex);
        if (match) {
            // Extract the price string from the regex match (e.g. "8772.38")
            const priceStr = match[1];
            // Convert the price string into a number:
            const price = parseFloat(priceStr.replace(/,/g, ''));

            // Check if this price is lower than the lowest price found so far
            if (price < lowestPrice) {
                // Update lowestPrice to this new lower price
                lowestPrice = price;
                // Save the entire label so we remember which point had the lowest price
                lowestLabel = label;
            }
        }
    }
    // Save the results into the Cucumber World (this) context
    this.lowestPrice = lowestPrice;
    this.lowestLabel = lowestLabel;

});

/**
 * This step extracts the list of constituents and their % change
 */
When('I extract the list of constituents and their percentage changes', async function () {
    // Wait for table rows to appear
    await page.waitForSelector('table tbody tr');

    // Query all rows
    const rows = await page.$$('table tbody tr');

    // Initialize an empty array to store the scraped data
    data = [];

    // Loop through each row found in the table
    for (const row of rows) {
        const nameElement = await row.$('td:nth-child(2) a'); //grabbing the name from the table
        const changeElement = await row.$('td:nth-child(7)'); //grabbing the % change from the table

        // Continue only if both name and percentage change elements exist
        if (nameElement && changeElement) {
            const name = (await nameElement.textContent())?.trim() || ''; //extracting the text from the page, removing spaces and ensures null values wouldn't end the test
            let changeStr = (await changeElement.textContent())?.trim() || ''; //same as above

            // Clean up the string:
            changeStr = changeStr
                .replace(/[,%]/g, '')      // remove commas and percent
                .replace(/−/g, '-')        // replace Unicode minus with ASCII minus
                .replace('+', '')          // remove plus sign
                .trim();

            // Convert cleaned string to a number
            const change = parseFloat(changeStr);

            // Check if market cap is a valid number
            if (!isNaN(change)) {
                // Add the company name and change % to the array
                data.push({ name, change });
            }
        }
    }
});

/**
 * This step extracts the list of marketcap and checking it's more than 7 million
 */
When('I extract all constituents whose Market Cap exceeds 7 million', async function () {

    // Wait for table rows to appear in the DOM
    await page.waitForSelector('table tbody tr');

    // Query all rows
    const rows = await page.$$('table tbody tr');

    // Initialize an empty array to store the scraped market data
    marketdata = [];

    // Loop through each row found in the table
    for (const row of rows) {
        const nameElement = await row.$('td:nth-child(2) a'); //grabbing the name from the table
        const marketCapElement = await row.$('td:nth-child(4)'); //grabbing the marketcap from the table

        // Continue only if both name and market cap elements exist
        if (nameElement && marketCapElement) {
            // Extract text content for the company name, trim whitespace
            const name = (await nameElement.textContent())?.trim() || ''; //extracting the text from the page, removing spaces and ensures null values wouldn't end the test
            let changeStr = (await marketCapElement.textContent())?.trim() || ''; //same as above

            // Clean up the string:
            changeStr = changeStr
                .replace(/[,%]/g, '')      // remove commas and percent
                .replace(/−/g, '-')        // replace Unicode minus with ASCII minus
                .replace('+', '')          // remove plus sign
                .trim();

            // Convert cleaned string to a number
            const marketCap = parseFloat(changeStr);

            // Check if market cap is a valid number and greater than 7 mil
            if (!isNaN(marketCap)&& marketCap > 7) {
                // Add the company name and market cap to the array
                marketdata.push({ name, marketCap });
            }

        }
    }
});

/**
 * This step displays the final list and sorts it prior.
 */
Then('I display the top 10 constituents with the highest percentage change', async function () {
    // Sort so the highest percentages is top of the table
    const top10 = data
        .sort((a, b) => b.change - a.change)
        .slice(0, 10);

    // Assertion: ensure we have exactly 10 results
    assert.equal(top10.length, 10, 'Expected exactly 10 constituents in the bottom10 list');

    console.log('\nTop 10 Constituents by % Change:');
    console.table(top10);

    await browser.close();
});

/**
 * This step displays the final list and sorts it prior.
 */
Then('I display the top 10 constituents with the lowest percentage change', async function () {
    // Sort so the lowest percentages is top of the table
    const bottom10 = data
        .sort((a, b) => a.change - b.change)
        .slice(0, 10);

    // Assertion: ensure we have exactly 10 results
    assert.equal(bottom10.length, 10, 'Expected exactly 10 constituents in the bottom10 list');

    // Print a header message to the console
    console.log('\nBottom 10 Constituents by % Change:');
    console.table(bottom10);

    await browser.close();
});

/**
 * This step displays the final list and sorts it prior.
 */
Then('I display the list of these constituents', async function () {
    // Print a header message to the console
    console.log('\nFTSE 100 Constituents with Market Cap > £7 million:');

    // Sort the array 'marketdata' by marketCap in ascending order
    const dataSorted = marketdata
    .sort((a, b) => a.marketCap - b.marketCap)

    // Display the sorted data in a table format in the console
    console.table(dataSorted);

    // Close the browser instance after finishing the task
    await browser.close();
});

/**
 * This step displays the lowest index found on the chart and its date.
 */
Then('I see the lowest index value printed with its date printed.', async function () {
    // Retrieve the lowestLabel value that we stored earlier in the "When" step.
    const lowestLabel: string = this.lowestLabel;

    // Check if we found any label with the lowest price
    if (lowestLabel) {
        // Use array destructuring to extract
        const regex = /Price of base ric is ([\d.,]+)\s+(\d{1,2}) (\w+) (\d{4})/;
        const match = lowestLabel.match(regex);
        if (match) {
            const [, priceStr, day, month, year] = match;
            // Print the lowest FTSE100 price found
            console.log(`Lowest FTSE100 price found: ${priceStr}`);
            // Print the date associated with the lowest price
            console.log(`On date: ${day} ${month} ${year}`);
        }
    } else {
        // If no valid label is found please print this.
        console.log('No valid labels found.');
    }

    await browser.close();
})
