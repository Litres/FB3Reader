/// <reference path="FB3ReaderAllModules.ts" />

window.onload = () => {
    var el = document.getElementById('content');
    var Reader = new FB3ReaderSite.FB3ReaderSite(el);
};