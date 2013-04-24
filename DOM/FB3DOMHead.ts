/// <reference path="../FB3ReaderHeaders.ts" />

module FB3DOM {

	export interface IRange { From: number[]; To: number[] };
	export interface IDOMTextReadyCallback { (HTML: string): void; };
	export interface ITOC extends Array {};
	export interface IJSONBlock {
		t: string;		// Tag name
		xp?: number[];// XPAth shurtcut for this node in the native XML
		c?: any[];		// Child nodes/text for this tag (array)
		nc?: string;	// Native class name for the block
		css?: string; // Native CSS for the block
		i?: string;		// FB/HTML ID
	}

	export interface IFB3Block {
		Parent: IFB3Block;
		GetHTML(HyphOn: bool, Range: IRange):string;
	}

	export interface IFB3DOM extends IFB3Block{
		TOC(): FB3Reader.ITocNode;
		//		constructor();
	}

}