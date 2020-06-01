import puppeteer from "puppeteer";
import {toMatchImageSnapshot} from 'jest-image-snapshot';
expect.extend({ toMatchImageSnapshot });

declare global {
	namespace jest {
		interface Matchers<R> {
			toMatchImageSnapshot(): R
		}
	}
}

describe('FB3Reader E2E', () => {
	let browser, page;
	beforeAll(async () => {
		browser = await puppeteer.launch();
		page = await browser.newPage();
		await page.setViewport({ width: 1280, height: 800 });
	});
	afterAll(async () => {
		await browser.close();
	});

	test('Basic text', async () => {
		expect.assertions(1);
		await renderFB3ReaderPage(browser, FB3ReaderPage(11668997, 1));
		const image = await page.screenshot();
		expect(image).toMatchImageSnapshot();
	}, 20000);

	test('Pages with images', async () => {
		expect.assertions(1);
		await renderFB3ReaderPage(browser, FB3ReaderPage(11668997, 175));
		const image = await page.screenshot();
		expect(image).toMatchImageSnapshot();
	}, 20000);

	test('Text crops correctly on image inside floating block (padding in the left column)', async () => {
		expect.assertions(1);
		await renderFB3ReaderPage(browser, FB3ReaderPage(11668997, 207), `
			#FB3ReaderHostDiv {
    			font-size: 29px;
    			line-height: 36px;
    			font-family: Arial, sans-serif;
			}
			.span-zoom {
				position: absolute;
				z-index: 1;
			}
		`);
		const image = await page.screenshot();
		expect(image).toMatchImageSnapshot();
	});

	test('Text crops correctly on image inside floating block (padding in the right column)', async () => {
		expect.assertions(1);
		await renderFB3ReaderPage(browser, FB3ReaderPage(11668997, 202), `
			#FB3ReaderHostDiv {
    			font-size: 29px;
    			line-height: 36px;
    			font-family: Arial, sans-serif;
			}
			.span-zoom {
				position: absolute;
				z-index: 1;
			}
		`);
		const image = await page.screenshot();
		expect(image).toMatchImageSnapshot();
	});

	// We need to be sure that page is rendered when we making asserts
	const renderFB3ReaderPage = async (browser, url, customStylesContent?) => {
		await page.goto(url);
		// wait until page is rendered
		if (customStylesContent) {
			await page.addStyleTag({content: customStylesContent});
		}
		await page.evaluate(() => {
			return new Promise((resolve, reject) => {
				document.addEventListener('CanvasReady', () => {
					resolve();
				});
			});
		});
	};
});

const getReaderContents = async page => await page.evaluate(() => document.querySelector('#reader').innerHTML);

// @ts-ignore test_url is exported from jest.config.js
const FB3ReaderPage = (artId: number, startFrom: number) => `${test_url}/?art_id=${artId}&start_from=${startFrom}`;

