/// <reference path="FB3ReaderAllModules.ts" />

module FB3DOM {

	export interface IPointer extends Array {};
	export interface IDOMBlockReadyCallback { (Block: Array); };

	export interface IFB3Block {
		GetPartialHTML(HyphOn: bool, From: number, To: number): string;
		GetHTML(HyphOn: bool);
	}

	export interface IFB3DOM {
		//		constructor(URL:string);
	}

}