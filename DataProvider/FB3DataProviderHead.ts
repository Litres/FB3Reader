/// <reference path="../FB3ReaderHeaders.ts" />

module FB3DataProvider {
	export interface IJSonLoadedCallback { (Data: Object): void; }
	export interface IJsonLoaderFactory {
		Request(URL: string, Callback: IJSonLoadedCallback, Progressor: FB3ReaderSite.ILoadProgress);
	}
}