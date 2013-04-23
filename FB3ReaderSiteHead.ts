/// <reference path="FB3ReaderAllModules.ts" />

module FB3ReaderSite {

	export interface IAlert { (Message: string): void; }
	export interface INotePopup { (NoteBody: FB3DOM.IFB3Block): void; }
	export interface ILoadProgress {
		HourglassOn(Message:string): void;
		progress(Message:string,Progress: number): void;
		HourglassOff(Message: string): void;
	}
	export interface IFB3ReaderSite {
		Progressor: ILoadProgress;
		Canvas: HTMLElement;
		NotePopup: INotePopup;
		Alert: IAlert;
	}

}
