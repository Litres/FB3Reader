import {
	FB3ReaderSite,
	FB3DataProvider,
	FB3PPCache,
	FB3DOM,
	FB3Bookmarks,
	FB3Reader,
	LocalBookmarks
} from "../../src"

import "./app.css";

/**
 * This is the basic usage of FB3Reader created for testing purposes
 * Small app is built using core/webpack.config.js configuration
 */

// all the necessary setup
const canvas = document.getElementById('reader');
const AppVersion = "1.0.0", ArtID = GetArtID(), SID = "12345";
const LitresLocalBookmarks = new LocalBookmarks.LocalBookmarksClass(ArtID.toString());
const AReaderSite = new FB3ReaderSite.ExampleSite(canvas, undefined, LitresLocalBookmarks);
const DataProvider = new FB3DataProvider.AJAXDataProvider("", ArtID2URL, undefined);
const AFB3PPCache = new FB3PPCache.PPCache(AppVersion);
const AReaderDOM = new FB3DOM.DOM(AReaderSite, AReaderSite.Progressor, DataProvider, AFB3PPCache);
const BookmarksProcessor = new FB3Bookmarks.LitResBookmarksProcessor(AReaderDOM, SID, ArtID, LitresLocalBookmarks.GetCurrentArtBookmarks());
BookmarksProcessor.FB3DOM.Bookmarks.push(BookmarksProcessor);
const AFB3Reader = new FB3Reader.Reader(true, AReaderSite, AReaderDOM, BookmarksProcessor, AppVersion, AFB3PPCache, SID, ArtID, false, false);
AFB3Reader.HyphON = true;

// we need to know when the page is rendered in order to make some assertions within Jest
AFB3Reader.CanvasReadyCallback = Range => {
	const event = new CustomEvent('CanvasReady', { 'detail': Range });
	document.dispatchEvent(event);
};

// finally initializing FB3Reader
AFB3Reader.Init(GetInitRange());
AFB3Reader.StartTime = new Date().getTime();

// exporting AFB3Reader for debugging
(<any> window).AFB3Reader = AFB3Reader;

function GetArtID(): string {
	const URL = decodeURIComponent(window.location.href);
	const BaseURL = URL.match(/\bart_id=([0-9]+)/i);
	if (BaseURL == null || !BaseURL.length) {
		return 'null';
	}
	return BaseURL[1];
}

function GetInitRange(): number[] {
	const URL = decodeURIComponent(window.location.href);
	const StartFrom = URL.match(/\bstart_from=([0-9]+)/i);
	if (StartFrom == null || !StartFrom.length) {
		return [0];
	}
	return [+StartFrom[1]];
}

function ArtID2URL(Chunk?: string): string {
	let OutURL = '/static/AjaxExample/' + ArtID +'/';
	if (Chunk == null) {
		OutURL += 'toc.js';
	} else if (Chunk.match(/\./)) {
		OutURL += Chunk;
	} else {
		OutURL += FB3DataProvider.zeroPad(Chunk,3) + '.js';
	}
	return OutURL;
}
