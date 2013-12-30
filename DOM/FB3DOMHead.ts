/// <reference path="../FB3ReaderHeaders.ts" />

module FB3DOM {

	export interface InnerHTML extends String {};
	export interface IRange {
		From: FB3Reader.IPosition;
		To: FB3Reader.IPosition;
	}
	export interface IPageContainer {
		Body: InnerHTML[];
		FootNotes: InnerHTML[];
	}
	export interface IDOMTextReadyCallback { (PageData: IPageContainer): void; }
	export interface ITOC {				// Compact notation as we plan to transfer this over network, why create overload
		t?: string;	// title
		s: number;	// start root node N
		e: number;	// end root node (including, use [0,-1] Pointer to get last block)
		c?: ITOC[];	// contents (subitems)
	}
	export interface IJSONBlock {	// Compact notation for the same reason
		t: string;				// Tag name
		xp?: number[];		// XPAth shurtcut for this node in the native XML
		c?: any[];				// Child nodes/text for this tag (array)
		nc?: string;			// Native class name for the block
		css?: string;			// Native CSS for the block
		i?: string;				// FB/HTML ID (may be user as anchor target f.e.)
		href?: string;		// Anchor
		f?: any;					// Footnote contents
		w?: number;				// image width
		h?: number;				// image height
		s?: string;				// image src attribute
	}

	export interface IDataDisposition {
		s: number;
		e: number;
		url: string;
		loaded: number; // 0 - not loaded, 1 - requested, 2 - loaded, available
	}

	export interface IFB3Block {
		Parent: IFB3Block;
		XPID: string;				// XPAth-like ID for this DOM-node, allows for reverse search for block
		Chars: number;			// Length of the node - pure characters and spaces
		ID: number;					// Position of this node within the parent. Used to generate GetXPID
		TagName?: string;		// Native tag name. May be mapped to HTML with another tag name
		// Returns partial HTML for this node
		ArtID2URL(Chunk?: string): string;
		Data: IJSONBlock;
		Childs: IFB3Block[];
		Bookmarks: FB3Bookmarks.IBookmarks[];
		text: string				// empty for tags, filled for text nodes
		XPath: FB3Bookmarks.IXPath;		// Source FB2 file adress - allows to work with store/load selections
		GetHTML(HyphOn: boolean,
			BookStyleNotes: boolean,
			Range: IRange,
			IDPrefix: string,
			ViewPortW: number,
			ViewPortH: number,
			PageData: IPageContainer,
			Bookmarks: FB3Bookmarks.IBookmark[]);
	}

	export interface IIFB3DOMReadyFunc{ (FB3DOM: IFB3DOM): void }

	export interface IFB3DOM extends IFB3Block{
		Ready: boolean;
		Progressor: FB3ReaderSite.ILoadProgress;
		Alert: FB3ReaderSite.IAlert;
		DataProvider: FB3DataProvider.IJsonLoaderFactory;
		TOC: ITOC[];
		DataChunks: IDataDisposition[];
		ArtID2URL(Chunk?: string): string;
		Init(HyphOn: boolean,
			ArtID: string,
			OnDone: IIFB3DOMReadyFunc);
		GetHTMLAsync(HyphOn: boolean,
			BookStyleNotes:boolean,
			Range: IRange,
			IDPrefix: string,
			ViewPortW: number,
			ViewPortH: number,
			Callback: IDOMTextReadyCallback): void;
		GetElementByAddr(Position: FB3Reader.IPosition): IFB3Block;
		GetXPathFromPos(Position: FB3Reader.IPosition): FB3Bookmarks.IXPath;
		GetHTML(HyphOn: boolean,
			BookStyleNotes: boolean,
			Range: IRange,
			IDPrefix: string,
			ViewPortW: number,
			ViewPortH: number,
			PageData: IPageContainer);
	}

}