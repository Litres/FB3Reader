/// <reference path="FB3ReaderAllModules.ts" />

window.onload = () => {
	var ReaderSite = new FB3ReaderSite.FB3ReaderSite(document.getElementById('reader'));
	var FB3Reader = new FB3Reader.FB3Reader(ReaderSite);
	FB3Reader.init('about:blank');
};