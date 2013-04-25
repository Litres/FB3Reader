/// <reference path="Site/FB3ReaderSite.ts" />
/// <reference path="Reader/FB3Reader.ts" />
/// <reference path="DOM/FB3DOMAsync.ts" />

window.onload = () => {
	var AReaderSite = new FB3ReaderSite.FB3ReaderSite(document.getElementById('reader'));
	var AReaderDOM = new FB3DOM.FB3DOM(AReaderSite.Alert, 'about:blank',true);
	var AFB3Reader = new FB3Reader.FB3Reader(AReaderSite, AReaderDOM);

};