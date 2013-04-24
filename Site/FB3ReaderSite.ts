/// <reference path="FB3ReaderSiteHead.ts" />

module FB3ReaderSite {

	export class FB3ReaderSite implements IFB3ReaderSite {
		Progressor: ILoadProgress;
		NotePopup: INotePopup;
		Alert: IAlert = function (Message: string) { window.alert(Message); }
		constructor(public Canvas: HTMLElement) {

		}
	}

}