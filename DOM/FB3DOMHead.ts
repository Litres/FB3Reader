/// <reference path="../FB3ReaderHeaders.ts" />

module FB3DOM {

	export interface InnerHTML extends String {};
	export interface IRange {
		From: number[];
		To: number[];
	}
	export interface IDOMTextReadyCallback { (HTML: InnerHTML): void; }
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
		i?: string;		// FB/HTML ID (may be user as anchor target f.e.)
		href?: string;// Anchor
	}

	export interface IDataDisposition {
		s: number;
		e: number;
		url: string;
		loaded: number; // 0 - not loaded, 1 - requested, 2 - loaded, available
	}

	export interface IFB3Block {
		Parent: IFB3Block;
		Chars: number;			// Length of the node - pure characters and spaces
		ID: number;					// Position of this node within the parent. Used to generate GetXPID
		TagName?: string;		// Native tag name. May be mapped to HTML with another tag name
		GetXPID(): string;	// XPAth-like ID for this DOM-node, allows for reverse search for block
		GetHTML(HyphOn: bool, Range: IRange): InnerHTML;	// Returns partial HTML for this node
	}

	export interface IIFB3DOMReadyFunc{ (FB3DOM: IFB3DOM): void }

	export interface IFB3DOM extends IFB3Block{
		HyphOn: bool;
		Progressor: FB3ReaderSite.ILoadProgress;
		Alert: FB3ReaderSite.IAlert;
		DataProvider: FB3DataProvider.IJsonLoaderFactory;
		TOC: ITOC[];
		DataChunks: IDataDisposition[];
		Init(HyphOn: bool,
			URL: string,
			OnDone: IIFB3DOMReadyFunc);
		GetHTMLAsync(HyphOn: bool,
			Range: IRange,
			Callback: IDOMTextReadyCallback): void;
	}

}