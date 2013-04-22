/// <reference path="FB3ReaderAllModules.ts" />

module FB3ReaderSite {

	export interface INotePopup { (NoteBody: FB3DOM.IFB3Block): void; }
	export interface ILoadProgress {
		HourglassOn(): void;
		progress(Progress: number): void;
		HourglassOff(): void;
	}
	export interface IAlert { (Message: string): void; }
	export interface IFB3ReaderSite {
		Progressor: ILoadProgress;
		Canvas: HTMLElement;
		NotePopup: INotePopup;
		Alert: IAlert;
		PositionChanges(Navigator: FB3Reader.IFB3ReaderNavigator): void;
	}

}