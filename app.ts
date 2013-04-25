/// <reference path="Site/FB3ReaderSite.ts" />
/// <reference path="Reader/FB3Reader.ts" />
/// <reference path="DOM/FB3DOM.ts" />
/// <reference path="DataProvider/FB3AjaxDataProvider.ts" />

window.onload = () => {
	var Canvas = document.getElementById('reader');
	var AReaderSite = new FB3ReaderSite.Site(Canvas);
	var DataProvider = new FB3DataProvider.AJAXDataProvider();
	var AReaderDOM = new FB3DOM.DOM(AReaderSite.Alert, AReaderSite.Progressor, DataProvider);
	var AFB3Reader: FB3Reader.IFBReader;
	AReaderDOM.Init(true, 'about:blank', (FB3DOM: FB3DOM.IFB3DOM) => {
			AFB3Reader = new FB3Reader.Reader(AReaderSite, FB3DOM);
		} );

};