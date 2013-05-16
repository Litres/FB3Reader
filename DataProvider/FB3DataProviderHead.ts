/// <reference path="../FB3ReaderHeaders.ts" />

module FB3DataProvider {
	export interface IJSonLoadedCallback {
		(Data: any, CustomData?: any): void;
	}
	export interface IJsonLoaderFactory {
		Request(ArtID: string,
			Callback: IJSonLoadedCallback,
			Progressor: FB3ReaderSite.ILoadProgress,
			CustomData?: any);
		ArtID2URL(ArtID: string, Chunk?:number): string;
	}
}