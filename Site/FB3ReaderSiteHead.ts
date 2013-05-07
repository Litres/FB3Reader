/// <reference path="../FB3ReaderHeaders.ts" />

module FB3ReaderSite {

	// General-purpose interface for progress feedback
	export interface ILoadProgress {
		HourglassOn(Owner: any, Message: string): void;
		Progress(Owner: any, Progress: number): void;
		HourglassOff(Owner: any): void;
		Tick(Owner: any): void;
		Alert: IAlert;
	}

	export interface IAlert { (Message: string): void; }
	export interface INotePopup { (NoteBody: FB3DOM.IFB3Block): void; }
	export interface IFB3ReaderSite {
		Progressor: ILoadProgress;
		Canvas: HTMLElement;
		NotePopup: INotePopup;
		Alert: IAlert;
	}

}
