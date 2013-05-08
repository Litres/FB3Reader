/// <reference path="../FB3ReaderHeaders.ts" />

module FB3DataProvider {
	export interface IJSonLoadedCallback {
		(Data: any, CustomData?: any): void;
	}
	export interface IJsonLoaderFactory {
		Request(URL: string,
			Callback: IJSonLoadedCallback,
			Progressor: FB3ReaderSite.ILoadProgress,
			CustomData?: any);
	}
}