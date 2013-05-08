/// <reference path="../FB3ReaderHeaders.ts" />

module FB3ReaderSite {
	
	// Mothership with all interfaces aboard - everybody will pick here
	export interface IFB3ReaderSite {
		Progressor: ILoadProgress;
		Canvas: HTMLElement;
		NotePopup: INotePopup;
		Alert: IAlert;
	}

	// General-purpose interface for progress feedback
	export interface ILoadProgress {
		HourglassOn(Owner: any, LockUI?: boolean, Message?: string): void;
		Progress(Owner: any, Progress: number): void;
		HourglassOff(Owner: any): void;
		Tick(Owner: any): void;
		Alert: IAlert;
	}

	// A dumb clone of window.alert(). Defined explicitly just to make this clear
	export interface IAlert {
		(Message: string): void;
	}

	// When the Reader will want to show the footnote in the poup-up window, it will call this:
	export interface INotePopup {
		(NoteBody: FB3DOM.InnerHTML): void;
	}

}
