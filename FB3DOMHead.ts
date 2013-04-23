/// <reference path="FB3ReaderAllModules.ts" />

module FB3DOM {

	export interface IPointer {};
	export interface IDOMBlockReadyCallback { (Block: IFB3Block); };
	export interface IDOMTextReadyCallback { (HTML: string); };
	export interface ITOC extends Array {};

	export interface IFB3Block {
		GetPartialHTML(HyphOn: bool, From: IPointer, To: IPointer): string;
		GetHTML(HyphOn: bool):string;
		GetBlocks(
			From: IPointer,
			To: IPointer,
			DoneCallBack: IDOMBlockReadyCallback,
			ProgressCallback: FB3ReaderSite.ILoadProgress
		): IFB3Block;
	}

	export interface IFB3DOM extends IFB3Block{
		Ready: bool;

		TOC(): FB3Reader.ITocNode;
		//		constructor();
	}

}