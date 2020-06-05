const merge = require('merge');
const ts_preset = require('ts-jest/jest-preset');
const puppeteer_preset = require('jest-puppeteer/jest-preset');

module.exports = merge.recursive(ts_preset, puppeteer_preset, {
	globals: {
		test_url: `http://${process.env.HOST || 'localhost'}:${process.env.PORT || 4444}`,
	},
	testEnvironment: 'node',
	moduleNameMapper: {
		"^.+\\.(css|less|scss)$": "identity-obj-proxy"
	}
});