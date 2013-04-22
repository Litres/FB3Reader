/// <reference path="FB3ReaderAllModules.ts" />

module FB3ReaderSite {

	export class FB3ReaderSite implements IFB3ReaderSite {
		Progressor: ILoadProgress;
		NotePopup: INotePopup;
		Alert: IAlert;
		PositionChanges(Navigator: FB3Reader.IFB3ReaderNavigator) {
		}
		constructor(public Canvas: HTMLElement) {

		}
	}

}