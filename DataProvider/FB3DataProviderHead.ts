/// <reference path="../FB3ReaderHeaders.ts" />

module FB3DataProvider {
	export interface IJSonLoadedCallback {
		(Data: any, CustomData?: any): void;
	}
	export interface IArtID2URL {
		(Chunk?: string): string;
	}

	export interface IJsonLoaderFactory {
		Request(ArtID: string,
			Callback: IJSonLoadedCallback,
			Progressor: FB3ReaderSite.ILoadProgress,
			CustomData?: any);
		Reset(): void;	// stops any kind of activities, ignores all data arriving from previour requests
						// we believe data is browser-cached well, so no need to wory about it's dropped
		ArtID2URL: IArtID2URL;
	}
}