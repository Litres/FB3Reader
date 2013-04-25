/// <reference path="Site/FB3ReaderSite.ts" />
/// <reference path="Reader/FB3Reader.ts" />
/// <reference path="DOM/FB3DOM.ts" />

window.onload = () => {
	var AReaderSite = new FB3ReaderSite.FB3ReaderSite(document.getElementById('reader'));
	var AReaderDOM = new FB3DOM.FB3DOM(AReaderSite.Alert);
	var AFB3Reader: FB3Reader.IFBReader;
	AReaderDOM.Init(true, 'about:blank', (FB3DOM: FB3DOM.IFB3DOM) => {
			AFB3Reader = new FB3Reader.FB3Reader(AReaderSite, FB3DOM);
		} );

};