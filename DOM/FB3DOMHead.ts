/// <reference path="../FB3ReaderHeaders.ts" />

module FB3DOM {

	export interface IRange { From: number[]; To: number[] }
	export interface IDOMTextReadyCallback { (HTML: string): void; }
	export interface ITOC {				// Compact notation as we plan to transfer this over network, why create overload
		t?: string;	// title
		s: number;	// start root node N
		e: number;	// end root node (including, use [0,-1] Pointer to get last block)
		c?: ITOC[];	// contents (subitems)
	}
	export interface IJSONBlock {	// Compact notation for the same reason
		t: string;		// Tag name
		xp?: number[];// XPAth shurtcut for this node in the native XML
		c?: any[];		// Child nodes/text for this tag (array)
		nc?: string;	// Native class name for the block
		css?: string; // Native CSS for the block
		i?: string;		// FB/HTML ID
	}

	export interface IFB3Block {
		Parent: IFB3Block;
		Chars: number;
		ID: number;
		GetXPID(): string;
		GetHTML(HyphOn: bool, Range: IRange):string;
	}

	export interface IIFB3DOMReadyFunc{ (FB3DOM: IFB3DOM): void }

	export interface IFB3DOM extends IFB3Block{
		HyphOn: bool;
		TOC(): FB3Reader.ITocNode;
		Progressor: FB3ReaderSite.ILoadProgress;
		Alert: FB3ReaderSite.IAlert;
		DataProvider: FB3DataProvider.IJsonLoaderFactory;
		Init(HyphOn: bool, URL: string, OnDone: IIFB3DOMReadyFunc);
		//		constructor();
	}

}