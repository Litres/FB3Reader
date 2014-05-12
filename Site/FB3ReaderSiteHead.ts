/// <reference path="../FB3ReaderHeaders.ts" />

module FB3ReaderSite {
	
	// Mothership with all interfaces aboard - everybody will pick here
	export interface IFB3ReaderSite {
		Progressor: ILoadProgress;
		IdleThreadProgressor: ILoadProgress;
		Canvas: HTMLElement;
		NotePopup: INotePopup;
		Alert: IAlert;
		Key: string; // Settings key, like font size and name, user for cache srore/read
		getElementById(elementId: string): HTMLElement;
		elementFromPoint(x: number, y: number): Element;
		HeadersLoaded(MetaData: FB3DOM.IMetaData): void; // when headers (Meta, toc and chunks info) loaded
		AfterTurnPageDone():void; // when first start, default position and bookmark position set
		BookCacheDone():void; // after full 100% book cache done
	}

	// General-purpose interface for progress feedback
	export interface ILoadProgress {
		HourglassOn(Owner: any, LockUI?: boolean, Message?: string): void;
		Progress(Owner: any, Progress: number): void; // Progress vary 0 - 100, means percent
		HourglassOff(Owner: any): void;
		Tick(Owner: any): void;
		Alert: IAlert;
	}

	// A dumb clone of window.alert(). Defined just to make this clear
	export interface IAlert {
		(Message: string): void;
	}

	// When the Reader will want to show the footnote in the poup-up window, it will call this:
	export interface INotePopup {
		(NoteBody: FB3DOM.InnerHTML): void;
	}

}
