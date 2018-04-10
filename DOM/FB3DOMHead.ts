/// <reference path="../FB3ReaderHeaders.ts" />

module FB3DOM {

	export var MaxFootnoteHeight: number;
	export interface IXPath extends Array<any> { }
	export interface InnerHTML extends String {};
	export interface IRange {
		From: FB3ReaderAbstractClasses.IPosition;
		To: FB3ReaderAbstractClasses.IPosition;
	}
	export interface IPageContainer {
		Body: InnerHTML[];
		FootNotes: InnerHTML[];
		BodyXML: string[];
	}
	export interface IDOMTextReadyCallback { (PageData: IPageContainer): void; }
	export interface IChunkLoadedCallback { (): void }

	export interface ITOC { // Compact notation as we plan to transfer this over the network, why create an overload
		t?: string;	// title
		s: number;	// start root node N
		e: number;	// end root node (including, use [0,-1] Pointer to get last block)
		bookmarks?: {	// Number of currently existing bookmarks, by type (see FB3Bookmarks.IBookmark.Group)
			g0?: number; // number of bookmarks type 0, this is the current position. <=0
			g1?: number; // 1 bookmark
			g2?: number;	// 2 important bookmark
			g3?: number;	// 3 note
			g4?: number;	// 4 important note
			g5?: number;	// 5 selection/highlight
			g6?: number;	// 6 important selection/highlight
			g7?: number;	// 7 custom type #1
			g8?: number;	// 8 custom type #2
			g9?: number;	// 9 other
		};
		cl: boolean; // partially clipped chapter (for trial book)
		tcl: boolean; // entirely clipped chapter (for trial book)
		fcp: boolean; // first character position in chapter 
		c?: ITOC[];	// contents (subitems)
	}
	export interface IJSONBlock {	// Compact notation for the same reason
		t: string;			// Tag name
		xp?: number[];		// XPAth shurtcut for this node in the native XML
		c?: IJSONBlock[];	// Child nodes/text for this tag (array)
		nc?: string;		// Native class name for the block
		css?: string;		// Native CSS for the block
		i?: string;			// FB/HTML ID (may be user as anchor target f.e.)
		href?: string;		// Anchor
		f?: any;			// Footnote contents
		w?: number;			// image width (in pixels, image itself)
		wth?: number;		// image width as requested in fb3 document
		minw?: number;		// image minimal widthfrom in fb3 document
		maxw?: number;		// image maximal widthfrom in fb3 document
		h?: number;			// image height
		s?: string;			// image src attribute
		hr: number[];		// target internal xpath for internal hrefs
		op?: boolean;		// Is this node unbreakable, should it fit on ONE page, mo matter the cost?
		fl?: string;		// Where to float the box? May be left|right|center|default
		al?: string;		// Text-align May be left|right|center|justify
		valn?: string;		// TD vertical align. top|middle|bottom
		bnd?: string;		// ID of the element to float around
		brd?: boolean;		// Border presence
		csp?: number;		// colspan
		rsp?: number;		// rowspan
		att?: boolean;		// If true - note title may have autotext (default behaviour).
							// Like [1] or * or **. Or leave text from the document if false
	}

	export interface IDataDisposition {
		s: number;
		e: number;
		url: string;
		loaded: number; // 0 - not loaded, 1 - requested, 2 - loaded, available
		xps: IXPath;  // native fb2 xpath for the chunk first element 
		xpe: IXPath;  // same for the last one
	}

	export interface IMetaData {
		Title: string;
		UUID: string;
		Authors: IAuthorsData[];
	}
	export interface IAuthorsData {
		First: string;
		Last: string;
		Middle: string;
	}

	export interface IFB3BlockRectangle {
		Width: number;
		Height: number;
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
		text: string				// empty for tags, filled for text nodes
		XPath: IXPath;		// Source FB2 file adress - allows to work with store/load selections
		GetHTML(HyphOn: boolean,
			BookStyleNotes: boolean,
			Range: IRange,
			IDPrefix: string,
			ViewPortW: number,
			ViewPortH: number,
			PageData: IPageContainer,
			Bookmarks: FB3Bookmarks.IBookmark[]);
		GetXML(Range: IRange,
			PageData: IPageContainer);
		Position(): FB3ReaderAbstractClasses.IPosition;
		IsBlock(): boolean;
		IsUnbreakable?: boolean;
	}

	export interface IIFB3DOMReadyFunc{ (FB3DOM: IFB3DOM): void }

	export interface IFB3DOM extends IFB3Block{
		Ready: boolean;
		Progressor: FB3ReaderSite.ILoadProgress;
		Site: FB3ReaderSite.IFB3ReaderSite;
		DataProvider: FB3DataProvider.IJsonLoaderFactory;
		TOC: ITOC[];
		DataChunks: IDataDisposition[];
		MetaData: IMetaData;
		PagesPositionsCache: FB3PPCache.IFB3PPCache;
		ArtID2URL(Chunk?: string): string;
		Bookmarks: FB3Bookmarks.IBookmarks[];
		Init(HyphOn: boolean,
			OnDone: IIFB3DOMReadyFunc);
		GetHTMLAsync(HyphOn: boolean,
			BookStyleNotes: boolean,
			Range: IRange,
			IDPrefix: string,
			ViewPortW: number,
			ViewPortH: number,
			Callback: IDOMTextReadyCallback): void;
		GetElementByAddr(Position: FB3ReaderAbstractClasses.IPosition): IFB3Block;
		GetAddrByXPath(XPath: IXPath): FB3ReaderAbstractClasses.IPosition;
		GetXPathFromPos(Position: FB3ReaderAbstractClasses.IPosition, End?:boolean): IXPath;
		OnChunkLoaded(Data: IJSONBlock[], CustomData?: any): void;
		ChunkUrl(N: number): string;
		LoadChunks(MissingChunks: number[], Callback: IChunkLoadedCallback): void; // Sets the chunks to be loaded
		GetHTML(HyphOn: boolean,
			BookStyleNotes: boolean,
			Range: IRange,
			IDPrefix: string,
			ViewPortW: number,
			ViewPortH: number,
			PageData: IPageContainer);
		GetXML(Range: IRange,
			PageData: IPageContainer);		
		XPChunk(X: IXPath): number;
		Reset(): void; // Stop all callbacks (leaving some internal processing)
		GetFullTOC(): object;
	}
}
